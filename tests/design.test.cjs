'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const context = vm.createContext({ console });
context.window = context;
context.globalThis = context;

for (const relativePath of [
  'logic.js',
  'experiments/flanker.js',
  'experiments/visual-search.js',
  'experiments/graphical-perception.js'
]) {
  const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  vm.runInContext(source, context, { filename: relativePath });
}

const { logic, experiments } = context.HW2;

function countBy(items, keyFn) {
  const result = new Map();
  for (const item of items) {
    const key = keyFn(item);
    result.set(key, (result.get(key) || 0) + 1);
  }
  return result;
}

test('Flanker 正式试次数量与条件平衡正确', () => {
  const rng = logic.seededRng(12345);
  const trials = experiments.flanker.buildTrials(rng, 12, false);
  assert.equal(trials.length, 48);
  const cells = countBy(trials, (trial) => `${trial.layout}|${trial.congruency}`);
  assert.deepEqual([...cells.values()], [12, 12, 12, 12]);
  for (const cell of cells.keys()) {
    const selected = trials.filter((trial) => `${trial.layout}|${trial.congruency}` === cell);
    assert.equal(selected.filter((trial) => trial.target_direction === 'left').length, 6);
    assert.equal(selected.filter((trial) => trial.target_direction === 'right').length, 6);
  }
  assert.ok(logic.longestRun(trials, (trial) => trial.correct_key) <= 3);
});

test('Flanker 练习包含 8 个试次', () => {
  const trials = experiments.flanker.buildTrials(logic.seededRng(2), 2, true);
  assert.equal(trials.length, 8);
  assert.ok(trials.every((trial) => trial.is_practice));
});

test('视觉搜索正式试次覆盖六个条件单元', () => {
  const rng = logic.seededRng(67890);
  const trials = experiments.visual_search.buildTrials(rng, 10, false);
  assert.equal(trials.length, 60);
  const cells = countBy(trials, (trial) => `${trial.search_type}|${trial.set_size}`);
  assert.equal(cells.size, 6);
  assert.ok([...cells.values()].every((count) => count === 10));
  for (const cell of cells.keys()) {
    const selected = trials.filter((trial) => `${trial.search_type}|${trial.set_size}` === cell);
    assert.equal(selected.filter((trial) => trial.target_direction === 'left').length, 5);
    assert.equal(selected.filter((trial) => trial.target_direction === 'right').length, 5);
  }
  for (const setSize of [8, 24]) {
    const grouped = trials.filter((trial) => trial.search_type === 'conjunction_grouped' && trial.set_size === setSize);
    assert.equal(grouped.filter((trial) => trial.group_side === 'left').length, 5);
    assert.equal(grouped.filter((trial) => trial.group_side === 'right').length, 5);
  }
  assert.ok(logic.longestRun(trials, (trial) => trial.correct_key) <= 3);
});

test('视觉搜索阵列项目数量、目标数量和分区位置正确', () => {
  const rng = logic.seededRng(2468);
  for (const searchType of ['feature', 'conjunction_mixed', 'conjunction_grouped']) {
    for (const setSize of [8, 24]) {
      const trial = {
        search_type: searchType,
        set_size: setSize,
        target_direction: 'left',
        group_side: searchType === 'conjunction_grouped' ? 'left' : ''
      };
      const generated = experiments.visual_search.buildBoard(trial, rng);
      const occupied = generated.board.filter(Boolean);
      assert.equal(occupied.length, setSize);
      assert.equal(occupied.filter((item) => item.role === 'target').length, 1);
      assert.ok(generated.targetCell >= 0 && generated.targetCell < 24);
      if (searchType === 'conjunction_grouped') {
        generated.board.forEach((item, index) => {
          if (!item) return;
          if (item.color === 'red') assert.ok(index % 6 < 3);
          if (item.color === 'blue') assert.ok(index % 6 >= 3);
        });
      }
    }
  }
});

test('图形知觉正式试次保持条件数量和材料配对', () => {
  const trials = experiments.graphical.buildTrials(logic.seededRng(13579), 12, false);
  assert.equal(trials.length, 36);
  const encodings = countBy(trials, (trial) => trial.encoding);
  assert.equal(encodings.size, 3);
  assert.ok([...encodings.values()].every((count) => count === 12));
  for (let pairId = 1; pairId <= 12; pairId += 1) {
    const pairTrials = trials.filter((trial) => trial.pair_id === pairId);
    assert.equal(pairTrials.length, 3);
    assert.equal(new Set(pairTrials.map((trial) => trial.true_ratio)).size, 1);
  }
  assert.ok(logic.longestRun(trials, (trial) => trial.encoding) <= 2);
  assert.doesNotMatch(experiments.graphical.sectorPath(42), /NaN|undefined/);
});

test('三个核心改进效应的计算方向正确', () => {
  const flankerTrials = [];
  for (const [layout, congruentRt, incongruentRt] of [
    ['plain', 500, 600],
    ['isolated', 490, 530]
  ]) {
    for (const [congruency, rt] of [['congruent', congruentRt], ['incongruent', incongruentRt]]) {
      for (let i = 0; i < 4; i += 1) flankerTrials.push({ layout, congruency, rt, correct: 1 });
    }
  }
  const flanker = logic.summarizeFlanker(flankerTrials);
  assert.equal(flanker.effect.plain, 100);
  assert.equal(flanker.effect.isolated, 40);
  assert.equal(flanker.improvement, 60);

  const searchTrials = [];
  const searchValues = {
    feature: [500, 516],
    conjunction_mixed: [520, 840],
    conjunction_grouped: [510, 670]
  };
  for (const [type, values] of Object.entries(searchValues)) {
    for (const [index, setSize] of [8, 24].entries()) {
      for (let i = 0; i < 4; i += 1) searchTrials.push({ search_type: type, set_size: setSize, rt: values[index], correct: 1 });
    }
  }
  const search = logic.summarizeSearch(searchTrials);
  assert.equal(search.slopes.feature, 1);
  assert.equal(search.slopes.conjunction_mixed, 20);
  assert.equal(search.slopes.conjunction_grouped, 10);
  assert.equal(search.grouping_benefit, 10);

  const graphicalTrials = [];
  for (const [encoding, error] of [['bar_common', 4], ['angle_plain', 12], ['angle_guided', 7]]) {
    for (let i = 0; i < 4; i += 1) graphicalTrials.push({ encoding, abs_error: error, rt: 1200 });
  }
  const graphical = logic.summarizeGraphical(graphicalTrials);
  assert.equal(graphical.guide_benefit, 5);
});

test('入口页面只使用相对本地资源路径', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  const localRefs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((value) => !value.startsWith('#'));
  assert.ok(localRefs.length >= 6);
  for (const ref of localRefs) {
    assert.ok(ref.startsWith('./'), `应使用相对路径：${ref}`);
    assert.ok(fs.existsSync(path.join(projectRoot, ref)), `文件不存在：${ref}`);
  }
  assert.doesNotMatch(html, /type="module"/);
});

test('三个实验情境图均存在并接入对应模块', () => {
  const expected = [
    ['assets/images/flanker-monitoring.png', 'experiments/flanker.js'],
    ['assets/images/visual-search-dashboard.png', 'experiments/visual-search.js'],
    ['assets/images/graphical-perception.png', 'experiments/graphical-perception.js']
  ];
  const app = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  for (const [asset, modulePath] of expected) {
    const fullAsset = path.join(projectRoot, asset);
    assert.ok(fs.existsSync(fullAsset), `情境图不存在：${asset}`);
    assert.ok(fs.statSync(fullAsset).size > 100000, `情境图文件异常：${asset}`);
    assert.match(app, new RegExp(asset.replaceAll('/', '\\/')));
    const moduleSource = fs.readFileSync(path.join(projectRoot, modulePath), 'utf8');
    assert.match(moduleSource, new RegExp(asset.replaceAll('/', '\\/')));
  }
});

test('README 固定 H1–H9 且标记尚未正式收数', () => {
  const readme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
  for (let i = 1; i <= 9; i += 1) assert.match(readme, new RegExp(`H${i}`));
  assert.match(readme, /正式收数状态：\*\*尚未开始\*\*/);
  assert.match(readme, /4c925936d4f1259e5a7ecc58c97e3d6107adaa28/);
});

test('公开项目码已配置且代码中没有下载密钥字段', () => {
  const app = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
  assert.match(app, /project:\s*'CUPX8L'/);
  assert.doesNotMatch(app, /REPLACE_ME|owner_key|download_key/i);
  assert.match(app, /testMode.*searchParams|testMode.*URLSearchParams|testMode/s);
  assert.match(app, /test_\$\{result\.experiment\}/);
});
