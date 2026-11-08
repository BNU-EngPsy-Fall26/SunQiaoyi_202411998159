'use strict';

// 正式数据分析脚本。只读取课程接口返回的匿名记录，不需要下载密钥。
// 运行：node analysis/final-analysis.cjs --output analysis/final-summary.json

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_PROJECT = 'CUPX8L';
const API_ROOT = 'https://attention-lab-production.up.railway.app/api/hw2/data';
const EXPERIMENTS = {
  flanker_grouping: { expectedTrials: 48 },
  visual_search_grouping: { expectedTrials: 60 },
  graphical_perception_guides: { expectedTrials: 36 }
};

function asNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function asBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return /^(true|1|yes)$/i.test(String(value || ''));
}

function mean(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function median(values) {
  const valid = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!valid.length) return null;
  const middle = Math.floor(valid.length / 2);
  return valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2;
}

function sampleSd(values) {
  if (values.length < 2) return null;
  const center = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1));
}

// Lanczos 近似与不完全 Beta 函数用于计算 t 分布双侧 p 值和置信区间。
function logGamma(z) {
  const coefficients = [
    676.5203681218851, -1259.1392167224028, 771.3234287776531,
    -176.6150291621406, 12.507343278686905, -0.13857109526572012,
    9.984369578019571e-6, 1.5056327351493116e-7
  ];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  let x = 0.9999999999998099;
  const shifted = z - 1;
  coefficients.forEach((coefficient, index) => { x += coefficient / (shifted + index + 1); });
  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(x);
}

function betaContinuedFraction(a, b, x) {
  const maxIterations = 200;
  const epsilon = 3e-14;
  const floor = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;
  if (Math.abs(d) < floor) d = floor;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIterations; m += 1) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < floor) d = floor;
    c = 1 + aa / c;
    if (Math.abs(c) < floor) c = floor;
    d = 1 / d;
    h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < floor) d = floor;
    c = 1 + aa / c;
    if (Math.abs(c) < floor) c = floor;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }
  return h;
}

function regularizedBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const factor = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b)
    + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return factor * betaContinuedFraction(a, b, x) / a;
  return 1 - factor * betaContinuedFraction(b, a, 1 - x) / b;
}

function twoSidedTP(tValue, degreesOfFreedom) {
  if (!Number.isFinite(tValue)) return tValue === 0 ? 1 : 0;
  const x = degreesOfFreedom / (degreesOfFreedom + tValue ** 2);
  return regularizedBeta(x, degreesOfFreedom / 2, 0.5);
}

function tCritical95(degreesOfFreedom) {
  let low = 0;
  let high = 20;
  for (let index = 0; index < 100; index += 1) {
    const middle = (low + high) / 2;
    if (twoSidedTP(middle, degreesOfFreedom) > 0.05) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

function effectTest(values) {
  const valid = values.filter(Number.isFinite);
  const n = valid.length;
  const center = mean(valid);
  const sd = sampleSd(valid);
  if (n < 2 || !Number.isFinite(sd)) {
    return { n, mean: center, ci_low: null, ci_high: null, t: null, p: null, dz: null };
  }
  if (sd === 0) {
    const t = center === 0 ? 0 : Math.sign(center) * Infinity;
    return { n, mean: center, ci_low: center, ci_high: center, t, p: center === 0 ? 1 : 0, dz: t };
  }
  const standardError = sd / Math.sqrt(n);
  const t = center / standardError;
  const margin = tCritical95(n - 1) * standardError;
  return {
    n,
    mean: center,
    ci_low: center - margin,
    ci_high: center + margin,
    t,
    p: twoSidedTP(t, n - 1),
    dz: center / sd
  };
}

function trialsOf(record) {
  if (Array.isArray(record.trials)) return record.trials;
  if (typeof record.trials === 'string') {
    try {
      const parsed = JSON.parse(record.trials);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

function latestCompleteRecords(records, experiment) {
  const expected = EXPERIMENTS[experiment].expectedTrials;
  const byParticipant = new Map();
  records
    .filter((record) => record.experiment === experiment && trialsOf(record).length === expected)
    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
    .forEach((record) => byParticipant.set(String(record.participant), { ...record, trials: trialsOf(record) }));
  return [...byParticipant.values()].sort((a, b) => String(a.participant).localeCompare(String(b.participant), undefined, { numeric: true }));
}

function validRtTrials(trials, predicate, minimumRt) {
  return trials.filter((trial) => predicate(trial)
    && asBoolean(trial.correct)
    && asNumber(trial.rt) >= minimumRt);
}

function analyzeFlanker(records) {
  const retained = [];
  let lowAccuracyParticipants = 0;
  records.forEach((record) => {
    const trials = record.trials;
    const accuracy = mean(trials.map((trial) => asBoolean(trial.correct) ? 1 : 0));
    if (accuracy < 0.60) {
      lowAccuracyParticipants += 1;
      return;
    }
    const cell = {};
    for (const layout of ['plain', 'isolated']) {
      for (const congruency of ['congruent', 'incongruent']) {
        const selected = validRtTrials(trials,
          (trial) => trial.layout === layout && trial.congruency === congruency, 150);
        cell[`${layout}_${congruency}`] = median(selected.map((trial) => asNumber(trial.rt)));
      }
    }
    const plain = cell.plain_incongruent - cell.plain_congruent;
    const isolated = cell.isolated_incongruent - cell.isolated_congruent;
    retained.push({
      participant: record.participant,
      plain,
      isolated,
      benefit: plain - isolated,
      ...cell,
      plain_congruent_accuracy: mean(trials.filter((trial) => trial.layout === 'plain' && trial.congruency === 'congruent').map((trial) => asBoolean(trial.correct) ? 1 : 0)),
      plain_incongruent_accuracy: mean(trials.filter((trial) => trial.layout === 'plain' && trial.congruency === 'incongruent').map((trial) => asBoolean(trial.correct) ? 1 : 0))
    });
  });
  return { rows: retained, lowAccuracyParticipants };
}

function analyzeSearch(records) {
  const rows = [];
  let lowAccuracyParticipants = 0;
  records.forEach((record) => {
    const trials = record.trials;
    const accuracy = mean(trials.map((trial) => asBoolean(trial.correct) ? 1 : 0));
    if (accuracy < 0.60) {
      lowAccuracyParticipants += 1;
      return;
    }
    const cell = {};
    const slopes = {};
    for (const searchType of ['feature', 'conjunction_grouped', 'conjunction_mixed']) {
      for (const setSize of [8, 24]) {
        const selected = validRtTrials(trials,
          (trial) => trial.search_type === searchType && asNumber(trial.set_size) === setSize, 150);
        cell[`${searchType}_${setSize}`] = median(selected.map((trial) => asNumber(trial.rt)));
      }
      slopes[searchType] = (cell[`${searchType}_24`] - cell[`${searchType}_8`]) / 16;
    }
    rows.push({
      participant: record.participant,
      ...slopes,
      ...cell,
      benefit: slopes.conjunction_mixed - slopes.conjunction_grouped,
      grouped24_accuracy: mean(trials.filter((trial) => trial.search_type === 'conjunction_grouped' && asNumber(trial.set_size) === 24).map((trial) => asBoolean(trial.correct) ? 1 : 0)),
      mixed24_accuracy: mean(trials.filter((trial) => trial.search_type === 'conjunction_mixed' && asNumber(trial.set_size) === 24).map((trial) => asBoolean(trial.correct) ? 1 : 0))
    });
  });
  return { rows, lowAccuracyParticipants };
}

function analyzeGraphical(records) {
  let fastExcluded = 0;
  let focusLostFlagged = 0;
  const rows = records.map((record) => {
    fastExcluded += record.trials.filter((trial) => {
      const rt = asNumber(trial.rt);
      return Number.isFinite(rt) && rt < 300;
    }).length;
    focusLostFlagged += record.trials.filter((trial) => asBoolean(trial.focus_lost)).length;
    const values = {};
    for (const encoding of ['bar_common', 'angle_plain', 'angle_guided']) {
      const selected = record.trials.filter((trial) => trial.encoding === encoding && asNumber(trial.rt) >= 300);
      values[encoding] = mean(selected.map((trial) => asNumber(trial.abs_error)));
      values[`${encoding}_median_rt`] = median(selected.map((trial) => asNumber(trial.rt)));
    }
    return {
      participant: record.participant,
      ...values,
      benefit: values.angle_plain - values.angle_guided
    };
  });
  return { rows, fastExcluded, focusLostFlagged };
}

function analyzeDatasets(datasets, metadata = {}) {
  const complete = {};
  Object.keys(EXPERIMENTS).forEach((experiment) => {
    complete[experiment] = latestCompleteRecords(datasets[experiment] || [], experiment);
  });
  const flanker = analyzeFlanker(complete.flanker_grouping);
  const search = analyzeSearch(complete.visual_search_grouping);
  const graphical = analyzeGraphical(complete.graphical_perception_guides);

  const flankerRows = flanker.rows;
  const searchRows = search.rows;
  const graphicalRows = graphical.rows;
  const result = {
    metadata: {
      project: metadata.project || DEFAULT_PROJECT,
      generated_at: new Date().toISOString(),
      source: metadata.source || 'public-anonymous-api',
      cleaning_rule_version: 'README preregistration v0.2'
    },
    data_quality: {
      complete_records: Object.fromEntries(Object.entries(complete).map(([name, records]) => [name, records.length])),
      expected_trials_per_record: Object.fromEntries(Object.entries(EXPERIMENTS).map(([name, value]) => [name, value.expectedTrials])),
      total_formal_trials: complete.flanker_grouping.length * 48 + complete.visual_search_grouping.length * 60 + complete.graphical_perception_guides.length * 36,
      low_accuracy_participants: flanker.lowAccuracyParticipants + search.lowAccuracyParticipants,
      graphical_trials_below_300ms: graphical.fastExcluded,
      graphical_focus_lost_trials: graphical.focusLostFlagged
    },
    primary_results: {
      flanker: {
        plain_interference_ms: mean(flankerRows.map((row) => row.plain)),
        isolated_interference_ms: mean(flankerRows.map((row) => row.isolated)),
        isolation_benefit: effectTest(flankerRows.map((row) => row.benefit)),
        classic_plain_interference: effectTest(flankerRows.map((row) => row.plain))
      },
      visual_search: {
        feature_slope_ms_per_item: mean(searchRows.map((row) => row.feature)),
        grouped_slope_ms_per_item: mean(searchRows.map((row) => row.conjunction_grouped)),
        mixed_slope_ms_per_item: mean(searchRows.map((row) => row.conjunction_mixed)),
        grouping_benefit: effectTest(searchRows.map((row) => row.benefit)),
        mixed_minus_feature: effectTest(searchRows.map((row) => row.conjunction_mixed - row.feature))
      },
      graphical_perception: {
        bar_common_error_points: mean(graphicalRows.map((row) => row.bar_common)),
        angle_plain_error_points: mean(graphicalRows.map((row) => row.angle_plain)),
        angle_guided_error_points: mean(graphicalRows.map((row) => row.angle_guided)),
        guide_benefit: effectTest(graphicalRows.map((row) => row.benefit)),
        angle_minus_bar: effectTest(graphicalRows.map((row) => row.angle_plain - row.bar_common))
      }
    },
    secondary_results: {
      h1_accuracy: {
        congruent: mean(flankerRows.map((row) => row.plain_congruent_accuracy)),
        incongruent: mean(flankerRows.map((row) => row.plain_incongruent_accuracy)),
        difference: effectTest(flankerRows.map((row) => row.plain_congruent_accuracy - row.plain_incongruent_accuracy))
      },
      h3_isolation_by_congruency: {
        congruent_speedup_ms: mean(flankerRows.map((row) => row.plain_congruent - row.isolated_congruent)),
        incongruent_speedup_ms: mean(flankerRows.map((row) => row.plain_incongruent - row.isolated_incongruent))
      },
      h5_size_specific: {
        size_8_benefit_ms: mean(searchRows.map((row) => row.conjunction_mixed_8 - row.conjunction_grouped_8)),
        size_24_benefit_ms: mean(searchRows.map((row) => row.conjunction_mixed_24 - row.conjunction_grouped_24)),
        interaction: effectTest(searchRows.map((row) =>
          (row.conjunction_mixed_24 - row.conjunction_grouped_24)
          - (row.conjunction_mixed_8 - row.conjunction_grouped_8)))
      },
      h6_accuracy_at_24: {
        grouped: mean(searchRows.map((row) => row.grouped24_accuracy)),
        mixed: mean(searchRows.map((row) => row.mixed24_accuracy)),
        difference: effectTest(searchRows.map((row) => row.grouped24_accuracy - row.mixed24_accuracy))
      },
      h9_graphical_rt: {
        angle_plain_median_ms: mean(graphicalRows.map((row) => row.angle_plain_median_rt)),
        angle_guided_median_ms: mean(graphicalRows.map((row) => row.angle_guided_median_rt)),
        difference: effectTest(graphicalRows.map((row) => row.angle_plain_median_rt - row.angle_guided_median_rt))
      }
    },
    participant_metrics: {
      flanker: flankerRows,
      visual_search: searchRows,
      graphical_perception: graphicalRows
    }
  };
  return result;
}

function recordsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.records)) return payload.records;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

function loadLocalInput(inputPath) {
  const resolved = path.resolve(inputPath);
  const datasets = Object.fromEntries(Object.keys(EXPERIMENTS).map((name) => [name, []]));
  if (fs.statSync(resolved).isDirectory()) {
    Object.keys(EXPERIMENTS).forEach((experiment) => {
      const file = path.join(resolved, `${experiment}.json`);
      if (!fs.existsSync(file)) throw new Error(`缺少本地文件：${file}`);
      datasets[experiment] = recordsFromPayload(JSON.parse(fs.readFileSync(file, 'utf8')));
    });
    return datasets;
  }
  const records = recordsFromPayload(JSON.parse(fs.readFileSync(resolved, 'utf8')));
  records.forEach((record) => {
    if (datasets[record.experiment]) datasets[record.experiment].push(record);
  });
  return datasets;
}

async function fetchDatasets(project) {
  const datasets = {};
  for (const experiment of Object.keys(EXPERIMENTS)) {
    const url = `${API_ROOT}?project=${encodeURIComponent(project)}&experiment=${encodeURIComponent(experiment)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${experiment} 请求失败：HTTP ${response.status}`);
    const payload = await response.json();
    datasets[experiment] = recordsFromPayload(payload);
  }
  return datasets;
}

function parseArguments(argv) {
  const result = { project: DEFAULT_PROJECT, output: 'analysis/final-summary.json', input: null };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === '--project') result.project = argv[++index];
    else if (key === '--output') result.output = argv[++index];
    else if (key === '--input') result.input = argv[++index];
    else if (key === '--help') result.help = true;
    else throw new Error(`未知参数：${key}`);
  }
  return result;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write('用法：node analysis/final-analysis.cjs [--project CUPX8L] [--input 导出文件或目录] [--output 输出文件]\n');
    return;
  }
  const datasets = options.input ? loadLocalInput(options.input) : await fetchDatasets(options.project);
  const result = analyzeDatasets(datasets, {
    project: options.project,
    source: options.input ? `local-export:${path.basename(options.input)}` : 'public-anonymous-api'
  });
  const output = path.resolve(options.output);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({
    output,
    participants: result.data_quality.complete_records,
    trials: result.data_quality.total_formal_trials,
    exclusions: {
      graphical_below_300ms: result.data_quality.graphical_trials_below_300ms,
      graphical_focus_lost: result.data_quality.graphical_focus_lost_trials
    }
  }, null, 2)}\n`);
}

module.exports = {
  analyzeDatasets,
  effectTest,
  latestCompleteRecords,
  mean,
  median,
  parseArguments,
  twoSidedTP
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  });
}
