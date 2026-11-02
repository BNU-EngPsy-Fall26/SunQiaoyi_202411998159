(function registerFlanker(global) {
  'use strict';

  const root = global.HW2;
  const logic = root.logic;

  function makeTrial(layout, congruency, targetDirection, isPractice = false) {
    const flankerDirection = congruency === 'congruent'
      ? targetDirection
      : (targetDirection === 'left' ? 'right' : 'left');
    return {
      layout,
      congruency,
      target_direction: targetDirection,
      flanker_direction: flankerDirection,
      correct_key: targetDirection === 'left' ? 'KeyF' : 'KeyJ',
      is_practice: isPractice
    };
  }

  function buildTrials(rng, repetitionsPerCell = 12, isPractice = false) {
    const trials = [];
    for (const layout of ['plain', 'isolated']) {
      for (const congruency of ['congruent', 'incongruent']) {
        for (let i = 0; i < repetitionsPerCell; i += 1) {
          const targetDirection = i % 2 === 0 ? 'left' : 'right';
          trials.push(makeTrial(layout, congruency, targetDirection, isPractice));
        }
      }
    }
    return logic.shuffleConstrained(trials, (trial) => trial.correct_key, 3, rng);
  }

  function arrowsHtml(trial) {
    const target = trial.target_direction === 'left' ? '&lt;' : '&gt;';
    const flanker = trial.flanker_direction === 'left' ? '&lt;' : '&gt;';
    return `
      <div class="flanker-row" aria-label="中央箭头判断刺激">
        <span class="flanker-arrow">${flanker}</span>
        <span class="flanker-arrow">${flanker}</span>
        <span class="flanker-arrow ${trial.layout === 'isolated' ? 'target-isolated' : ''}">${target}</span>
        <span class="flanker-arrow">${flanker}</span>
        <span class="flanker-arrow">${flanker}</span>
      </div>`;
  }

  async function runTrial(ctx, trial, index, total, rng) {
    const phase = trial.is_practice ? '练习' : '正式实验';
    ctx.renderStage({
      title: 'Flanker 目标判断',
      phase,
      current: index + 1,
      total,
      content: '<div class="fixation">+</div>'
    });
    await logic.sleep(400);

    ctx.renderStage({ title: 'Flanker 目标判断', phase, current: index + 1, total, content: '' });
    await logic.sleep(200);

    ctx.renderStage({
      title: 'Flanker 目标判断',
      phase,
      current: index + 1,
      total,
      content: arrowsHtml(trial)
    });
    await logic.nextPaint();
    const response = await logic.timedKeyResponse(['KeyF', 'KeyJ'], 1500);
    const correct = response.key === trial.correct_key ? 1 : 0;

    if (trial.is_practice || !correct) {
      const message = response.timeout ? '太慢了' : (correct ? '正确' : '错误');
      ctx.renderStage({
        title: 'Flanker 目标判断',
        phase,
        current: index + 1,
        total,
        content: `<div class="feedback">${message}</div>`
      });
      await logic.sleep(trial.is_practice ? 450 : 300);
    }

    await logic.sleep(300 + Math.floor(rng() * 201));
    return {
      trial_index: index + 1,
      block: 1,
      congruency: trial.congruency,
      layout: trial.layout,
      target_direction: trial.target_direction,
      flanker_direction: trial.flanker_direction,
      key: response.key || '',
      correct,
      rt: Number.isFinite(response.rt) ? Math.round(response.rt) : null,
      timeout: response.timeout,
      focus_lost: response.focus_lost
    };
  }

  async function run(ctx) {
    ctx.setHeaderStatus('实验 1/3 · Flanker');
    await ctx.showInstructions({
      eyebrow: '实验一 · 选择性注意',
      title: '判断中央箭头的方向',
      html: `
        <p class="lead">屏幕中央会出现五个箭头。只判断最中间箭头的方向，忽略两侧箭头。</p>
        <div class="instruction-grid">
          <div class="instruction-card"><h3><kbd>F</kbd> 向左</h3><p>中央箭头朝左时按 F。</p></div>
          <div class="instruction-card"><h3><kbd>J</kbd> 向右</h3><p>中央箭头朝右时按 J。</p></div>
        </div>
        <div class="alert alert-info">请将左右食指放在 F 和 J 上。尽量快速并准确作答。实验中不要切换窗口。</div>`,
      buttonText: '开始练习'
    });

    const practiceRng = logic.seededRng(ctx.seed ^ 0xF1A7);
    const practice = buildTrials(practiceRng, 2, true);
    for (let i = 0; i < practice.length; i += 1) {
      await runTrial(ctx, practice[i], i, practice.length, practiceRng);
    }

    await ctx.showInstructions({
      eyebrow: '练习完成',
      title: '准备进入正式实验',
      html: '<p class="lead">正式实验共有 48 次。练习数据不会上传。正式实验中只有错误或超时时显示简短反馈。</p>',
      buttonText: '开始正式实验'
    });

    const rng = logic.seededRng(ctx.seed ^ 0xA11CE);
    const plan = buildTrials(rng, 12, false);
    const trials = [];
    for (let i = 0; i < plan.length; i += 1) {
      trials.push(await runTrial(ctx, plan[i], i, plan.length, rng));
    }

    return {
      experiment: 'flanker_grouping',
      label: 'Flanker 目标视觉隔离',
      trials,
      summary: logic.summarizeFlanker(trials)
    };
  }

  root.experiments.flanker = { run, buildTrials };
})(window);
