/* UI state machine: idle → fixation → exposure → response → gap → results.
   Ground truth never affects button labels or specimen IDs during formal trials. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id), ALL_OUTCOMES={H:'击中',M:'漏报',FA:'虚报',CR:'正确拒绝'};
  const STORAGE='citrus-sdt-v1', image=new Image(), canvas=$('fruit'),ctx=canvas.getContext('2d');
  // The matrix belongs to the exploration page; clone once before binding controls.
  $('view-concept').insertBefore($('concept-matrix-template').content.cloneNode(true),document.querySelector('#view-concept .model-note'));
  let loaded=false,phase='idle',session=null,timer=null,frame=null,epoch=0,lastResult=null,history=[],storageAvailable=true,paused=false;
  const pct=x=>(x*100).toFixed(1)+'%',num=x=>(Math.abs(x)<.0005?0:x).toFixed(2);
  const html=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const outcome=t=>t.signal?(t.answer?'H':'M'):(t.answer?'FA':'CR');
  const active=()=>session!==null;
  function clearTimers(){epoch++;clearTimeout(timer);cancelAnimationFrame(frame);timer=null;frame=null;}
  function schedule(fn,ms){const token=epoch;timer=setTimeout(()=>{if(token===epoch)fn();},ms);}
  function saveHistory(){try{localStorage.setItem(STORAGE,JSON.stringify(history));storageAvailable=true;}catch(e){storageAvailable=false;}$('history-count').textContent=history.length;$('storage-message').textContent=storageAvailable?'':'当前浏览器无法持久保存数据。关闭页面前请导出全部JSON记录包。';}
  try{const parsed=JSON.parse(localStorage.getItem(STORAGE)||'[]');if(Array.isArray(parsed))for(const r of parsed){try{history.push(CitrusRanking.validateRecord(r));}catch(e){/* Skip a malformed legacy record without losing other valid rounds. */}}}catch(e){storageAvailable=false;}
  $('history-count').textContent=history.length;
  const rankHost=document.createElement('div');rankHost.id='leaderboard-host';$('view-history').insertBefore(rankHost,$('storage-message'));
  const leaderboard=CitrusLeaderboard.mount({getRecords:()=>history,setRecords:records=>{history=records;saveHistory();renderHistory();}});
  function showView(name){
    document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!=='view-'+name);
    document.querySelectorAll('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===name);if(el.dataset.view===name)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    if(name==='concept'){syncMatrixSources();drawConcept();}if(name==='history')renderHistory();
    window.scrollTo({top:0,behavior:'instant'});
  }
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{if(active())return;showView(button.dataset.view);}));
  function lockUI(locked){$('settings-fields').disabled=locked;$('start-button').disabled=locked||!loaded;$('practice-button').disabled=locked||!loaded;$('exit-button').hidden=!locked;document.querySelectorAll('[data-view]').forEach(b=>b.disabled=locked);document.querySelector('.inspection').classList.toggle('running',locked);}
  function syncSettings(){const count=+$('trials').value,p=+$('prevalence').value/100;$('prevalence-value').textContent=pct(p).replace('.0','');$('composition').textContent=`${Math.round(count*p)} 枚霉斑样本 / ${count-Math.round(count*p)} 枚正常样本`;$('difficulty-description').textContent=({'2.6':'入门','1.8':'标准','1':'挑战'})[$('difficulty').value];}
  ['difficulty','prevalence','trials','duration'].forEach(id=>$(id).addEventListener('input',syncSettings));
  function overlay(symbol,text){$('stage-overlay').hidden=false;$('overlay-symbol').textContent=symbol;$('overlay-text').textContent=text;canvas.style.visibility='hidden';}
  function buttonsEnabled(enabled){$('answer-yes').disabled=!enabled;$('answer-no').disabled=!enabled;}
  // One monotonic visual mapping is used for BOTH latent classes. Geometry is independent
  // of the class. This avoids a hidden non-overlapping visual cue revealing the answer.
  function renderFruit(trial){
    const random=SDT.seedRandom(trial.seed),strength=1/(1+Math.exp(-(trial.evidence-1.25)*1.15));
    ctx.clearRect(0,0,800,800);ctx.fillStyle='#102822';ctx.fillRect(0,0,800,800);
    ctx.save();ctx.translate(400,400);ctx.rotate((random()-.5)*.25);ctx.drawImage(image,-400,-400,800,800);ctx.restore();
    // Natural pores and brown skin marks, unrelated to mold status.
    for(let i=0;i<80;i++){const a=random()*Math.PI*2,r=Math.sqrt(random())*245,x=400+Math.cos(a)*r,y=430+Math.sin(a)*r;ctx.fillStyle=`rgba(113,66,24,${.05+random()*.13})`;ctx.beginPath();ctx.ellipse(x,y,1+random()*3,1+random()*2,random()*3,0,Math.PI*2);ctx.fill();}
    const a=random()*Math.PI*2,r=80+random()*95,cx=400+Math.cos(a)*r,cy=425+Math.sin(a)*r;
    // Fixed-area colony clusters. Evidence controls their contrast and visible extent.
    for(let cluster=0;cluster<4;cluster++){
      const px=cx+(random()-.5)*62,py=cy+(random()-.5)*55,radius=22+random()*23;
      const halo=ctx.createRadialGradient(px,py,0,px,py,radius*1.4);halo.addColorStop(0,`rgba(144,158,122,${strength*.66})`);halo.addColorStop(.6,`rgba(177,180,151,${strength*.48})`);halo.addColorStop(1,'rgba(181,190,160,0)');ctx.fillStyle=halo;ctx.beginPath();ctx.arc(px,py,radius*1.4,0,Math.PI*2);ctx.fill();
      for(let j=0;j<340;j++){
        const angle=random()*Math.PI*2,rr=Math.sqrt(random())*radius,xx=px+Math.cos(angle)*rr,yy=py+Math.sin(angle)*rr,edge=rr/radius;
        const alpha=strength*(.3+random()*.5)*(1-.35*edge),color=edge>.7?'204,206,179':(random()>.4?'79,108,86':'135,149,118');
        ctx.fillStyle=`rgba(${color},${alpha})`;ctx.beginPath();ctx.arc(xx,yy,.5+random()*2.8,0,Math.PI*2);ctx.fill();
        if(j%4===0){ctx.strokeStyle=`rgba(219,220,199,${strength*.42})`;ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(xx,yy);ctx.lineTo(xx+Math.cos(angle)*(3+random()*4),yy+Math.sin(angle)*(3+random()*4));ctx.stroke();}
      }
    }
  }
  function resetLab(){clearTimers();session=null;phase='idle';paused=false;lockUI(false);$('response-controls').hidden=true;$('practice-feedback').hidden=true;$('stage-overlay').hidden=true;canvas.style.visibility='visible';$('image-badge').hidden=false;$('image-badge').textContent='示意样本 · 不计分';$('specimen-label').textContent='CITRUS × SIGNAL DETECTION';$('mode-label').textContent='检测准备';$('trial-label').textContent='等待开始';$('stage-status').textContent='设置参数后，开始你的第一轮检测';$('time-label').textContent='限时观察';$('exposure-bar').style.width='0%';if(loaded)renderFruit({seed:8742,evidence:1.9});}
  function start(practice=false){
    if(active()||!loaded)return;
    let participant=null;
    if(!practice){try{participant=CitrusRanking.participant($('participant').value);$('participant').value=participant;$('participant').setCustomValidity('');}catch(e){$('participant').setCustomValidity(e.message);$('participant').reportValidity();$('participant').focus();return;}}
    clearTimers();const seed=crypto.getRandomValues(new Uint32Array(1))[0];
    const config={count:practice?6:+$('trials').value,prevalence:practice?.5:+$('prevalence').value/100,dPrime:+$('difficulty').value,duration:+$('duration').value};
    session={seed,config,practice,participant,trials:SDT.makeTrials(config.count,config.prevalence,config.dPrime,seed),index:0,date:Date.now()};
    lockUI(true);showView('lab');$('response-controls').hidden=false;$('image-badge').hidden=true;$('mode-label').textContent=practice?'练习模式 · 即时反馈':'正式检测 · 独立判断';$('practice-feedback').hidden=true;nextTrial();
    if(window.innerWidth<721)document.querySelector('.inspection').scrollIntoView({block:'start',behavior:'smooth'});
  }
  function nextTrial(){
    if(!session)return;if(session.index>=session.trials.length){finish();return;}
    clearTimers();phase='fixation';buttonsEnabled(false);$('practice-feedback').hidden=true;$('trial-label').textContent=`${String(session.index+1).padStart(2,'0')} / ${session.config.count}`;$('specimen-label').textContent=`SPECIMEN ${String(session.index+1).padStart(3,'0')}`;overlay('+','请注视画面中央');$('stage-status').textContent='准备观察';$('time-label').textContent='准备中';$('exposure-bar').style.width='0%';
    schedule(()=>{
      renderFruit(session.trials[session.index]);$('stage-overlay').hidden=true;canvas.style.visibility='visible';phase='exposure';const started=performance.now();session.exposureStarted=started;$('stage-status').textContent='观察样本，图片消失后作答';
      const token=epoch;function tick(){if(token!==epoch||phase!=='exposure')return;const remaining=Math.max(0,session.config.duration-(performance.now()-started));$('exposure-bar').style.width=remaining/session.config.duration*100+'%';$('time-label').textContent=(remaining/1000).toFixed(1)+' 秒';frame=requestAnimationFrame(tick);}tick();
      schedule(()=>{cancelAnimationFrame(frame);phase='response';session.responseStarted=performance.now();session.trials[session.index].exposureMs=session.responseStarted-started;overlay('?','根据刚才的观察，判断是否存在霉斑');$('stage-status').textContent='请选择下方按钮，或按 F / J';$('time-label').textContent='等待判断';$('exposure-bar').style.width='0%';buttonsEnabled(true);},session.config.duration);
    },450);
  }
  function answer(value){
    if(phase!=='response'||paused||!session)return false;
    clearTimers();phase='gap';buttonsEnabled(false);const trial=session.trials[session.index];trial.answer=value;trial.rt=Math.round(performance.now()-session.responseStarted);session.index++;
    if(session.practice){const correct=trial.answer===trial.signal;overlay(correct?'✓':'×',`${correct?'判断正确':'本次判断有误'} · ${ALL_OUTCOMES[outcome(trial)]}`);$('practice-feedback').hidden=false;$('practice-feedback').textContent=`真实类别：${trial.signal?'霉斑样本':'正常样本'}。相似外观可能来自任一类别，依据可见特征做判断即可。`;schedule(nextTrial,1800);}else{overlay('✓','判断已记录');$('stage-status').textContent='即将呈现下一枚样本';schedule(nextTrial,280);}return true;
  }
  function finish(){
    const complete=session;clearTimers();
    if(complete.practice){resetLab();$('stage-status').textContent='练习完成，可以开始正式检测';$('practice-feedback').hidden=false;const correct=complete.trials.filter(t=>t.signal===t.answer).length;$('practice-feedback').textContent=`练习结束：${correct} / 6 次判断正确。练习不计入正式记录。`;return;}
    const record={id:String(complete.date)+'-'+complete.seed,participant:complete.participant,date:complete.date,seed:complete.seed,config:complete.config,trials:complete.trials,stats:SDT.summarize(complete.trials)};
    history.unshift(record);saveHistory();resetLab();renderResults(record);showView('results');
  }
  function renderResults(record){
    lastResult=record;const s=record.stats,c=record.config;
    $('result-meta').textContent=`${record.participant||'旧记录 · 未分配参与者'} · ${new Date(record.date).toLocaleString('zh-CN',{hour12:false})} · ${c.count} 枚样本 · 理论 d′ ${num(c.dPrime)} · P(S) ${pct(c.prevalence)} · 观察 ${(c.duration/1000).toFixed(1)} 秒`;
    const tendency=s.c>.1?'偏保守':s.c<-.1?'偏宽松':'接近中性';
    $('metric-grid').innerHTML=`<article class="metric-card"><p>实测辨别力 d′</p><strong>${num(s.dPrime)}</strong><small>越高，区分两类样本的能力越强</small></article><article class="metric-card"><p>判断标准 c</p><strong>${num(s.c)}</strong><small>${tendency} · 正值保守，负值宽松</small></article><article class="metric-card"><p>准确率</p><strong>${pct(s.accuracy)}</strong><small>${s.H+s.CR} / ${s.n} 次判断正确</small></article>`;
    $('confusion-matrix').innerHTML=`<div class="matrix"><span></span><span class="axis">判断有霉斑</span><span class="axis">判断无霉斑</span><span class="axis">真实有霉斑</span><div class="cell">击中 H<strong>${s.H}</strong><small>成功检出霉斑</small></div><div class="cell bad">漏报 M<strong>${s.M}</strong><small>霉斑样本被放行</small></div><span class="axis">真实无霉斑</span><div class="cell bad">虚报 FA<strong>${s.FA}</strong><small>正常样本被误判</small></div><div class="cell">正确拒绝 CR<strong>${s.CR}</strong><small>正常样本被放行</small></div></div>`;
    $('rate-summary').innerHTML=`<span>击中率 <strong>${pct(s.hit)}</strong></span><span>虚报率 <strong>${pct(s.fa)}</strong></span>`;
    const sensitivity=s.dPrime<0?'本轮d′为负，可能与样本较少、偶然波动或对线索的理解有关。可以先练习，再增加试次数观察。':s.dPrime<.5?'本轮对两类样本的区分较弱。可以延长观察时间或选择入门难度再试。':'本轮表现出了对两类样本的区分。可在相同条件下重复检测，观察结果是否稳定。';
    const criterion=s.c>.1?'你较少报告霉斑，往往需要更明确的线索才作出检出判断。这样的策略可能减少虚报，同时增加漏报。':s.c<-.1?'你更容易报告霉斑。这样的策略可能减少漏报，同时增加虚报。':'你的判断标准接近两类分布中点。这里将 |c| ≤ 0.10 描述为接近中性，仅为便于解读。';
    $('interpretation').innerHTML=`<p><strong>辨别能力</strong><br>${sensitivity}</p><p><strong>判断倾向 · ${tendency}</strong><br>${criterion}</p><p>本轮${s.n}次判断提供的是有限样本估计。准确率会受到霉斑比例与判断倾向影响，不能单独代表辨别能力。</p>`;
    $('formula-details').innerHTML=`<p>原始击中率 P(Hit) = H/(H+M) = ${s.H}/${s.nSignal} = ${pct(s.hit)}；原始虚报率 P(FA) = FA/(FA+CR) = ${s.FA}/${s.nNoise} = ${pct(s.fa)}。</p><p>所有轮次统一采用对数线性校正：H* = (H+0.5)/(H+M+1) = ${s.hitCorrected.toFixed(4)}；FA* = (FA+0.5)/(FA+CR+1) = ${s.faCorrected.toFixed(4)}。该处理避免0和1对应无穷Z值。上方展示的击中率、虚报率与准确率仍为原始比例。</p><p>d′ = Z(H*) − Z(FA*) = ${num(s.dPrime)}；c = −[Z(H*) + Z(FA*)]/2 = ${num(s.c)}。Z是标准正态分位数函数。准确率 = (H+CR)/N = ${pct(s.accuracy)}。</p>`;
    $('trial-review').innerHTML='<table><thead><tr><th>试次</th><th>真实类别</th><th>你的判断</th><th>结果</th><th>作答时长</th><th>重复呈现</th></tr></thead><tbody>'+record.trials.map((t,i)=>`<tr><td>${i+1}</td><td>${t.signal?'霉斑':'正常'}</td><td>${t.answer?'有霉斑':'无霉斑'}</td><td><span class="result-chip ${t.signal===t.answer?'':'bad'}">${ALL_OUTCOMES[outcome(t)]}</span></td><td>${t.rt} ms</td><td>${t.replays||0}</td></tr>`).join('')+'</tbody></table>';
  }
  function renderHistory(){
    leaderboard.render();
    $('clear-history').disabled=!history.length;
    if(!history.length){$('history-content').innerHTML='<div class="empty-state"><p class="eyebrow">NO INSPECTIONS YET</p><h2>还没有正式检测记录</h2><p>完成一轮检测后，可在这里比较辨别力与判断倾向。</p><button class="primary-button" id="empty-start">前往检测工作台</button></div>';$('empty-start').onclick=()=>showView('lab');return;}
    $('history-content').innerHTML='<div class="white-panel table-wrap"><table><thead><tr><th>参与者</th><th>检测时间</th><th>条件</th><th>实测 d′</th><th>c</th><th>击中率</th><th>虚报率</th><th>准确率</th><th></th></tr></thead><tbody>'+history.map((r,i)=>`<tr><td>${html(r.participant||'未分配')}</td><td>${new Date(r.date).toLocaleString('zh-CN',{hour12:false})}</td><td>${r.config.count}次 / d′ ${num(r.config.dPrime)} / ${pct(r.config.prevalence)} / ${(r.config.duration/1000).toFixed(1)}秒</td><td>${num(r.stats.dPrime)}</td><td>${num(r.stats.c)}</td><td>${pct(r.stats.hit)}</td><td>${pct(r.stats.fa)}</td><td>${pct(r.stats.accuracy)}</td><td><button class="history-view-button" data-record="${i}">查看报告</button></td></tr>`).join('')+'</tbody></table></div><p class="hint">不会按轮数自动删除记录，请定期导出JSON备份。比较时请留意难度、霉斑比例、观察时间和试次数是否一致。</p>';
    document.querySelectorAll('[data-record]').forEach(b=>b.onclick=()=>{renderResults(history[Number(b.dataset.record)]);showView('results');});
    $('storage-message').textContent=storageAvailable?'':'当前记录仅在此页面会话中可用，浏览器持久保存不可用。';
  }
  function exportCSV(){
    if(!lastResult)return;const r=lastResult,s=r.stats;
    const rows=[['participant','round_id','round_seed','trial','signal','response','outcome','response_ms_after_offset','actual_exposure_ms','replays','evidence','stimulus_seed','theoretical_d_prime','prevalence','planned_duration_ms','H','M','FA','CR','hit_raw','fa_raw','hit_corrected','fa_corrected','d_prime_observed','c','accuracy'],...r.trials.map((t,i)=>[r.participant||'',r.id,r.seed,i+1,+t.signal,+t.answer,outcome(t),t.rt,t.exposureMs==null?'':Math.round(t.exposureMs),t.replays,t.evidence,t.seed,r.config.dPrime,r.config.prevalence,r.config.duration,s.H,s.M,s.FA,s.CR,s.hit,s.fa,s.hitCorrected,s.faCorrected,s.dPrime,s.c,s.accuracy])];
    const cell=v=>'"'+(typeof v==='string'?v.replace(/^[=+@-]/,"'$&"):String(v)).replace(/"/g,'""')+'"';
    const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='citrus-sdt-'+r.date+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  // SVG charts depict the analytical equal-variance SDT model, not fitted empirical ROC.
  function syncMatrixSources(){
    const source=$('matrix-source'),previous=source.value;
    source.replaceChildren(new Option('当前滑块 · 理论模型','theory'));
    history.forEach((record,i)=>source.add(new Option(`${i+1}. ${new Date(record.date).toLocaleString('zh-CN',{hour12:false})} · ${record.config.count}次`,record.id)));
    if(history.some(record=>record.id===previous))source.value=previous;
    if(!history.length){const empty=new Option('完成正式检测后，可选择实际数据','empty');empty.disabled=true;source.add(empty);}
  }
  function drawConceptMatrix(){
    const record=history.find(r=>r.id===$('matrix-source').value),empirical=Boolean(record),unit=$('matrix-unit');
    unit.querySelector('[value="count"]').disabled=!empirical;
    if(!empirical)unit.value='probability';
    const counts=unit.value==='count';
    const d=+$('model-d').value,c=+$('model-c').value,k=d/2+c;
    const hit=empirical?record.stats.hit:1-SDT.normalCDF(k-d),fa=empirical?record.stats.fa:1-SDT.normalCDF(k);
    const rates={H:hit,FA:fa,M:1-hit,CR:1-fa};
    for(const key of ['H','FA','M','CR']){
      const denominator=empirical?(['H','M'].includes(key)?record.stats.nSignal:record.stats.nNoise):null;
      $('matrix-'+key).textContent=counts?String(record.stats[key]):rates[key].toFixed(2);
      $('matrix-'+key+'-detail').textContent=empirical?`${record.stats[key]} / ${denominator} · ${pct(rates[key])}`:pct(rates[key]);
    }
    $('matrix-kind').textContent=empirical?(counts?'实际判断次数':'实际条件概率'):'理论条件概率';
    $('matrix-context').textContent=empirical?`已选轮次：${new Date(record.date).toLocaleString('zh-CN',{hour12:false})} · ${record.config.count}次 · 设置d′ ${num(record.config.dPrime)} · P(S) ${pct(record.config.prevalence)} · 观察 ${(record.config.duration/1000).toFixed(1)}秒`:`随上方滑块更新 · 理论d′ ${num(d)} · c ${num(c)}`;
    $('matrix-explanation').textContent=empirical
      ?(counts?'四格显示原始次数，合计为本轮总试次数。小字给出次数／该真实类别的总数及对应比例。':'四格显示原始条件概率，未做加0.5校正。有信号列 H + M = 1，无信号列 FA + CR = 1；每格以其所在列的真实类别总数为分母。')+' 当前为已完成轮次的固定数据，上方滑块只改变理论图表。'
      :'每格表示给定真实状态时作出该反应的概率。有信号列 H + M = 1，无信号列 FA + CR = 1；四格不按全部样本归一化。改变d′或c会更新矩阵。';
  }
  function drawConcept(){
    const d=+$('model-d').value,c=+$('model-c').value,k=d/2+c,cdf=SDT.normalCDF,hit=1-cdf(k-d),fa=1-cdf(k);
    $('model-d-value').textContent=num(d);$('model-c-value').textContent=num(c);
    const X=x=>50+(x+4)/12*610,Y=y=>285-y*530,gauss=x=>Math.exp(-x*x/2)/Math.sqrt(2*Math.PI);
    let svg='<line x1="50" y1="285" x2="660" y2="285" stroke="#aabeb0"/>';
    for(let x=-4;x<=8;x+=2)svg+=`<text x="${X(x)}" y="309" text-anchor="middle" fill="#677970" font-size="13">${x}</text>`;
    for(const [mean,color] of [[0,'#529483'],[d,'#de8e32']]){
      let path='',area=`M ${X(Math.max(-4,k))} 285 `;
      for(let i=0;i<=240;i++){const x=-4+i*.05;path+=(i?'L':'M')+X(x).toFixed(2)+' '+Y(gauss(x-mean)).toFixed(2)+' ';}
      for(let i=0;i<=200;i++){const x=Math.max(-4,k)+(8-Math.max(-4,k))*i/200;area+='L'+X(x).toFixed(2)+' '+Y(gauss(x-mean)).toFixed(2)+' ';}area+=`L ${X(8)} 285 Z`;
      svg+=`<path d="${area}" fill="${color}" opacity=".13"/><path d="${path}" fill="none" stroke="${color}" stroke-width="3"/>`;
    }
    svg+=`<line x1="${X(k)}" y1="32" x2="${X(k)}" y2="285" stroke="#173b30" stroke-width="1.5" stroke-dasharray="5 5"/><text x="${X(k)}" y="22" text-anchor="middle" font-size="13" fill="#173b30">阈值 ${num(k)}</text><text x="355" y="335" text-anchor="middle" fill="#677970" font-size="13">霉斑特征强度 x</text>`;$('distribution-chart').innerHTML=svg;
    const rx=v=>58+v*290,ry=v=>285-v*260;
    let roc='';for(let i=0;i<=5;i++){const v=i/5;roc+=`<line x1="58" y1="${ry(v)}" x2="348" y2="${ry(v)}" stroke="#e4ebe6"/><text x="45" y="${ry(v)+4}" text-anchor="end" font-size="12" fill="#677970">${v.toFixed(1)}</text><text x="${rx(v)}" y="307" text-anchor="middle" font-size="12" fill="#677970">${v.toFixed(1)}</text>`;}
    roc+='<line x1="58" y1="285" x2="348" y2="25" stroke="#9eafa3" stroke-dasharray="5 5"/><line x1="58" y1="25" x2="58" y2="285" stroke="#aabeb0"/>';
    let path='';for(let i=0;i<=200;i++){const threshold=8-i*.08;path+=(i?'L':'M')+rx(1-cdf(threshold)).toFixed(2)+' '+ry(1-cdf(threshold-d)).toFixed(2)+' ';}
    roc+=`<path d="${path}" stroke="#205c43" stroke-width="3" fill="none"/><circle cx="${rx(fa)}" cy="${ry(hit)}" r="6" fill="#f6a447" stroke="#fff" stroke-width="2"/>`;
    if(lastResult){roc+=`<circle cx="${rx(lastResult.stats.fa)}" cy="${ry(lastResult.stats.hit)}" r="7" fill="none" stroke="#b05543" stroke-width="2"/>`;}
    roc+='<text x="204" y="336" text-anchor="middle" font-size="13" fill="#677970">虚报率 P(FA)</text><text x="15" y="154" transform="rotate(-90 15 154)" text-anchor="middle" font-size="13" fill="#677970">击中率 P(Hit)</text>';$('roc-chart').innerHTML=roc;
    $('model-rates').innerHTML=[['理论击中率',pct(hit)],['理论虚报率',pct(fa)],['理论漏报率',pct(1-hit)],['理论正确拒绝率',pct(1-fa)]].map(([label,value])=>`<div>${label}<strong>${value}</strong></div>`).join('');
    drawConceptMatrix();
  }
  function pause(){if(!active()||paused)return;clearTimers();paused=true;buttonsEnabled(false);overlay('Ⅱ','检测已暂停');$('exposure-bar').style.width='0%';$('pause-dialog').showModal();}
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&active()){if($('exit-dialog').open)$('exit-dialog').close();pause();}});
  $('resume-button').onclick=()=>{if(!session)return;$('pause-dialog').close();paused=false;if(phase!=='gap'&&session.index<session.trials.length)session.trials[session.index].replays++;nextTrial();};
  $('pause-dialog').addEventListener('cancel',e=>e.preventDefault());
  $('start-button').onclick=()=>start(false);$('practice-button').onclick=()=>start(true);$('answer-no').onclick=()=>answer(false);$('answer-yes').onclick=()=>answer(true);
  document.addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.altKey||e.metaKey||document.querySelector('dialog[open]')||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.code==='KeyF'||e.code==='KeyJ'){if(phase==='response'){e.preventDefault();answer(e.code==='KeyJ');}}});
  $('exit-button').onclick=()=>{if(!paused){clearTimers();paused=true;buttonsEnabled(false);overlay('Ⅱ','检测已暂停');}$('exit-dialog').showModal();};
  function cancelExit(){if(!session)return;$('exit-dialog').close();paused=false;if(phase!=='gap'&&session.index<session.trials.length)session.trials[session.index].replays++;nextTrial();}
  $('cancel-exit').onclick=cancelExit;$('exit-dialog').addEventListener('cancel',e=>{e.preventDefault();cancelExit();});$('confirm-exit').onclick=()=>{$('exit-dialog').close();resetLab();};
  $('again-button').onclick=()=>{resetLab();showView('lab');};$('explore-button').onclick=()=>{$('model-d').value=lastResult.config.dPrime;showView('concept');};$('export-button').onclick=exportCSV;
  $('clear-history').onclick=()=>$('clear-dialog').showModal();$('cancel-clear').onclick=()=>$('clear-dialog').close();$('confirm-clear').onclick=()=>{history=[];saveHistory();renderHistory();$('clear-dialog').close();};
  $('model-d').oninput=drawConcept;$('model-c').oninput=drawConcept;
  $('participant').oninput=()=>$('participant').setCustomValidity('');
  $('matrix-source').onchange=drawConceptMatrix;$('matrix-unit').onchange=drawConceptMatrix;
  window.addEventListener('beforeunload',e=>{if(active()){e.preventDefault();e.returnValue='';}});
  image.onload=()=>{loaded=true;$('start-button').textContent='开始正式检测';$('asset-message').textContent='样本已就绪 · 正式检测至少20次';resetLab();};
  image.onerror=()=>{$('asset-message').textContent='样本图片加载失败，请确认 assets/orange.png 随网页一同保留，再刷新页面。';$('start-button').textContent='样本加载失败';};image.src='assets/orange.png';syncSettings();
  // Optional WebMCP read tool: does not expose stimulus truth during an active round.
  if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'read_citrus_lab_status',description:'Read the current visible experiment phase and completed results; no hidden trial answers are returned.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:input=>{if(!input||Object.keys(input).length)throw new Error('Expected an empty object');return {phase,practice:session?.practice??false,completed:session?.index??0,total:session?.config.count??0,lastCompletedResult:active()?null:(lastResult?.stats??null)};}})).catch(()=>{});}catch(e){/* Optional browser API; normal operation does not depend on it. */}}
})();
