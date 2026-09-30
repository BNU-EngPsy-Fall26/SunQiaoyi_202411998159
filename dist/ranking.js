/* Pure local record validation and ranking. Imported summaries are never trusted. */
(function(root){
 'use strict';
 const math=typeof module!=='undefined'&&module.exports?require('./sdt.js'):root.SDT;
 function participant(value){
   if(typeof value!=='string')throw new Error('参与者编号必须是文本');
   const name=value.normalize('NFKC').trim();
   if(!name||name.length>24||/[\u0000-\u001f\u007f]/.test(name))throw new Error('请填写1至24个字符的参与者编号，不含控制字符');
   return name;
 }
 function validateRecord(r){
   if(!r||typeof r!=='object'||typeof r.id!=='string'||! /^[A-Za-z0-9_-]{1,100}$/.test(r.id))throw new Error('轮次标识无效');
   const c=r.config;
   if(!c||![20,40,60].includes(c.count)||![1,1.8,2.6].includes(c.dPrime)||![.3,.5,.7].includes(c.prevalence)||![1000,1600,2400].includes(c.duration))throw new Error('轮次条件无效，练习记录不能导入');
   if(!Number.isSafeInteger(r.date)||r.date<0||r.date>8640000000000000||!Number.isInteger(r.seed)||r.seed<0||r.seed>4294967295)throw new Error('时间或随机种子无效');
   if(!Array.isArray(r.trials)||r.trials.length!==c.count)throw new Error('试次数与设置不一致');
   const trials=r.trials.map(t=>{
     if(!t||typeof t.signal!=='boolean'||typeof t.answer!=='boolean'||!Number.isFinite(t.rt)||t.rt<0||!Number.isFinite(t.evidence)||!Number.isInteger(t.seed)||t.seed<0||t.seed>4294967295)throw new Error('逐试次数据无效或未完成');
     const replays=t.replays??0,exposureMs=t.exposureMs??null;
     if(!Number.isInteger(replays)||replays<0||(exposureMs!==null&&(!Number.isFinite(exposureMs)||exposureMs<0)))throw new Error('呈现记录无效');
     return {signal:t.signal,answer:t.answer,rt:t.rt,evidence:t.evidence,seed:t.seed,replays,exposureMs};
   });
   const stats=math.summarize(trials);
   if(stats.nSignal!==Math.round(c.count*c.prevalence))throw new Error('真实类别数量与P(S)不一致');
   return {id:r.id,participant:r.participant==null?null:participant(r.participant),date:r.date,seed:r.seed,config:{count:c.count,dPrime:c.dPrime,prevalence:c.prevalence,duration:c.duration},trials,stats};
 }
 const conditionKey=c=>[c.dPrime,c.prevalence,c.duration,c.count].join('|');
 function parseBundle(text){
   let bundle;try{bundle=JSON.parse(text);}catch(e){throw new Error('文件不是有效的JSON数据包');}
   if(bundle?.format!=='citrus-sdt-records'||bundle.version!==1||!Array.isArray(bundle.records))throw new Error('请选择本站导出的JSON记录包，CSV仅用于查看试次');
   if(!bundle.records.length||bundle.records.length>2000)throw new Error('每个记录包需包含1至2000轮数据');
   return bundle.records.map((r,i)=>{try{return validateRecord(r);}catch(e){throw new Error(`第${i+1}条记录：${e.message}`);}});
 }
 function merge(existing,incoming){
   const result=new Map(existing.map(r=>[r.id,r]));let added=0,duplicates=0;
   for(const candidate of incoming){const r=validateRecord(candidate),previous=result.get(r.id);
     if(previous){if(JSON.stringify(validateRecord(previous))!==JSON.stringify(r))throw new Error('同一轮次标识对应不同内容，已取消本次导入');duplicates++;}
     else{result.set(r.id,r);added++;}
   }
   if(result.size>2000)throw new Error('合并后超过2000轮，请分开管理数据包');
   return {records:[...result.values()].sort((a,b)=>b.date-a.date||a.id.localeCompare(b.id)),added,duplicates};
 }
 function rank(records,key,mode='round',required=3){
   if(!['round','person'].includes(mode)||![1,2,3,5].includes(required))throw new Error('排名设置无效');
   const eligible=records.filter(r=>r.participant&&conditionKey(r.config)===key);
   const groups=new Map();for(const r of eligible){if(!groups.has(r.participant))groups.set(r.participant,[]);groups.get(r.participant).push(r);}
   const waiting=[];let rows=[];
   if(mode==='round')rows=eligible.map(r=>({participant:r.participant,ids:[r.id],date:r.date,rounds:1,stats:math.summarize(r.trials)}));
   else for(const [name,items] of groups){
     items.sort((a,b)=>a.date-b.date||a.id.localeCompare(b.id));
     if(items.length<required){waiting.push({participant:name,completed:items.length,required});continue;}
     const selected=items.slice(0,required);
     rows.push({participant:name,ids:selected.map(r=>r.id),date:selected[selected.length-1].date,rounds:required,stats:math.summarize(selected.flatMap(r=>r.trials))});
   }
   rows.sort((a,b)=>b.stats.dPrime-a.stats.dPrime||a.date-b.date||a.participant.localeCompare(b.participant));
   let position=0;rows.forEach((row,i)=>{if(!i||Math.abs(row.stats.dPrime-rows[i-1].stats.dPrime)>1e-10)position=i+1;row.rank=position;});
   return {rows,waiting,unassigned:records.filter(r=>!r.participant).length};
 }
 root.CitrusRanking={participant,validateRecord,conditionKey,parseBundle,merge,rank};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.CitrusRanking;
})(typeof window!=='undefined'?window:globalThis);
