(function initLogic(global) {
  'use strict';

  const root = global.HW2 = global.HW2 || {};
  root.experiments = root.experiments || {};

  function hashString(value) {
    let hash = 2166136261;
    const text = String(value);
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRng(seed) {
    let state = seed >>> 0;
    return function random() {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(items, rng = Math.random) {
    const output = items.slice();
    for (let i = output.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [output[i], output[j]] = [output[j], output[i]];
    }
    return output;
  }

  function longestRun(items, keyFn) {
    let longest = 0;
    let current = 0;
    let previous;
    for (const item of items) {
      const key = keyFn(item);
      current = key === previous ? current + 1 : 1;
      previous = key;
      longest = Math.max(longest, current);
    }
    return longest;
  }

  function shuffleConstrained(items, keyFn, maxRun = 3, rng = Math.random) {
    let best = items.slice();
    let bestRun = Infinity;
    for (let attempt = 0; attempt < 500; attempt += 1) {
      const candidate = shuffle(items, rng);
      const run = longestRun(candidate, keyFn);
      if (run <= maxRun) return candidate;
      if (run < bestRun) {
        best = candidate;
        bestRun = run;
      }
    }
    return best;
  }

  function mean(values) {
    const finite = values.filter(Number.isFinite);
    return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
  }

  function median(values) {
    const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function proportion(values) {
    return values.length ? values.filter(Boolean).length / values.length : null;
  }

  function round(value, digits = 0) {
    if (!Number.isFinite(value)) return null;
    const scale = 10 ** digits;
    return Math.round(value * scale) / scale;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function nextPaint() {
    // 两次 requestAnimationFrame 确保 DOM 更新至少经过一次完整绘制周期。
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  function timedKeyResponse(validCodes, timeoutMs) {
    return new Promise((resolve) => {
      const startedAt = performance.now();
      let finished = false;
      let focusLost = false;

      function cleanup() {
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('blur', onBlur);
        document.removeEventListener('visibilitychange', onVisibility);
        clearTimeout(timer);
      }

      function finish(result) {
        if (finished) return;
        finished = true;
        cleanup();
        resolve({ ...result, focus_lost: focusLost });
      }

      function onKey(event) {
        // 忽略长按触发的重复事件和任务无关按键，避免一次按键生成多条反应。
        if (event.repeat || !validCodes.includes(event.code)) return;
        event.preventDefault();
        finish({ key: event.code, rt: performance.now() - startedAt, timeout: false });
      }

      function onBlur() { focusLost = true; }
      function onVisibility() { if (document.hidden) focusLost = true; }

      const timer = setTimeout(() => {
        finish({ key: null, rt: null, timeout: true });
      }, timeoutMs);

      window.addEventListener('keydown', onKey);
      window.addEventListener('blur', onBlur);
      document.addEventListener('visibilitychange', onVisibility);
    });
  }

  function experimentOrder(participant) {
    // 匿名编号稳定映射到六种实验顺序，同一人刷新后仍保持原顺序。
    const orders = [
      ['flanker', 'visual_search', 'graphical'],
      ['flanker', 'graphical', 'visual_search'],
      ['visual_search', 'flanker', 'graphical'],
      ['visual_search', 'graphical', 'flanker'],
      ['graphical', 'flanker', 'visual_search'],
      ['graphical', 'visual_search', 'flanker']
    ];
    return orders[hashString(participant) % orders.length].slice();
  }

  function summarizeFlanker(trials) {
    // 反应时只使用正确且不低于 150 ms 的试次；正确率仍使用全部正式试次。
    const cells = {};
    for (const layout of ['plain', 'isolated']) {
      cells[layout] = {};
      for (const congruency of ['congruent', 'incongruent']) {
        const selected = trials.filter((trial) => trial.layout === layout && trial.congruency === congruency);
        cells[layout][congruency] = {
          n: selected.length,
          median_rt: median(selected.filter((trial) => trial.correct && trial.rt >= 150).map((trial) => trial.rt)),
          accuracy: proportion(selected.map((trial) => trial.correct === 1))
        };
      }
    }
    const effect = {};
    for (const layout of ['plain', 'isolated']) {
      const congruent = cells[layout].congruent.median_rt;
      const incongruent = cells[layout].incongruent.median_rt;
      effect[layout] = Number.isFinite(congruent) && Number.isFinite(incongruent)
        ? incongruent - congruent : null;
    }
    return {
      cells,
      effect,
      improvement: Number.isFinite(effect.plain) && Number.isFinite(effect.isolated)
        ? effect.plain - effect.isolated : null
    };
  }

  function summarizeSearch(trials) {
    // 搜索斜率由集合大小 8 与 24 的条件中位反应时差计算。
    const types = ['feature', 'conjunction_mixed', 'conjunction_grouped'];
    const cells = {};
    const slopes = {};
    for (const type of types) {
      cells[type] = {};
      for (const setSize of [8, 24]) {
        const selected = trials.filter((trial) => trial.search_type === type && trial.set_size === setSize);
        cells[type][setSize] = {
          n: selected.length,
          median_rt: median(selected.filter((trial) => trial.correct && trial.rt >= 150).map((trial) => trial.rt)),
          accuracy: proportion(selected.map((trial) => trial.correct === 1))
        };
      }
      const low = cells[type][8].median_rt;
      const high = cells[type][24].median_rt;
      slopes[type] = Number.isFinite(low) && Number.isFinite(high) ? (high - low) / 16 : null;
    }
    return {
      cells,
      slopes,
      grouping_benefit: Number.isFinite(slopes.conjunction_mixed) && Number.isFinite(slopes.conjunction_grouped)
        ? slopes.conjunction_mixed - slopes.conjunction_grouped : null
    };
  }

  function summarizeGraphical(trials) {
    // 绝对误差是主要指标，判断时间按预注册规则排除低于 300 ms 的试次。
    const encodings = ['bar_common', 'angle_plain', 'angle_guided'];
    const cells = {};
    for (const encoding of encodings) {
      const selected = trials.filter((trial) => trial.encoding === encoding);
      cells[encoding] = {
        n: selected.length,
        mean_abs_error: mean(selected.map((trial) => trial.abs_error)),
        median_abs_error: median(selected.map((trial) => trial.abs_error)),
        median_rt: median(selected.filter((trial) => trial.rt >= 300).map((trial) => trial.rt))
      };
    }
    return {
      cells,
      guide_benefit: Number.isFinite(cells.angle_plain.mean_abs_error) && Number.isFinite(cells.angle_guided.mean_abs_error)
        ? cells.angle_plain.mean_abs_error - cells.angle_guided.mean_abs_error : null
    };
  }

  function downloadJson(filename, value) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  root.logic = {
    hashString,
    seededRng,
    shuffle,
    longestRun,
    shuffleConstrained,
    mean,
    median,
    proportion,
    round,
    escapeHtml,
    sleep,
    nextPaint,
    timedKeyResponse,
    experimentOrder,
    summarizeFlanker,
    summarizeSearch,
    summarizeGraphical,
    downloadJson
  };
})(typeof window !== 'undefined' ? window : globalThis);
