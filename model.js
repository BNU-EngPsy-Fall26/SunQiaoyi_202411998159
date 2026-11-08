(function initSearchModel(global) {
  'use strict';

  const root = global.HW2 = global.HW2 || {};
  const logic = root.logic;
  const TYPES = ['feature', 'conjunction_grouped', 'conjunction_mixed'];
  const TYPE_META = {
    feature: { label: '特征搜索', color: 'var(--blue)' },
    conjunction_grouped: { label: '颜色分区', color: 'var(--green)' },
    conjunction_mixed: { label: '混合联合', color: 'var(--red)' }
  };
  const PREDICTED = {
    feature: 0,
    conjunction_grouped: 0.5,
    conjunction_mixed: 1
  };

  // 课程 CSV 的 meta 字段可能包含逗号和转义引号，因此不能直接按逗号切分。
  function parseCsv(text) {
    const input = String(text || '').replace(/^\uFEFF/, '');
    const matrix = [];
    let row = [];
    let field = '';
    let quoted = false;

    for (let i = 0; i < input.length; i += 1) {
      const char = input[i];
      if (quoted) {
        if (char === '"' && input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          field += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\n') {
        row.push(field.replace(/\r$/, ''));
        matrix.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }

    if (field.length || row.length) {
      row.push(field.replace(/\r$/, ''));
      matrix.push(row);
    }
    if (!matrix.length) return [];

    const headers = matrix[0].map((header) => header.trim());
    return matrix.slice(1)
      .filter((values) => values.some((value) => value !== ''))
      .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
  }

  function numberOrNull(value) {
    if (value === '' || value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function correctValue(value) {
    return value === true || value === 1 || /^(1|true)$/i.test(String(value));
  }

  // 同一匿名编号可能重复完成实验；分析时优先保留最后一条完整记录。
  function latestParticipantRecords(rows) {
    const formal = rows.filter((row) => row.experiment === 'visual_search_grouping' && row.participant);
    const byParticipant = new Map();

    for (const row of formal) {
      const participant = row.participant;
      const recordId = row.record_id || `${row.created_at || ''}|${participant}`;
      if (!byParticipant.has(participant)) byParticipant.set(participant, new Map());
      const records = byParticipant.get(participant);
      if (!records.has(recordId)) records.set(recordId, []);
      records.get(recordId).push(row);
    }

    const selected = [];
    for (const [participant, records] of byParticipant.entries()) {
      const candidates = [...records.entries()].map(([recordId, recordRows]) => ({
        participant,
        recordId,
        rows: recordRows,
        complete: recordRows.length >= 60,
        createdAt: recordRows.reduce((latest, item) => item.created_at > latest ? item.created_at : latest, '')
      }));
      candidates.sort((a, b) => {
        if (a.complete !== b.complete) return a.complete ? -1 : 1;
        return b.createdAt.localeCompare(a.createdAt) || String(b.recordId).localeCompare(String(a.recordId));
      });
      if (candidates[0]) selected.push(candidates[0]);
    }
    return selected;
  }

  function participantSummaries(rows) {
    return latestParticipantRecords(rows).map((record) => {
      const trials = record.rows.map((row) => ({
        search_type: row.search_type,
        set_size: numberOrNull(row.set_size),
        rt: numberOrNull(row.rt),
        correct: correctValue(row.correct) ? 1 : 0,
        timeout: /^(1|true)$/i.test(String(row.timeout))
      }));
      const summary = logic.summarizeSearch(trials);
      return {
        participant: record.participant,
        recordId: record.recordId,
        rowCount: record.rows.length,
        complete: record.complete,
        summary
      };
    });
  }

  function comparisonFromSummaries(summaries) {
    const valid = summaries.filter((item) => item.complete && TYPES.every((type) => {
      const cell = item.summary.cells[type];
      return cell && Number.isFinite(cell[8].median_rt) && Number.isFinite(cell[24].median_rt);
    }));

    const participantDeltas = valid.map((item) => ({
      participant: item.participant,
      values: Object.fromEntries(TYPES.map((type) => [
        type,
        item.summary.cells[type][24].median_rt - item.summary.cells[type][8].median_rt
      ]))
    }));
    const deltas = Object.fromEntries(TYPES.map((type) => [
      type,
      logic.mean(participantDeltas.map((item) => item.values[type]))
    ]));
    // 混合联合搜索是标定条件；特征和分组条件用于检验模型的独立预测。
    const mixedDelta = deltas.conjunction_mixed;
    const ready = valid.length > 0 && Number.isFinite(mixedDelta) && mixedDelta > 0;
    const actual = ready
      ? Object.fromEntries(TYPES.map((type) => [type, deltas[type] / mixedDelta]))
      : null;
    const points = ready
      ? participantDeltas.map((item) => ({
        participant: item.participant,
        values: Object.fromEntries(TYPES.map((type) => [type, item.values[type] / mixedDelta]))
      }))
      : [];
    const testedTypes = ['feature', 'conjunction_grouped'];
    const rmse = ready ? Math.sqrt(logic.mean(testedTypes.map((type) => (actual[type] - PREDICTED[type]) ** 2))) : null;

    return {
      ready,
      n: valid.length,
      excluded: summaries.length - valid.length,
      predicted: { ...PREDICTED },
      actual,
      points,
      deltas,
      slopeRatio: ready ? deltas.conjunction_grouped / mixedDelta : null,
      orderMatch: ready
        ? deltas.feature < deltas.conjunction_grouped && deltas.conjunction_grouped < deltas.conjunction_mixed
        : false,
      rmse
    };
  }

  function comparisonFromTrials(trials) {
    return comparisonFromSummaries([{
      participant: 'current',
      complete: trials.length >= 60,
      summary: logic.summarizeSearch(trials)
    }]);
  }

  function fmt(value, digits = 2) {
    return Number.isFinite(value) ? value.toFixed(digits) : '—';
  }

  function chartSvg(comparison, compact = false) {
    const width = 820;
    const height = compact ? 390 : 450;
    const margin = { top: 54, right: 40, bottom: 76, left: 78 };
    const x8 = margin.left;
    const x24 = width - margin.right;
    const actualValues = comparison.ready
      ? [...Object.values(comparison.actual), ...comparison.points.flatMap((item) => Object.values(item.values))]
      : [];
    const allValues = [0, 0.5, 1, ...actualValues].filter(Number.isFinite);
    const yMin = Math.min(-0.2, Math.floor((Math.min(...allValues) - 0.08) * 4) / 4);
    const yMax = Math.max(1.2, Math.ceil((Math.max(...allValues) + 0.08) * 4) / 4);
    const plotTop = margin.top;
    const plotBottom = height - margin.bottom;
    const y = (value) => plotBottom - ((value - yMin) / (yMax - yMin)) * (plotBottom - plotTop);
    const ticks = [];
    for (let value = Math.ceil(yMin * 4) / 4; value <= yMax + 0.001; value += 0.25) ticks.push(value);

    const grid = ticks.map((value) => `
      <line x1="${margin.left}" y1="${y(value)}" x2="${width - margin.right}" y2="${y(value)}" class="model-grid-line" />
      <text x="${margin.left - 12}" y="${y(value) + 4}" text-anchor="end" class="model-axis-text">${fmt(value, 2)}</text>`).join('');

    const series = TYPES.map((type, index) => {
      const meta = TYPE_META[type];
      const predictedY = y(comparison.predicted[type]);
      const diamond = `${x24},${predictedY - 7} ${x24 + 7},${predictedY} ${x24},${predictedY + 7} ${x24 - 7},${predictedY}`;
      const actualLine = comparison.ready ? `
        <path d="M ${x8} ${y(0)} L ${x24} ${y(comparison.actual[type])}" fill="none" stroke="${meta.color}" stroke-width="3" />
        <circle cx="${x24}" cy="${y(comparison.actual[type])}" r="6" fill="${meta.color}" stroke="var(--paper)" stroke-width="2" />` : '';
      const pointMarks = comparison.ready ? comparison.points.map((item, pointIndex) => {
        const jitter = ((pointIndex % 7) - 3) * 3 + (index - 1) * 2;
        return `<circle cx="${x24 + jitter}" cy="${y(item.values[type])}" r="4" fill="${meta.color}" fill-opacity="0.34"><title>${logic.escapeHtml(item.participant)}：${fmt(item.values[type], 2)}</title></circle>`;
      }).join('') : '';
      return `
        <path d="M ${x8} ${y(0)} L ${x24} ${predictedY}" fill="none" stroke="${meta.color}" stroke-width="2" stroke-dasharray="8 7" opacity="0.82" />
        <polygon points="${diamond}" fill="var(--paper)" stroke="${meta.color}" stroke-width="2" />
        ${actualLine}${pointMarks}`;
    }).join('');

    return `
      <svg class="model-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="model-chart-title model-chart-desc">
        <title id="model-chart-title">视觉搜索范围模型预测与实测</title>
        <desc id="model-chart-desc">横轴为集合大小，纵轴为相对混合联合搜索标准化后的反应时增量。虚线菱形表示事前模型预测，实线圆点表示实测结果。</desc>
        <rect x="${margin.left}" y="${plotTop}" width="${x24 - margin.left}" height="${plotBottom - plotTop}" class="model-chart-frame" />
        ${grid}
        <line x1="${x8}" y1="${plotBottom}" x2="${x24}" y2="${plotBottom}" class="model-axis-line" />
        <line x1="${margin.left}" y1="${plotTop}" x2="${margin.left}" y2="${plotBottom}" class="model-axis-line" />
        ${series}
        <text x="${x8}" y="${plotBottom + 28}" text-anchor="middle" class="model-axis-text">8</text>
        <text x="${x24}" y="${plotBottom + 28}" text-anchor="middle" class="model-axis-text">24</text>
        <text x="${(x8 + x24) / 2}" y="${height - 22}" text-anchor="middle" class="model-axis-title">集合大小（项目数）</text>
        <text x="20" y="${(plotTop + plotBottom) / 2}" text-anchor="middle" class="model-axis-title" transform="rotate(-90 20 ${(plotTop + plotBottom) / 2})">标准化搜索成本</text>
      </svg>`;
  }

  function legendHtml(hasActual) {
    const conditions = TYPES.map((type) => `<span class="model-legend-item"><i style="color:${TYPE_META[type].color}"></i>${TYPE_META[type].label}</span>`).join('');
    return `<div class="model-legend" aria-label="图例">${conditions}<span class="model-line-key dashed">理论参照</span>${hasActual ? '<span class="model-line-key solid">实测结果</span>' : ''}</div>`;
  }

  function resultPanelHtml(comparison) {
    if (!comparison.ready) {
      return `<section class="model-result-section"><p class="eyebrow">理论模型</p><h3>视觉搜索范围模型</h3><div class="alert alert-warning">有效正确试次不足，暂时无法计算模型与实测对照。</div></section>`;
    }
    return `
      <section class="model-result-section">
        <div class="model-section-heading">
          <div><p class="eyebrow">额外模型可视化</p><h3>视觉搜索范围模型与本次实测</h3></div>
          <p class="small muted">混合联合搜索用于标定，模型独立预测特征搜索和颜色分区条件。</p>
        </div>
        <div class="model-metrics">
          <div><span>分组/混合斜率比</span><strong>${fmt(comparison.slopeRatio, 2)}</strong><small>模型预测 0.50</small></div>
          <div><span>条件顺序</span><strong>${comparison.orderMatch ? '符合' : '未符合'}</strong><small>特征 &lt; 分组 &lt; 混合</small></div>
          <div><span>模型偏差 RMSE</span><strong>${fmt(comparison.rmse, 2)}</strong><small>标准化单位</small></div>
        </div>
        <div class="model-chart-wrap">${chartSvg(comparison, true)}</div>
        ${legendHtml(true)}
      </section>`;
  }

  function initModelPage() {
    const app = global.document && document.getElementById('model-app');
    if (!app) return;
    const input = document.getElementById('model-csv');
    const chart = document.getElementById('model-chart');
    const legend = document.getElementById('model-legend');
    const status = document.getElementById('model-status');
    const metrics = document.getElementById('model-metrics');
    const tableBody = document.getElementById('model-table-body');

    const theory = comparisonFromSummaries([]);
    chart.innerHTML = chartSvg(theory);
    legend.innerHTML = legendHtml(false);

    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const rows = parseCsv(await file.text());
        const formalRows = rows.filter((row) => row.experiment === 'visual_search_grouping');
        const summaries = participantSummaries(rows);
        const comparison = comparisonFromSummaries(summaries);
        chart.innerHTML = chartSvg(comparison);
        legend.innerHTML = legendHtml(comparison.ready);

        if (!formalRows.length) {
          status.className = 'alert alert-warning';
          status.textContent = `读取 ${rows.length} 行，但没有正式 visual_search_grouping 记录。test_ 数据按计划排除。`;
        } else if (!comparison.ready) {
          status.className = 'alert alert-warning';
          status.textContent = `找到 ${summaries.length} 名被试，但没有满足完整试次和有效反应时要求的记录。`;
        } else {
          status.className = comparison.n >= 5 ? 'alert alert-success' : 'alert alert-warning';
          status.textContent = `已纳入 ${comparison.n} 名完整被试${comparison.n < 5 ? '，尚未达到课程要求的 5 人' : '，达到课程最低样本要求'}。排除 ${comparison.excluded} 条不完整记录。`;
        }

        metrics.innerHTML = comparison.ready ? `
          <div><span>有效被试</span><strong>${comparison.n}</strong><small>最低要求 5 人</small></div>
          <div><span>分组/混合斜率比</span><strong>${fmt(comparison.slopeRatio, 2)}</strong><small>模型预测 0.50</small></div>
          <div><span>模型偏差 RMSE</span><strong>${fmt(comparison.rmse, 2)}</strong><small>越接近 0 越好</small></div>` : '';

        tableBody.innerHTML = TYPES.map((type) => `
          <tr>
            <th scope="row">${TYPE_META[type].label}</th>
            <td>${fmt(PREDICTED[type], 2)}</td>
            <td>${comparison.ready ? fmt(comparison.actual[type], 2) : '—'}</td>
            <td>${comparison.ready ? fmt(comparison.deltas[type], 1) : '—'}</td>
          </tr>`).join('');
      } catch (error) {
        status.className = 'alert alert-error';
        status.textContent = `CSV 读取失败：${error.message}`;
      }
    });
  }

  root.model = {
    TYPES,
    PREDICTED,
    parseCsv,
    participantSummaries,
    comparisonFromSummaries,
    comparisonFromTrials,
    chartSvg,
    legendHtml,
    resultPanelHtml
  };

  if (global.document) global.addEventListener('DOMContentLoaded', initModelPage);
})(typeof window !== 'undefined' ? window : globalThis);
