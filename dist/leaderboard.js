/* Local leaderboard UI. Record imports are atomic and duplicate-safe. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),R=CitrusRanking;
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const pct=x=>(100*x).toFixed(1)+'%',number=x=>(Math.abs(x)<.0005?0:x).toFixed(2);
 const conditionLabel=c=>`d′ ${c.dPrime} · P(S) ${Math.round(c.prevalence*100)}% · ${c.duration/1000}秒 · 每轮${c.count}次`;
 function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function drawROC(rows){
   const svg=$('rank-roc-chart'),key=$('rank-roc-key'),x=v=>74+v*560,y=v=>360-v*300;
   let markup='<rect x="74" y="60" width="560" height="300" rx="4" fill="#f7faf8"/>';
   for(let i=0;i<=5;i++){
     const v=i/5;
     markup+=`<line x1="74" y1="${y(v)}" x2="634" y2="${y(v)}" class="roc-grid"/><line x1="${x(v)}" y1="60" x2="${x(v)}" y2="360" class="roc-grid"/><text x="61" y="${y(v)+5}" text-anchor="end" class="roc-tick">${v.toFixed(1)}</text><text x="${x(v)}" y="385" text-anchor="middle" class="roc-tick">${v.toFixed(1)}</text>`;
   }
   markup+='<line x1="74" y1="360" x2="634" y2="60" class="roc-chance"/><text x="362" y="418" text-anchor="middle" class="roc-axis-label">虚报率 P(FA)</text><text x="20" y="210" transform="rotate(-90 20 210)" text-anchor="middle" class="roc-axis-label">击中率 P(Hit)</text>';
   if(!rows.length){markup+='<text x="354" y="218" text-anchor="middle" class="roc-empty">当前条件下暂无可显示的成绩</text>';key.innerHTML='';svg.innerHTML=markup;return;}
   const groups=new Map();
   for(const row of rows){const groupKey=`${row.stats.fa.toFixed(12)}|${row.stats.hit.toFixed(12)}`;if(!groups.has(groupKey))groups.set(groupKey,[]);groups.get(groupKey).push(row);}
   const colors=['#d7832c','#3b8068','#4776a8','#805f9b','#8e6c43','#52776a'];
   [...groups.values()].forEach((group,index)=>{
     const first=group[0],cx=x(first.stats.fa),cy=y(first.stats.hit),color=colors[Math.min(index,colors.length-1)],names=group.map(r=>r.participant).join('、'),rank=first.rank;
     const label=(group.length>1?`${rank}名并列 · `:`${rank}名 · `)+names;
     const anchor=first.stats.fa>.72?'end':'start',labelX=cx+(anchor==='end'?-15:15),labelY=Math.max(50,Math.min(374,cy+(index%2?-17:22)));
     markup+=`<g class="roc-point"><title>${escape(label)}；击中率${pct(first.stats.hit)}，虚报率${pct(first.stats.fa)}，d′ ${number(first.stats.dPrime)}</title><circle cx="${cx}" cy="${cy}" r="13" fill="${color}"/><text x="${cx}" y="${cy+4}" text-anchor="middle" class="roc-rank">${rank}</text><text x="${labelX}" y="${labelY}" text-anchor="${anchor}" class="roc-label">${escape(group.length>1?`${names}（${group.length}人并列）`:names)}</text></g>`;
   });
   svg.innerHTML=markup;
   key.innerHTML=rows.map(row=>`<span><b>${row.rank}</b><strong>${escape(row.participant)}</strong><small>H ${pct(row.stats.hit)} · FA ${pct(row.stats.fa)} · d′ ${number(row.stats.dPrime)}</small></span>`).join('');
 }
 window.CitrusLeaderboard={mount({getRecords,setRecords}){
   $('leaderboard-host').append($('leaderboard-template').content.cloneNode(true));
   let current=null;
   function render(){
     const records=getRecords(),select=$('rank-condition'),previous=select.value;
     const conditions=new Map(records.map(r=>[R.conditionKey(r.config),r.config]));
     select.replaceChildren();for(const [key,c] of conditions)select.add(new Option(conditionLabel(c),key));
     if(conditions.has(previous))select.value=previous;
     if(!conditions.size)select.add(new Option('完成正式检测或导入记录后选择',''));
     select.disabled=!conditions.size;$('bundle-export').disabled=!records.length;
     const mode=$('rank-mode').value,required=+$('rank-rounds').value;$('rank-rounds').disabled=mode==='round';
     current=R.rank(records,select.value,mode,required);
     drawROC(current.rows);
     $('rank-rule').textContent=mode==='round'?'每条记录是一轮完整检测，按未四舍五入的实测d′降序排列。同分并列，c只描述判断倾向。':'每人取当前数据中时间最早的'+required+'轮，汇总四类次数后重新计算d′，每人只占一行。不足轮数暂不入榜；新增更早记录时会重新选取。';
     $('rank-unassigned').textContent=current.unassigned?`${current.unassigned}轮旧记录没有参与者编号，仍保留在检测记录中，不进入排行榜。`:'';
     if(!current.rows.length)$('rank-table').innerHTML='<div class="empty-state"><h3>当前条件下暂无可排名的成绩</h3><p>正式检测前填写参与者编号；个人榜还需达到规定轮数。</p></div>';
     else $('rank-table').innerHTML='<table><thead><tr><th>名次</th><th>参与者</th><th>实测d′</th><th>准确率</th><th>击中率</th><th>虚报率</th><th>c</th><th>轮数 / 试次数</th><th>纳入轮次</th></tr></thead><tbody>'+current.rows.map(row=>`<tr><td>${row.rank}</td><td>${escape(row.participant)}</td><td><strong>${number(row.stats.dPrime)}</strong></td><td>${pct(row.stats.accuracy)}</td><td>${pct(row.stats.hit)}</td><td>${pct(row.stats.fa)}</td><td>${number(row.stats.c)}</td><td>${row.rounds} / ${row.stats.n}</td><td><details><summary>查看${row.rounds}轮</summary><span class="rank-ids">${row.ids.map(escape).join('<br>')}</span></details></td></tr>`).join('')+'</tbody></table>';
     $('rank-waiting').innerHTML=current.waiting.length?'<p>尚未达到规定轮数</p><ul>'+current.waiting.map(w=>`<li>${escape(w.participant)}：${w.completed} / ${w.required}轮</li>`).join('')+'</ul>':'';
     $('rank-export').disabled=!current.rows.length;
   }
   ['rank-condition','rank-mode','rank-rounds'].forEach(id=>$(id).onchange=render);
   $('bundle-export').onclick=()=>download('citrus-records-'+Date.now()+'.json',JSON.stringify({format:'citrus-sdt-records',version:1,exportedAt:new Date().toISOString(),records:getRecords()},null,2),'application/json');
   $('bundle-import').onclick=()=>$('bundle-file').click();
   $('bundle-file').onchange=async event=>{
     const file=event.target.files[0];if(!file)return;
     $('bundle-import').disabled=true;
     try{
       if(file.size>10*1024*1024)throw new Error('文件超过10MB，请拆分后导入');
       const incoming=R.parseBundle(await file.text()),merged=R.merge(getRecords(),incoming);
       setRecords(merged.records);render();$('import-status').textContent=`已导入${merged.added}轮，跳过${merged.duplicates}条重复记录。所有成绩已依据逐试次回答重新计算。`;
     }catch(e){$('import-status').textContent='导入失败：'+e.message+'。原有记录未改变。';}
     finally{$('bundle-file').value='';$('bundle-import').disabled=false;}
   };
   $('rank-export').onclick=()=>{
     if(!current?.rows.length)return;
     // Quoting plus formula-prefix neutralization keeps user IDs safe in spreadsheets.
     const cell=v=>'"'+(typeof v==='string'?v.replace(/^[=+@-]/,"'$&"):String(v)).replace(/"/g,'""')+'"';
     const rows=[['rank','participant','condition','mode','rounds','trials','d_prime','accuracy','hit_rate','false_alarm_rate','c','H','M','FA','CR','round_ids'],...current.rows.map(r=>[r.rank,r.participant,$('rank-condition').selectedOptions[0].textContent,$('rank-mode').value,r.rounds,r.stats.n,r.stats.dPrime,r.stats.accuracy,r.stats.hit,r.stats.fa,r.stats.c,r.stats.H,r.stats.M,r.stats.FA,r.stats.CR,r.ids.join(';')])];
     download('citrus-ranking-'+Date.now()+'.csv','\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8');
   };
   return {render};
 }};
})();
