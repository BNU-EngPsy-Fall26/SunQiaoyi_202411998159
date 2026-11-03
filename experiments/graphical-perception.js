(function registerGraphicalPerception(global) {
  'use strict';

  const root = global.HW2;
  const logic = root.logic;
  const ENCODINGS = ['bar_common', 'angle_plain', 'angle_guided'];
  const RATIOS = [22, 28, 34, 39, 45, 51, 57, 63, 68, 73, 77, 80];

  function encodingLabel(encoding) {
    return {
      bar_common: '共同尺度条形',
      angle_plain: '纯角度',
      angle_guided: '角度与参考线'
    }[encoding];
  }

  function makePairs(rng, count) {
    const ratios = logic.shuffle(RATIOS, rng).slice(0, count);
    return ratios.map((ratio, index) => {
      const larger = 72 + Math.floor(rng() * 24);
      const smaller = Math.max(12, Math.round(larger * ratio / 100));
      return { pair_id: index + 1, smaller, larger };
    });
  }

  // 同一组比例材料在三种编码中重复出现，左右大小交替，便于进行被试内配对比较。
  function buildTrials(rng, repetitionsPerCondition = 12, isPractice = false) {
    const pairs = makePairs(rng, repetitionsPerCondition);
    const trials = [];
    ENCODINGS.forEach((encoding, encodingIndex) => {
      pairs.forEach((pair, pairIndex) => {
        const swap = (pairIndex + encodingIndex) % 2 === 1;
        const valueA = swap ? pair.larger : pair.smaller;
        const valueB = swap ? pair.smaller : pair.larger;
        trials.push({
          pair_id: pair.pair_id,
          encoding,
          value_a: valueA,
          value_b: valueB,
          true_ratio: Math.round((Math.min(valueA, valueB) / Math.max(valueA, valueB)) * 100),
          is_practice: isPractice
        });
      });
    });
    return logic.shuffleConstrained(trials, (trial) => trial.encoding, 2, rng);
  }

  function polarPoint(cx, cy, radius, degrees) {
    const radians = (degrees - 90) * Math.PI / 180;
    return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
  }

  function sectorPath(value) {
    const cx = 90;
    const cy = 90;
    const radius = 66;
    const angle = value / 100 * 360;
    const start = polarPoint(cx, cy, radius, 0);
    const end = polarPoint(cx, cy, radius, angle);
    const largeArc = angle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
  }

  function guideLines() {
    return [25, 50, 75].map((value) => {
      const point = polarPoint(90, 90, 72, value / 100 * 360);
      const label = polarPoint(90, 90, 83, value / 100 * 360);
      return `
        <line x1="90" y1="90" x2="${point.x.toFixed(2)}" y2="${point.y.toFixed(2)}" stroke="#718096" stroke-width="1.2" stroke-dasharray="3 3" />
        <text x="${label.x.toFixed(2)}" y="${label.y.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="#667085" font-size="9">${value}</text>`;
    }).join('');
  }

  function sectorSvg(value, guided, label) {
    return `
      <svg class="sector-svg" viewBox="0 0 180 180" role="img" aria-label="图形 ${label}">
        <circle cx="90" cy="90" r="66" fill="#f3f6fa" stroke="#9aa8ba" stroke-width="1.5" />
        <path d="${sectorPath(value)}" fill="#2c73cf" opacity="0.94" />
        ${guided ? guideLines() : ''}
        <circle cx="90" cy="90" r="3" fill="#102f5f" />
      </svg>`;
  }

  function barCard(label, value) {
    return `
      <div class="chart-card">
        <h3>图形 ${label}</h3>
        <div class="bar-chart">
          <div class="bar-scale"><div class="bar-value" style="width:${value}%"></div></div>
        </div>
      </div>`;
  }

  function angleCard(label, value, guided) {
    return `
      <div class="chart-card">
        <h3>图形 ${label}</h3>
        ${sectorSvg(value, guided, label)}
      </div>`;
  }

  function chartsHtml(trial) {
    if (trial.encoding === 'bar_common') {
      return barCard('A', trial.value_a) + barCard('B', trial.value_b);
    }
    const guided = trial.encoding === 'angle_guided';
    return angleCard('A', trial.value_a, guided) + angleCard('B', trial.value_b, guided);
  }

  function waitForEstimate() {
    return new Promise((resolve) => {
      const form = document.getElementById('estimate-form');
      const input = document.getElementById('estimate-input');
      const error = document.getElementById('estimate-error');
      // runTrial 已等待两帧绘制；此处从输入框可交互时开始计时，并记录期间是否失焦。
      const startedAt = performance.now();
      let focusLost = false;

      function onBlur() { focusLost = true; }
      function onVisibility() { if (document.hidden) focusLost = true; }
      function cleanup() {
        window.removeEventListener('blur', onBlur);
        document.removeEventListener('visibilitychange', onVisibility);
      }

      window.addEventListener('blur', onBlur);
      document.addEventListener('visibilitychange', onVisibility);
      input.focus({ preventScroll: true });

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const estimate = Number(input.value);
        if (!Number.isFinite(estimate) || estimate < 0 || estimate > 100) {
          error.textContent = '请输入 0–100 之间的数字。';
          input.focus();
          return;
        }
        cleanup();
        resolve({ estimate, rt: performance.now() - startedAt, focus_lost: focusLost });
      }, { once: false });
    });
  }

  async function runTrial(ctx, trial, index, total) {
    const phase = trial.is_practice ? '练习' : '正式实验';
    ctx.renderStage({
      title: `比例判断 · ${encodingLabel(trial.encoding)}`,
      phase,
      current: index + 1,
      total,
      content: `
        <div class="estimate-wrap">
          <div class="estimate-charts">${chartsHtml(trial)}</div>
          <form class="estimate-form" id="estimate-form" novalidate>
            <label>较小值是较大值的百分之多少？
              <input class="estimate-input" id="estimate-input" type="number" min="0" max="100" step="1" inputmode="numeric" autocomplete="off" aria-describedby="estimate-error">
            </label>
            <button class="btn btn-primary" type="submit">提交估计</button>
          </form>
          <div id="estimate-error" class="small danger-text" style="min-height:24px;margin-top:8px"></div>
        </div>`
    });
    // 保证图形和输入控件都完成绘制后再开放作答。
    await logic.nextPaint();
    const response = await waitForEstimate();
    const absError = Math.abs(response.estimate - trial.true_ratio);
    const logError = Math.log2(absError + 0.125);

    if (trial.is_practice) {
      ctx.renderStage({
        title: `比例判断 · ${encodingLabel(trial.encoding)}`,
        phase,
        current: index + 1,
        total,
        content: `<div class="feedback" style="font-size:30px">真实比例约为 ${trial.true_ratio}%<br><span class="small">你的误差为 ${logic.round(absError, 1)} 个百分点</span></div>`
      });
      await logic.sleep(900);
    } else {
      await logic.sleep(250);
    }

    return {
      trial_index: index + 1,
      pair_id: trial.pair_id,
      encoding: trial.encoding,
      value_a: trial.value_a,
      value_b: trial.value_b,
      true_ratio: trial.true_ratio,
      estimate: response.estimate,
      abs_error: logic.round(absError, 3),
      log_error: logic.round(logError, 4),
      rt: Math.round(response.rt),
      focus_lost: response.focus_lost
    };
  }

  async function run(ctx) {
    ctx.setHeaderStatus('比例判断');
    await ctx.showInstructions({
      eyebrow: '实验三 · 图形知觉',
      title: '估计两个图形的比例',
      html: `
        <p class="lead">每次会出现图形 A 和图形 B。请估计较小值是较大值的百分之多少，并输入 0–100 的整数。</p>
        <div class="context-scene blush">
          <div><p class="context-kicker">应用情境</p><h3>仪表与数据图表的快速判断</h3><p>分析人员经常需要比较两个指标的相对大小。共同尺度、刻度和参考线会影响比例判断的准确程度。</p></div>
          <img src="./assets/images/graphical-perception.png" alt="分析人员使用条形图和角度仪表比较数值">
        </div>
        <div class="instruction-grid">
          <div class="instruction-card"><h3>例：一半</h3><p>如果较小图形约为较大图形的一半，输入 50。</p></div>
          <div class="instruction-card"><h3>保持直觉判断</h3><p>不需要精确计算。请根据图形尽快作答。</p></div>
        </div>
        <div class="alert alert-info">输入数字后按回车或点击“提交估计”。正式实验不会显示正确答案。</div>`,
      buttonText: '开始练习'
    });

    const practiceRng = logic.seededRng(ctx.seed ^ 0x6A2F1);
    const practice = buildTrials(practiceRng, 2, true);
    for (let i = 0; i < practice.length; i += 1) {
      await runTrial(ctx, practice[i], i, practice.length);
    }

    await ctx.showInstructions({
      eyebrow: '练习完成',
      title: '准备进入正式实验',
      html: '<p class="lead">正式实验共有 36 次。三种图形会交错出现。请始终估计较小值相对于较大值的百分比。</p>',
      buttonText: '开始正式实验'
    });

    const rng = logic.seededRng(ctx.seed ^ 0xC1E7E);
    const plan = buildTrials(rng, 12, false);
    const trials = [];
    for (let i = 0; i < plan.length; i += 1) {
      trials.push(await runTrial(ctx, plan[i], i, plan.length));
    }

    return {
      experiment: 'graphical_perception_guides',
      label: '图形比例判断与参考线',
      trials,
      summary: logic.summarizeGraphical(trials)
    };
  }

  root.experiments.graphical = { run, buildTrials, sectorPath };
})(window);
