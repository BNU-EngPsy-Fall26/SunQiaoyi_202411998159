(function registerVisualSearch(global) {
  'use strict';

  const root = global.HW2;
  const logic = root.logic;
  const TYPES = ['feature', 'conjunction_mixed', 'conjunction_grouped'];

  function typeLabel(type) {
    return {
      feature: '特征搜索',
      conjunction_mixed: '混合联合搜索',
      conjunction_grouped: '分组联合搜索'
    }[type];
  }

  function buildTrials(rng, repetitionsPerCell = 10, isPractice = false) {
    const trials = [];
    let sequence = 0;
    for (const searchType of TYPES) {
      for (const setSize of [8, 24]) {
        for (let i = 0; i < repetitionsPerCell; i += 1) {
          const targetDirection = sequence % 2 === 0 ? 'left' : 'right';
          trials.push({
            search_type: searchType,
            set_size: setSize,
            target_direction: targetDirection,
            correct_key: targetDirection === 'left' ? 'KeyF' : 'KeyJ',
            group_side: searchType === 'conjunction_grouped'
              ? (repetitionsPerCell === 1
                ? (sequence % 2 === 0 ? 'left' : 'right')
                : (i < repetitionsPerCell / 2 ? 'left' : 'right'))
              : '',
            is_practice: isPractice
          });
          sequence += 1;
        }
      }
    }
    return logic.shuffleConstrained(trials, (trial) => trial.correct_key, 3, rng);
  }

  function shapeHtml(item) {
    if (!item) return '';
    const direction = item.shape === 'triangle' ? ` ${item.direction || 'right'}` : '';
    return `<span class="shape ${item.shape}${direction} ${item.color}" aria-hidden="true"></span>`;
  }

  function chooseCells(candidates, count, rng) {
    return logic.shuffle(candidates, rng).slice(0, count);
  }

  function buildBoard(trial, rng) {
    const allCells = Array.from({ length: 24 }, (_, index) => index);
    const leftCells = allCells.filter((index) => index % 6 < 3);
    const rightCells = allCells.filter((index) => index % 6 >= 3);
    const redCount = trial.search_type === 'feature' ? 1 : trial.set_size / 2;
    const blueCount = trial.set_size - redCount;
    const target = {
      role: 'target',
      color: 'red',
      shape: 'triangle',
      direction: trial.target_direction
    };

    const redItems = [target];
    const blueItems = [];
    if (trial.search_type === 'feature') {
      for (let i = 0; i < blueCount; i += 1) {
        blueItems.push({ role: 'distractor', color: 'blue', shape: 'circle', direction: '' });
      }
    } else {
      for (let i = 1; i < redCount; i += 1) {
        redItems.push({ role: 'distractor', color: 'red', shape: 'circle', direction: '' });
      }
      for (let i = 0; i < blueCount; i += 1) {
        blueItems.push({
          role: 'distractor',
          color: 'blue',
          shape: 'triangle',
          direction: rng() < 0.5 ? 'left' : 'right'
        });
      }
    }

    const board = Array(24).fill(null);
    if (trial.search_type === 'conjunction_grouped') {
      const redCells = trial.group_side === 'left' ? leftCells : rightCells;
      const blueCells = trial.group_side === 'left' ? rightCells : leftCells;
      const selectedRed = chooseCells(redCells, redItems.length, rng);
      const selectedBlue = chooseCells(blueCells, blueItems.length, rng);
      logic.shuffle(redItems, rng).forEach((item, index) => { board[selectedRed[index]] = item; });
      logic.shuffle(blueItems, rng).forEach((item, index) => { board[selectedBlue[index]] = item; });
    } else {
      const items = logic.shuffle([...redItems, ...blueItems], rng);
      const selected = chooseCells(allCells, trial.set_size, rng);
      items.forEach((item, index) => { board[selected[index]] = item; });
    }

    return {
      board,
      targetCell: board.findIndex((item) => item && item.role === 'target')
    };
  }

  function boardHtml(trial, generated) {
    const grouped = trial.search_type === 'conjunction_grouped' ? ' grouped' : '';
    return `
      <div>
        <div class="search-board${grouped}" aria-label="视觉搜索项目阵列">
          ${generated.board.map((item) => `<div class="search-cell">${shapeHtml(item)}</div>`).join('')}
        </div>
        <p class="small" style="margin:14px 0 0;color:#b9c5d4">找到红色三角形，判断它朝左还是朝右</p>
      </div>`;
  }

  async function runTrial(ctx, trial, index, total, rng) {
    const phase = trial.is_practice ? '练习' : '正式实验';
    ctx.renderStage({
      title: `视觉搜索 · ${typeLabel(trial.search_type)}`,
      phase,
      current: index + 1,
      total,
      content: '<div class="fixation">+</div>'
    });
    await logic.sleep(400);

    const generated = buildBoard(trial, rng);
    ctx.renderStage({
      title: `视觉搜索 · ${typeLabel(trial.search_type)}`,
      phase,
      current: index + 1,
      total,
      content: boardHtml(trial, generated)
    });
    await logic.nextPaint();
    const response = await logic.timedKeyResponse(['KeyF', 'KeyJ'], 5000);
    const correct = response.key === trial.correct_key ? 1 : 0;

    if (trial.is_practice || !correct) {
      const message = response.timeout ? '太慢了' : (correct ? '正确' : '方向错误');
      ctx.renderStage({
        title: `视觉搜索 · ${typeLabel(trial.search_type)}`,
        phase,
        current: index + 1,
        total,
        content: `<div class="feedback">${message}</div>`
      });
      await logic.sleep(trial.is_practice ? 450 : 300);
    }
    await logic.sleep(350 + Math.floor(rng() * 201));

    return {
      trial_index: index + 1,
      search_type: trial.search_type,
      set_size: trial.set_size,
      group_side: trial.group_side,
      target_direction: trial.target_direction,
      target_cell: generated.targetCell,
      key: response.key || '',
      correct,
      rt: Number.isFinite(response.rt) ? Math.round(response.rt) : null,
      timeout: response.timeout,
      focus_lost: response.focus_lost
    };
  }

  async function run(ctx) {
    ctx.setHeaderStatus('视觉搜索');
    await ctx.showInstructions({
      eyebrow: '实验二 · 搜索与知觉分组',
      title: '找到红色三角形',
      html: `
        <p class="lead">每个画面中都有一个红色三角形。找到它，并判断三角形朝左还是朝右。</p>
        <div class="instruction-grid">
          <div class="instruction-card"><h3><kbd>F</kbd> 朝左</h3><p>目标三角形尖端朝左时按 F。</p></div>
          <div class="instruction-card"><h3><kbd>J</kbd> 朝右</h3><p>目标三角形尖端朝右时按 J。</p></div>
        </div>
        <div class="alert alert-info">项目数量会变化。请先找到目标再作答，不要根据出现位置猜测。</div>`,
      buttonText: '开始练习'
    });

    const practiceRng = logic.seededRng(ctx.seed ^ 0x5EA2C);
    const practice = buildTrials(practiceRng, 1, true);
    for (let i = 0; i < practice.length; i += 1) {
      await runTrial(ctx, practice[i], i, practice.length, practiceRng);
    }

    await ctx.showInstructions({
      eyebrow: '练习完成',
      title: '准备进入正式实验',
      html: '<p class="lead">正式实验共 60 次。部分画面中的项目会按颜色分区。请始终寻找红色三角形。</p>',
      buttonText: '开始正式实验'
    });

    const rng = logic.seededRng(ctx.seed ^ 0x51A7E);
    const plan = buildTrials(rng, 10, false);
    const trials = [];
    for (let i = 0; i < plan.length; i += 1) {
      trials.push(await runTrial(ctx, plan[i], i, plan.length, rng));
    }

    return {
      experiment: 'visual_search_grouping',
      label: '视觉搜索与颜色分区',
      trials,
      summary: logic.summarizeSearch(trials)
    };
  }

  root.experiments.visual_search = { run, buildTrials, buildBoard };
})(window);
