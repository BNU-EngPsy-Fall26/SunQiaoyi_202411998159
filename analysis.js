(function initGroupAnalysis(global) {
  'use strict';

  const root = global.HW2 = global.HW2 || {};
  const logic = root.logic;

  const EXPERIMENTS = {
    flanker_grouping: {
      label: 'Flanker 目标隔离', metricLabel: '目标隔离收益', unit: 'ms', digits: 0,
      expectedTrials: 48, summarize: logic.summarizeFlanker,
      value: (summary) => summary.improvement, accuracyRequired: true
    },
    visual_search_grouping: {
      label: '视觉搜索与颜色分区', metricLabel: '颜色分区收益', unit: 'ms/item', digits: 1,
      expectedTrials: 60, summarize: logic.summarizeSearch,
      value: (summary) => summary.grouping_benefit, accuracyRequired: true
    },
    graphical_perception_guides: {
      label: '图形比例判断', metricLabel: '参照线收益', unit: '个百分点', digits: 1,
      expectedTrials: 36, summarize: logic.summarizeGraphical,
      value: (summary) => summary.guide_benefit, accuracyRequired: false
    }
  };

  function numeric(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function quantile(values, probability) {
    const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
    if (!sorted.length) return null;
    if (sorted.length === 1) return sorted[0];
    const position = (sorted.length - 1) * probability;
    const lower = Math.floor(position);
    const fraction = position - lower;
    return sorted[lower] + (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]) * fraction;
  }

  function overallAccuracy(trials) {
    const values = trials.map((trial) => trial.correct === true || trial.correct === 1 || trial.correct === '1' || String(trial.correct).toLowerCase() === 'true');
    return logic.proportion(values);
  }

  function recordTimestamp(record) {
    const parsed = Date.parse(String(record.created_at || '').replace(' ', 'T'));
    return Number.isFinite(parsed) ? parsed : numeric(record.record_id) || 0;
  }

  function latestCompleteRecords(records, experiment) {
    const config = EXPERIMENTS[experiment];
    if (!config) return [];
    const latest = new Map();
    for (const record of records || []) {
      if (record.experiment !== experiment || !record.participant || !Array.isArray(record.trials)) continue;
      if (record.trials.length < config.expectedTrials) continue;
      const previous = latest.get(record.participant);
      if (!previous || recordTimestamp(record) >= recordTimestamp(previous)) latest.set(record.participant, record);
    }
    return [...latest.values()];
  }

  function recordMetric(record, experiment) {
    const config = EXPERIMENTS[experiment];
    if (!config || !record || !Array.isArray(record.trials)) return null;
    if (record.trials.length < config.expectedTrials) return null;
    if (config.accuracyRequired && overallAccuracy(record.trials) < 0.60) return null;
    const summary = config.summarize(record.trials);
    const value = config.value(summary);
    return Number.isFinite(value) ? { value, summary } : null;
  }

  function compareWithPeers(currentResult, records, experiment, excludeRecordId = '') {
    const config = EXPERIMENTS[experiment];
    if (!config || !currentResult) return null;
    const currentSummary = currentResult.summary || config.summarize(currentResult.trials || []);
    const currentValue = config.value(currentSummary);
    if (!Number.isFinite(currentValue)) return { experiment, config, ready: false, reason: '当前有效试次不足' };

    const peers = latestCompleteRecords(records, experiment)
      .filter((record) => String(record.record_id || '') !== String(excludeRecordId || ''))
      .map((record) => {
        const metric = recordMetric(record, experiment);
        return metric ? { participant: record.participant, value: metric.value } : null;
      })
      .filter(Boolean);
    const values = peers.map((item) => item.value);
    const lower = values.filter((value) => value < currentValue).length;
    const equal = values.filter((value) => value === currentValue).length;

    return {
      experiment, config, ready: true, currentValue, peers, n: peers.length,
      median: logic.median(values), mean: logic.mean(values),
      q1: quantile(values, 0.25), q3: quantile(values, 0.75),
      percentile: values.length ? (lower + equal * 0.5) / values.length * 100 : null
    };
  }

  async function fetchExperimentRecords(lab, project, experiment, fetchImpl = global.fetch) {
    const endpoint = `${lab}/api/hw2/data?project=${encodeURIComponent(project)}&experiment=${encodeURIComponent(experiment)}`;
    const response = await fetchImpl(endpoint, { headers: { Accept: 'application/json' } });
    const payload = await response.json();
    if (!response.ok || !payload.ok || !Array.isArray(payload.records)) throw new Error(payload.msg || `HTTP ${response.status}`);
    return payload.records;
  }

  async function loadComparisons({ lab, project, results, uploads, fetchImpl = global.fetch }) {
    const names = Object.keys(EXPERIMENTS).filter((name) => results && results[name]);
    return Promise.all(names.map(async (experiment) => {
      const records = await fetchExperimentRecords(lab, project, experiment, fetchImpl);
      const recordId = uploads && uploads[experiment] ? uploads[experiment].record_id : '';
      return compareWithPeers(results[experiment], records, experiment, recordId);
    }));
  }

  function format(value, digits) {
    return Number.isFinite(value) ? logic.round(value, digits).toFixed(digits) : '—';
  }

  function distributionSvg(comparison) {
    const values = comparison.peers.map((item) => item.value).concat(comparison.currentValue);
    let min = Math.min(...values);
    let max = Math.max(...values);
    const span = max - min;
    const padding = span > 0 ? span * 0.14 : Math.max(1, Math.abs(max) * 0.15);
    min -= padding;
    max += padding;
    const width = 520;
    const height = 112;
    const left = 34;
    const right = 18;
    const axisY = 72;
    const x = (value) => left + (value - min) / (max - min) * (width - left - right);
    const dots = comparison.peers.map((item, index) => {
      const cy = 45 - (index % 3) * 8;
      return `<circle cx="${x(item.value)}" cy="${cy}" r="5" class="peer-dot"><title>匿名同伴：${format(item.value, comparison.config.digits)} ${comparison.config.unit}</title></circle>`;
    }).join('');
    const currentX = x(comparison.currentValue);
    const medianLine = Number.isFinite(comparison.median)
      ? `<line x1="${x(comparison.median)}" y1="20" x2="${x(comparison.median)}" y2="${axisY}" class="peer-median-line" />` : '';
    const diamond = `${currentX},20 ${currentX + 8},28 ${currentX},36 ${currentX - 8},28`;
    return `
      <svg class="peer-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="你的改进收益与匿名同伴分布">
        <line x1="${left}" y1="${axisY}" x2="${width - right}" y2="${axisY}" class="peer-axis" />
        ${medianLine}${dots}
        <polygon points="${diamond}" class="current-diamond"><title>你的结果：${format(comparison.currentValue, comparison.config.digits)} ${comparison.config.unit}</title></polygon>
        <text x="${left}" y="${axisY + 22}" class="peer-axis-label">${format(min, comparison.config.digits)}</text>
        <text x="${width - right}" y="${axisY + 22}" text-anchor="end" class="peer-axis-label">${format(max, comparison.config.digits)} ${comparison.config.unit}</text>
        <text x="${currentX}" y="12" text-anchor="middle" class="peer-current-label">你</text>
      </svg>`;
  }

  function comparisonCardHtml(comparison) {
    const config = comparison.config;
    if (!comparison.ready) return `<article class="peer-card"><h4>${logic.escapeHtml(config.label)}</h4><div class="alert alert-warning">${logic.escapeHtml(comparison.reason)}</div></article>`;
    if (!comparison.n) {
      return `
        <article class="peer-card">
          <div class="peer-card-heading"><div><p class="small muted">${logic.escapeHtml(config.metricLabel)}</p><h4>${logic.escapeHtml(config.label)}</h4></div><strong>${format(comparison.currentValue, config.digits)} <small>${logic.escapeHtml(config.unit)}</small></strong></div>
          <div class="alert alert-warning">目前没有可用于比较的其他完整正式样本。你的结果已经显示，后续样本增加后可重新打开本页查看。</div>
        </article>`;
    }
    const percentile = Math.round(comparison.percentile);
    const interpretation = percentile >= 50 ? `该改进收益高于约 ${percentile}% 的匿名同伴` : `该改进收益位于匿名同伴的约第 ${percentile} 百分位`;
    return `
      <article class="peer-card">
        <div class="peer-card-heading"><div><p class="small muted">${logic.escapeHtml(config.metricLabel)}</p><h4>${logic.escapeHtml(config.label)}</h4></div><strong>${format(comparison.currentValue, config.digits)} <small>${logic.escapeHtml(config.unit)}</small></strong></div>
        <p class="peer-rank">${logic.escapeHtml(interpretation)}</p>
        ${distributionSvg(comparison)}
        <div class="peer-summary"><span>同伴 <strong>${comparison.n}</strong> 人</span><span>同伴中位数 <strong>${format(comparison.median, config.digits)}</strong></span><span>中间 50% <strong>${format(comparison.q1, config.digits)}–${format(comparison.q3, config.digits)}</strong></span></div>
      </article>`;
  }

  function comparisonsHtml(comparisons) {
    return `
      <div class="peer-legend"><span><i class="legend-current"></i>你的结果</span><span><i class="legend-peer"></i>其他匿名被试</span><span><i class="legend-median"></i>同伴中位数</span></div>
      <div class="peer-grid">${comparisons.map(comparisonCardHtml).join('')}</div>
      <p class="small muted peer-footnote">比较仅使用每名匿名被试最后一条完整正式记录。Flanker 与视觉搜索总体正确率低于 60% 的记录不进入收益比较；错误、超时及过快试次按事前规则处理。百分位只描述当前样本中的相对位置，不代表能力诊断。</p>`;
  }

  root.analysis = {
    EXPERIMENTS, quantile, overallAccuracy, latestCompleteRecords, recordMetric,
    compareWithPeers, fetchExperimentRecords, loadComparisons,
    distributionSvg, comparisonCardHtml, comparisonsHtml
  };
})(typeof window !== 'undefined' ? window : globalThis);
