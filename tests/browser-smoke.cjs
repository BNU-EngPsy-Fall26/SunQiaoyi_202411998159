'use strict';

const assert = require('node:assert/strict');

const port = Number(process.argv[2] || 9223);
const endpoint = `http://127.0.0.1:${port}`;

async function waitForTarget() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const targets = await (await fetch(`${endpoint}/json/list`)).json();
      const page = targets.find((item) => item.type === 'page' && item.url.includes('index.html'));
      if (page) return page;
    } catch (error) {
      // Browser may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('无法连接 Edge 远程调试页面');
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      } else if (message.method) {
        this.events.push(message);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || '浏览器求值失败');
    }
    return result.result.value;
  }

  close() { this.socket.close(); }
}

(async () => {
  const target = await waitForTarget();
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.open();
  await client.send('Runtime.enable');
  await client.send('Log.enable');

  const automation = String.raw`
    (() => {
      window.__qaDone = false;
      window.__qaErrors = [];
      window.addEventListener('error', event => window.__qaErrors.push(String(event.error || event.message)));
      window.addEventListener('unhandledrejection', event => window.__qaErrors.push(String(event.reason)));
      const nativeSetTimeout = window.setTimeout.bind(window);
      window.setTimeout = (fn, ms, ...args) => nativeSetTimeout(fn, Math.min(ms, 25), ...args);

      const participant = document.getElementById('participant');
      const consent = document.getElementById('consent');
      participant.value = 'qa_smoke_01';
      participant.dispatchEvent(new Event('input', { bubbles: true }));
      consent.checked = true;
      document.getElementById('start-form').requestSubmit();

      let lastStimulus = '';
      let scheduled = false;
      const timer = setInterval(() => {
        if (document.getElementById('download-results')) {
          window.__qaDone = true;
          clearInterval(timer);
          return;
        }

        const instructionButton = document.getElementById('instruction-next');
        if (instructionButton) {
          instructionButton.click();
          return;
        }
        const continueButton = document.getElementById('continue-button');
        if (continueButton) {
          continueButton.click();
          return;
        }

        const topbar = document.querySelector('.experiment-topbar');
        const signature = topbar ? topbar.textContent.replace(/\s+/g, ' ').trim() : '';
        let code = null;
        const centralArrow = document.querySelector('.flanker-row .flanker-arrow:nth-child(3)');
        if (centralArrow) code = centralArrow.textContent.trim() === '<' ? 'KeyF' : 'KeyJ';
        const target = document.querySelector('.search-board .shape.red.triangle');
        if (target) code = target.classList.contains('left') ? 'KeyF' : 'KeyJ';
        const estimateForm = document.getElementById('estimate-form');

        if (!scheduled && signature && signature !== lastStimulus && (code || estimateForm)) {
          scheduled = true;
          const scheduledSignature = signature;
          nativeSetTimeout(() => {
            if (code) {
              window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code === 'KeyF' ? 'f' : 'j', bubbles: true }));
            } else {
              const input = document.getElementById('estimate-input');
              const form = document.getElementById('estimate-form');
              if (input && form) {
                input.value = '50';
                form.requestSubmit();
              }
            }
            lastStimulus = scheduledSignature;
            scheduled = false;
          }, 40);
        }
      }, 3);
    })();
  `;
  await client.evaluate(automation);

  const deadline = Date.now() + 120000;
  let done = false;
  while (Date.now() < deadline) {
    done = await client.evaluate('Boolean(window.__qaDone)');
    if (done) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.equal(done, true, '浏览器端到端流程未在 120 秒内完成');

  const stateText = await client.evaluate("localStorage.getItem('attention_lab_hw2_last_session_v1')");
  const state = JSON.parse(stateText);
  assert.equal(state.participant, 'qa_smoke_01');
  assert.equal(state.results.flanker_grouping.trials.length, 48);
  assert.equal(state.results.visual_search_grouping.trials.length, 60);
  assert.equal(state.results.graphical_perception_guides.trials.length, 36);
  assert.ok(state.completed_at);
  assert.deepEqual(await client.evaluate('window.__qaErrors'), []);

  const runtimeErrors = client.events.filter((event) =>
    event.method === 'Runtime.exceptionThrown' ||
    (event.method === 'Log.entryAdded' && event.params.entry.level === 'error')
  );
  assert.equal(runtimeErrors.length, 0, JSON.stringify(runtimeErrors, null, 2));

  console.log(JSON.stringify({
    ok: true,
    participant: state.participant,
    counts: {
      flanker: state.results.flanker_grouping.trials.length,
      visual_search: state.results.visual_search_grouping.trials.length,
      graphical: state.results.graphical_perception_guides.trials.length
    },
    browser_errors: runtimeErrors.length
  }, null, 2));
  await client.send('Browser.close');
  client.close();
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
