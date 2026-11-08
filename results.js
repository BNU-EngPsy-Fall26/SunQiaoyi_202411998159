(function renderFormalResults(global) {
  'use strict';

  const data = global.HW2_FORMAL_RESULTS;
  const app = document.getElementById('results-app');

  function fmt(value, digits = 1) {
    if (!Number.isFinite(value)) return '—';
    return Number(value).toFixed(digits).replace(/\.0$/, '');
  }

  function pText(value) {
    if (value < 0.001) return 'p < .001';
    return `p = ${value.toFixed(3).replace(/^0/, '')}`;
  }

  function statusBadge(experiment) {
    if (experiment.improvement.effective) return '<span class="result-verdict is-effective">改进有效</span>';
    return '<span class="result-verdict is-ineffective">改进未奏效</span>';
  }

  function classicBadge(experiment) {
    if (experiment.classic.supported === true) return '<span class="classic-status replicated">经典效应复现</span>';
    if (experiment.classic.supported === false) return '<span class="classic-status not-replicated">经典效应未复现</span>';
    return '<span class="classic-status directional">方向一致，证据有限</span>';
  }

  function lineChart(experiment) {
    const width = 760;
    const height = 350;
    const margin = { left: 62, right: 22, top: 28, bottom: 58 };
    const values = experiment.rows.flatMap((row) => experiment.conditions.map((condition) => row[condition.key]));
    values.push(0);
    let min = Math.min(...values);
    let max = Math.max(...values);
    const span = max - min || 1;
    min -= span * 0.12;
    max += span * 0.12;
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const x = (index) => margin.left + (experiment.conditions.length === 1 ? plotWidth / 2 : index / (experiment.conditions.length - 1) * plotWidth);
    const y = (value) => margin.top + (max - value) / (max - min) * plotHeight;
    const ticks = Array.from({ length: 5 }, (_, index) => min + index * (max - min) / 4);

    const grid = ticks.map((value) => `
      <line x1="${margin.left}" y1="${y(value)}" x2="${width - margin.right}" y2="${y(value)}" class="formal-grid-line" />
      <text x="${margin.left - 10}" y="${y(value) + 4}" text-anchor="end" class="formal-axis-text">${fmt(value)}</text>`).join('');

    const people = experiment.rows.map((row) => {
      const points = experiment.conditions.map((condition, index) => `${x(index)},${y(row[condition.key])}`).join(' ');
      const circles = experiment.conditions.map((condition, index) => `<circle cx="${x(index)}" cy="${y(row[condition.key])}" r="4" class="formal-person-dot"><title>${row.p}：${fmt(row[condition.key], 2)} ${experiment.unit}</title></circle>`).join('');
      return `<polyline points="${points}" class="formal-person-line" />${circles}`;
    }).join('');

    const meanPoints = experiment.conditions.map((condition, index) => `${x(index)},${y(experiment.means[condition.key])}`).join(' ');
    const meanDots = experiment.conditions.map((condition, index) => `<circle cx="${x(index)}" cy="${y(experiment.means[condition.key])}" r="7" class="formal-mean-dot"><title>群体均值：${fmt(experiment.means[condition.key], 2)} ${experiment.unit}</title></circle>`).join('');
    const labels = experiment.conditions.map((condition, index) => `<text x="${x(index)}" y="${height - 24}" text-anchor="middle" class="formal-axis-label">${condition.label}</text>`).join('');
    const zero = min <= 0 && max >= 0 ? `<line x1="${margin.left}" y1="${y(0)}" x2="${width - margin.right}" y2="${y(0)}" class="formal-zero-line" />` : '';

    return `
      <div class="formal-chart-wrap">
        <svg class="formal-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${experiment.title}的个体数据与群体均值">
          ${grid}${zero}${people}
          <polyline points="${meanPoints}" class="formal-mean-line" />${meanDots}${labels}
          <text x="18" y="${height / 2}" text-anchor="middle" transform="rotate(-90 18 ${height / 2})" class="formal-axis-title">${experiment.unit}</text>
        </svg>
        <div class="formal-legend"><span><i class="person-key"></i>匿名被试</span><span><i class="mean-key"></i>群体均值</span></div>
      </div>`;
  }

  function sourceLinks(experiment) {
    const links = [`<a href="${experiment.source.url}" target="_blank" rel="noopener">${experiment.source.label}</a>`];
    if (experiment.secondarySource) links.push(`<a href="${experiment.secondarySource.url}" target="_blank" rel="noopener">${experiment.secondarySource.label}</a>`);
    return links.join('；');
  }

  function experimentSection(experiment) {
    const result = experiment.improvement;
    return `
      <section class="panel formal-experiment">
        <div class="formal-section-heading">
          <div><p class="eyebrow">${experiment.eyebrow}</p><h2>${experiment.title}</h2></div>
          <div class="formal-badges">${classicBadge(experiment)}${statusBadge(experiment)}</div>
        </div>
        <div class="formal-layout">
          ${lineChart(experiment)}
          <aside class="effect-summary ${result.effective ? 'positive' : 'neutral'}">
            <span>${result.label}</span>
            <strong>${fmt(result.value, 2)} <small>${experiment.unit}</small></strong>
            <p>95% CI [${fmt(result.ci[0], 2)}, ${fmt(result.ci[1], 2)}]</p>
            <p>t(11) = ${fmt(result.t, 2)}，${pText(result.p)}，dz = ${fmt(result.dz, 2)}</p>
          </aside>
        </div>
        <div class="comparison-grid">
          <article><h3>经典效应与原文对照</h3><p>${experiment.classic.result}</p><p>${experiment.classic.comparison}</p><p class="source-line">原文：${sourceLinks(experiment)}</p></article>
          <article class="conclusion-card ${result.effective ? 'positive' : 'neutral'}"><h3>改进条件结论</h3><p>${result.conclusion}</p></article>
        </div>
      </section>`;
  }

  function hypothesisTable(hypotheses) {
    const rows = hypotheses.map((item) => `
      <tr>
        <th scope="row">${item.id}</th>
        <td><strong>${item.experiment}</strong><span>${item.result}</span></td>
        <td><span class="hypothesis-verdict ${item.tone}">${item.verdict}</span></td>
      </tr>`).join('');
    return `
      <section class="panel formal-hypotheses">
        <p class="eyebrow">事前预测核对</p>
        <h2>H1–H9 的检验结果</h2>
        <p class="section-intro">判断沿用收数前写入 README 的预测。部分支持表示方向或其中一个指标符合预测，但证据不完整。</p>
        <div class="hypothesis-table-wrap">
          <table class="hypothesis-table">
            <thead><tr><th>预测</th><th>正式数据</th><th>判断</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>`;
  }

  const experiments = Object.values(data.experiments);
  app.innerHTML = `
    <section class="panel formal-hero">
      <p class="eyebrow">正式数据分析 · ${data.frozenAt}</p>
      <h1>三个实验的群体结果</h1>
      <p class="lead">分析以被试为单位，先计算每人的条件指标与改进收益，再进行配对检验。经典效应和新增改进分别判断。</p>
      <div class="formal-overview">
        <div><span>有效样本</span><strong>${data.n} 人</strong><small>三个实验均完整</small></div>
        <div><span>正式试次</span><strong>${data.totalTrials}</strong><small>每人 48 + 60 + 36</small></div>
        <div><span>主要排除</span><strong>${data.exclusions.fastGraphical} 试次</strong><small>图形判断 RT &lt; 300 ms</small></div>
        <div><span>改进有效</span><strong>1 / 3</strong><small>颜色分区获得支持</small></div>
      </div>
      <div class="overall-conclusion">
        <strong>总览结论</strong>
        <p>视觉搜索的颜色分区显著降低搜索斜率，且 12 名被试方向一致。目标框没有降低 Flanker 干扰，角度参照线也没有降低比例判断误差。</p>
      </div>
    </section>
    ${hypothesisTable(data.hypotheses)}
    ${experiments.map(experimentSection).join('')}
    <section class="panel formal-method">
      <p class="eyebrow">数据清理与解释边界</p>
      <h2>分析说明</h2>
      <ul>
        <li>Flanker 与视觉搜索的反应时只纳入正确且不低于 150 ms 的试次；无人低于 60% 正确率。</li>
        <li>图形判断排除 ${data.exclusions.fastGraphical} 个低于 300 ms 的试次；另有 ${data.exclusions.focusLostGraphical} 个失焦试次保留标记。</li>
        <li>共 ${data.n} 名有效被试，无缺失记录、无超时、条件数量平衡。</li>
        <li>置信区间为被试内效应的 t 分布 95% 区间；p 值来自双侧单样本 t 检验，效应量为 Cohen's dz。</li>
        <li>本研究刺激、样本和设备与原文不同，因此比较以效应方向和条件排序为主，不直接比较绝对数值。</li>
      </ul>
      <div class="actions"><a class="btn btn-primary" href="./index.html">返回实验首页</a><a class="btn btn-secondary" href="./model.html">查看视觉搜索模型</a></div>
    </section>`;
})(window);
