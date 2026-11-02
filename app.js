(function startApplication(global) {
  'use strict';

  const root = global.HW2;
  const logic = root.logic;
  const app = document.getElementById('app');
  const headerStatus = document.getElementById('header-status');
  const testMode = new URLSearchParams(location.search).get('test') === '1';

  const CONFIG = {
    lab: 'https://attention-lab-production.up.railway.app',
    project: 'CUPX8L',
    testMode,
    storageKey: testMode ? 'attention_lab_hw2_test_session_v1' : 'attention_lab_hw2_last_session_v1'
  };

  const EXPERIMENT_NAME_TO_ID = {
    flanker_grouping: 'flanker',
    visual_search_grouping: 'visual_search',
    graphical_perception_guides: 'graphical'
  };

  const ID_TO_LABEL = {
    flanker: 'Flanker 目标判断',
    visual_search: '视觉搜索',
    graphical: '图形比例判断'
  };

  let activeState = null;

  function projectConfigured() {
    return /^[A-Z0-9]{6}$/i.test(CONFIG.project) && CONFIG.project !== 'ABC234';
  }

  function setHeaderStatus(text) {
    headerStatus.textContent = text;
  }

  function render(html) {
    app.innerHTML = html;
    app.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function waitClick(id) {
    return new Promise((resolve) => {
      document.getElementById(id).addEventListener('click', resolve, { once: true });
    });
  }

  function showInstructions({ eyebrow, title, html, buttonText = '继续' }) {
    render(`
      <section class="panel panel-narrow">
        <p class="eyebrow">${logic.escapeHtml(eyebrow)}</p>
        <h2>${logic.escapeHtml(title)}</h2>
        ${html}
        <div class="actions"><button class="btn btn-primary" id="instruction-next">${logic.escapeHtml(buttonText)}</button></div>
      </section>`);
    return waitClick('instruction-next');
  }

  function renderStage({ title, phase, current, total, content }) {
    const percentage = total ? Math.min(100, Math.max(0, current / total * 100)) : 0;
    render(`
      <section class="experiment-shell">
        <div class="experiment-topbar">
          <span>${logic.escapeHtml(title)}</span>
          <span>${logic.escapeHtml(phase)}　${current}/${total}</span>
        </div>
        <div class="experiment-stage">${content}</div>
        <div style="position:absolute;left:0;right:0;bottom:0;height:5px;background:rgba(255,255,255,.08)">
          <div style="height:100%;width:${percentage}%;background:linear-gradient(90deg,#C5E9E3,#5F89B1)"></div>
        </div>
      </section>`);
  }

  const context = {
    get seed() { return activeState ? activeState.seed : 1; },
    render,
    renderStage,
    showInstructions,
    setHeaderStatus
  };

  function saveState() {
    if (!activeState) return;
    activeState.updated_at = new Date().toISOString();
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(activeState));
    } catch (error) {
      console.warn('无法保存本地进度：', error);
    }
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CONFIG.storageKey) || 'null');
      return parsed && parsed.participant && Array.isArray(parsed.order) ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function completedIds(state) {
    return Object.keys(state.results || {})
      .map((name) => EXPERIMENT_NAME_TO_ID[name])
      .filter(Boolean);
  }

  function sessionComplete(state) {
    return completedIds(state).length === 3;
  }

  function safeParticipantFilename(participant) {
    return String(participant).replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 24) || 'participant';
  }

  function createState(participant) {
    const seed = logic.hashString(`${participant}|attention-lab-hw2`);
    return {
      schema_version: 1,
      session_id: `${Date.now()}-${seed.toString(16)}`,
      participant,
      seed,
      order: logic.experimentOrder(participant),
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
      test_mode: CONFIG.testMode,
      results: {},
      uploads: {}
    };
  }

  function projectNotice() {
    if (CONFIG.testMode) {
      return '<div class="alert alert-warning"><strong>当前为测试模式</strong><br>上传的实验名会自动添加 <code>test_</code> 前缀，不得计入正式样本。</div>';
    }
    if (projectConfigured()) {
      return `<div class="alert alert-success">课程项目码已配置：<strong>${logic.escapeHtml(CONFIG.project)}</strong>。实验完成后会自动上传。</div>`;
    }
    return '<div class="alert alert-warning">课程项目码尚未配置。当前版本仍可完整运行，数据会保存在本机，并可下载 JSON 备份。</div>';
  }

  function showLanding() {
    setHeaderStatus('准备开始');
    const previous = loadState();
    const previousHtml = previous ? `
      <div class="info-box" style="margin-top:18px">
        <h3>发现本机保存的实验记录</h3>
        <p class="small">匿名编号：${logic.escapeHtml(previous.participant)} · 已完成 ${completedIds(previous).length}/3 个实验</p>
        <div class="actions">
          <button class="btn btn-secondary" id="resume-session">${sessionComplete(previous) ? '查看上次结果' : '继续上次实验'}</button>
          <button class="btn btn-secondary" id="download-previous">下载本地备份</button>
        </div>
      </div>` : '';

    render(`
      <section class="panel">
        <div class="hero-grid">
          <div>
            <p class="eyebrow">工程心理学 · 注意实验室</p>
            <h1>视觉组织与<br>注意效率实验室</h1>
            <p class="lead">你将完成三个短实验，观察目标边界、颜色分区和图形参照线怎样影响反应速度与判断准确性。</p>
            <div class="study-list">
              <article class="study-card">
                <div class="study-visual"><img src="./assets/images/flanker-monitoring.png" alt="监控台上被单独框选的中央警报目标"></div>
                <div class="study-content"><span class="num">01</span><h3>目标隔离</h3><p>在监控告警中忽略周围方向干扰，判断中央目标。</p></div>
              </article>
              <article class="study-card">
                <div class="study-visual"><img src="./assets/images/visual-search-dashboard.png" alt="按颜色分区的监控界面中正在寻找红色目标"></div>
                <div class="study-content"><span class="num">02</span><h3>颜色分区</h3><p>在密集界面中寻找目标，比较不同信息组织方式。</p></div>
              </article>
              <article class="study-card">
                <div class="study-visual"><img src="./assets/images/graphical-perception.png" alt="使用条形图和角度仪表比较两个数值"></div>
                <div class="study-content"><span class="num">03</span><h3>参照信息</h3><p>比较条形和角度图形，估计两个指标的比例。</p></div>
              </article>
            </div>
          </div>
          <aside>
            <div class="info-box">
              <h3>参加前请确认</h3>
              <ul>
                <li>使用电脑和实体键盘。</li>
                <li>预留约 9–12 分钟。</li>
                <li>实验期间不要切换窗口。</li>
                <li>只填写匿名编号或昵称。</li>
              </ul>
            </div>
            ${projectNotice()}
            ${window.innerWidth < 900 ? '<div class="alert alert-warning">当前窗口较窄。建议使用电脑并最大化浏览器，以免刺激显示过小。</div>' : ''}
            <form id="start-form" class="form-stack" novalidate>
              <div class="field">
                <label for="participant">匿名编号或昵称</label>
                <input id="participant" type="text" maxlength="32" autocomplete="off" placeholder="例如 P07 或 qiao_07">
                <span class="small muted">不要填写真实姓名或学号。</span>
              </div>
              <label class="check-row">
                <input id="consent" type="checkbox">
                <span>我已阅读说明，自愿参加，并理解可以在任何时候关闭页面退出。</span>
              </label>
              <div id="start-error" class="small danger-text" aria-live="assertive"></div>
              <button class="btn btn-primary" type="submit">开始实验</button>
            </form>
            ${previousHtml}
          </aside>
        </div>
      </section>`);

    document.getElementById('start-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const participant = document.getElementById('participant').value.trim();
      const consent = document.getElementById('consent').checked;
      const error = document.getElementById('start-error');
      if (!participant || participant.length < 2) {
        error.textContent = '请输入至少 2 个字符的匿名编号。';
        return;
      }
      if (!consent) {
        error.textContent = '请先确认已阅读说明并自愿参加。';
        return;
      }
      activeState = createState(participant);
      saveState();
      runSession().catch(showFatalError);
    });

    if (previous) {
      document.getElementById('resume-session').addEventListener('click', () => {
        activeState = previous;
        if (sessionComplete(previous)) showResults();
        else runSession().catch(showFatalError);
      });
      document.getElementById('download-previous').addEventListener('click', () => {
        logic.downloadJson(`hw2_${safeParticipantFilename(previous.participant)}_backup.json`, previous);
      });
    }
  }

  async function submitResult(result) {
    if (!projectConfigured()) {
      return {
        status: 'local',
        message: '项目码尚未配置，数据已保存在本机。',
        warnings: []
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${CONFIG.lab}/api/hw2/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          project: CONFIG.project,
          experiment: CONFIG.testMode ? `test_${result.experiment}` : result.experiment,
          participant: activeState.participant,
          condition: activeState.order.join('-'),
          trials: result.trials,
          meta: {
            ua: navigator.userAgent.slice(0, 80),
            w: innerWidth,
            h: innerHeight,
            session: activeState.session_id.slice(0, 80)
          }
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.msg || `HTTP ${response.status}`);
      }
      return {
        status: 'success',
        message: `上传成功，该实验已有 ${payload.participants ?? '—'} 名被试。`,
        record_id: payload.record_id || '',
        participants: payload.participants ?? null,
        warnings: Array.isArray(payload.warnings) ? payload.warnings : []
      };
    } catch (error) {
      return {
        status: 'failed',
        message: error.name === 'AbortError' ? '上传超时，数据仍保存在本机。' : `上传失败：${error.message}`,
        warnings: []
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async function showIntermission(result, upload, completedCount) {
    const nextId = activeState.order.find((id) => !completedIds(activeState).includes(id));
    const warningHtml = upload.warnings && upload.warnings.length
      ? `<div class="alert alert-warning"><strong>后台警告</strong><br>${upload.warnings.map(logic.escapeHtml).join('<br>')}</div>` : '';
    const alertClass = upload.status === 'success' ? 'alert-success' : (upload.status === 'failed' ? 'alert-error' : 'alert-warning');
    setHeaderStatus(`已完成 ${completedCount}/3`);
    render(`
      <section class="panel panel-narrow center">
        <p class="eyebrow">阶段完成</p>
        <h2>${logic.escapeHtml(result.label)}已完成</h2>
        <p class="lead" style="margin-left:auto;margin-right:auto">已记录 ${result.trials.length} 个正式试次。</p>
        <div class="alert ${alertClass}">${logic.escapeHtml(upload.message)}</div>
        ${warningHtml}
        <p class="muted">你可以稍作休息。准备好后再继续。</p>
        <div class="actions center">
          <button class="btn btn-primary" id="continue-button">${nextId ? `继续：${logic.escapeHtml(ID_TO_LABEL[nextId])}` : '查看全部结果'}</button>
          <button class="btn btn-secondary" id="download-now">下载当前备份</button>
        </div>
      </section>`);
    document.getElementById('download-now').addEventListener('click', () => {
      logic.downloadJson(`hw2_${safeParticipantFilename(activeState.participant)}_backup.json`, activeState);
    });
    await waitClick('continue-button');
  }

  async function runSession() {
    for (const experimentId of activeState.order) {
      const alreadyDone = completedIds(activeState).includes(experimentId);
      if (alreadyDone) continue;
      const experiment = root.experiments[experimentId];
      if (!experiment || typeof experiment.run !== 'function') {
        throw new Error(`实验模块未加载：${experimentId}`);
      }
      const result = await experiment.run(context);
      activeState.results[result.experiment] = result;
      saveState();
      const upload = await submitResult(result);
      activeState.uploads[result.experiment] = upload;
      saveState();
      await showIntermission(result, upload, completedIds(activeState).length);
    }
    activeState.completed_at = new Date().toISOString();
    saveState();
    showResults();
  }

  function fmt(value, unit = '', digits = 0) {
    return Number.isFinite(value) ? `${logic.round(value, digits)}${unit}` : '—';
  }

  function barRow(label, value, max, unit) {
    const width = Number.isFinite(value) && max > 0 ? Math.max(2, Math.min(100, Math.abs(value) / max * 100)) : 0;
    return `
      <div class="mini-bar-row">
        <span>${logic.escapeHtml(label)}</span>
        <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${width}%"></div></div>
        <strong>${fmt(value, unit, 1)}</strong>
      </div>`;
  }

  function flankerResultCard(result) {
    if (!result) return '';
    const summary = result.summary || logic.summarizeFlanker(result.trials);
    const max = Math.max(1, Math.abs(summary.effect.plain || 0), Math.abs(summary.effect.isolated || 0));
    return `
      <article class="result-card">
        <h3>Flanker 目标隔离</h3>
        <p class="muted small">改进收益</p>
        <div class="metric">${fmt(summary.improvement, ' ms', 0)}</div>
        <p class="small">正值表示目标隔离减小了干扰效应。</p>
        <div class="mini-bars">
          ${barRow('普通排列', summary.effect.plain, max, ' ms')}
          ${barRow('目标隔离', summary.effect.isolated, max, ' ms')}
        </div>
      </article>`;
  }

  function searchResultCard(result) {
    if (!result) return '';
    const summary = result.summary || logic.summarizeSearch(result.trials);
    const values = Object.values(summary.slopes).filter(Number.isFinite).map(Math.abs);
    const max = Math.max(1, ...values);
    return `
      <article class="result-card">
        <h3>视觉搜索与颜色分区</h3>
        <p class="muted small">分组收益</p>
        <div class="metric">${fmt(summary.grouping_benefit, ' ms/item', 1)}</div>
        <p class="small">正值表示颜色分区降低了联合搜索斜率。</p>
        <div class="mini-bars">
          ${barRow('特征', summary.slopes.feature, max, '')}
          ${barRow('混合联合', summary.slopes.conjunction_mixed, max, '')}
          ${barRow('分组联合', summary.slopes.conjunction_grouped, max, '')}
        </div>
      </article>`;
  }

  function graphicalResultCard(result) {
    if (!result) return '';
    const summary = result.summary || logic.summarizeGraphical(result.trials);
    const max = Math.max(1, ...Object.values(summary.cells).map((cell) => cell.mean_abs_error || 0));
    return `
      <article class="result-card">
        <h3>图形比例判断</h3>
        <p class="muted small">参照线收益</p>
        <div class="metric">${fmt(summary.guide_benefit, ' 个百分点', 1)}</div>
        <p class="small">正值表示参考线降低了角度判断误差。</p>
        <div class="mini-bars">
          ${barRow('共同尺度', summary.cells.bar_common.mean_abs_error, max, '')}
          ${barRow('纯角度', summary.cells.angle_plain.mean_abs_error, max, '')}
          ${barRow('角度改进', summary.cells.angle_guided.mean_abs_error, max, '')}
        </div>
      </article>`;
  }

  function uploadStatusHtml() {
    return Object.entries(activeState.results).map(([name, result]) => {
      const upload = activeState.uploads[name] || { status: 'local', message: '尚未上传' };
      const mark = upload.status === 'success' ? '✓' : (upload.status === 'failed' ? '!' : '○');
      return `<div class="status-item"><span>${mark} ${logic.escapeHtml(result.label)}</span><span>${logic.escapeHtml(upload.message)}</span></div>`;
    }).join('');
  }

  function showResults() {
    setHeaderStatus('实验完成');
    const flanker = activeState.results.flanker_grouping;
    const search = activeState.results.visual_search_grouping;
    const graphical = activeState.results.graphical_perception_guides;
    render(`
      <section class="panel">
        <p class="eyebrow">实验完成</p>
        <h2>感谢参与，${logic.escapeHtml(activeState.participant)}</h2>
        <p class="lead">下面是你的个人结果。单名被试的数据只能用于检查程序和理解指标，正式结论需要汇总至少 5 名被试。</p>
        <div class="result-grid">
          ${flankerResultCard(flanker)}
          ${searchResultCard(search)}
          ${graphicalResultCard(graphical)}
        </div>
        <h3>数据状态</h3>
        <div class="status-list">${uploadStatusHtml()}</div>
        ${projectConfigured() ? '' : '<div class="alert alert-warning">课程项目码尚未配置。请下载本地备份，配置项目码后可以重新上传。</div>'}
        <div class="actions">
          <button class="btn btn-primary" id="download-results">下载本地 JSON</button>
          <button class="btn btn-secondary" id="retry-uploads">重新尝试上传</button>
          <button class="btn btn-secondary" id="back-home">返回首页</button>
        </div>
      </section>`);

    document.getElementById('download-results').addEventListener('click', () => {
      logic.downloadJson(`hw2_${safeParticipantFilename(activeState.participant)}_${Date.now()}.json`, activeState);
    });
    document.getElementById('retry-uploads').addEventListener('click', retryUploads);
    document.getElementById('back-home').addEventListener('click', showLanding);
  }

  async function retryUploads() {
    setHeaderStatus('正在上传');
    render(`
      <section class="panel panel-narrow center">
        <p class="eyebrow">数据处理</p>
        <h2>正在重新尝试上传</h2>
        <p class="lead" style="margin-left:auto;margin-right:auto">请保持网络连接，不要关闭页面。</p>
      </section>`);
    for (const result of Object.values(activeState.results)) {
      activeState.uploads[result.experiment] = await submitResult(result);
      saveState();
    }
    showResults();
  }

  function showFatalError(error) {
    console.error(error);
    setHeaderStatus('发生错误');
    render(`
      <section class="panel panel-narrow">
        <p class="eyebrow">程序提示</p>
        <h2>实验暂时无法继续</h2>
        <div class="alert alert-error">${logic.escapeHtml(error && error.message ? error.message : String(error))}</div>
        <p>已经完成的数据仍保存在本机。请先下载备份，再刷新页面或联系实验负责人。</p>
        <div class="actions">
          <button class="btn btn-primary" id="fatal-download">下载当前备份</button>
          <button class="btn btn-secondary" id="fatal-home">返回首页</button>
        </div>
      </section>`);
    document.getElementById('fatal-download').addEventListener('click', () => {
      logic.downloadJson(`hw2_${safeParticipantFilename(activeState?.participant || 'error')}_backup.json`, activeState || {});
    });
    document.getElementById('fatal-home').addEventListener('click', showLanding);
  }

  window.addEventListener('error', (event) => {
    if (event.error) console.error('全局错误：', event.error);
  });

  showLanding();
})(window);
