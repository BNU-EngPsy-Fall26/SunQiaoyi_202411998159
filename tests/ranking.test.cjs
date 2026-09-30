'use strict';
const assert=require('node:assert/strict'),R=require('../dist/ranking.js'),SDT=require('../dist/sdt.js');
function record(id,participant,h=8,fa=2,date=1000,d=1.8){
 const rows=(signal,answer,n)=>Array.from({length:n},()=>({signal,answer,seed:1,evidence:1,rt:500,replays:0}));
 return R.validateRecord({id,participant,date,seed:1,config:{count:20,dPrime:d,prevalence:.5,duration:1600},trials:[...rows(true,true,h),...rows(true,false,10-h),...rows(false,true,fa),...rows(false,false,10-fa)]});
}
const a1=record('a1','甲',5,5,1),a2=record('a2','甲',10,0,2),a3=record('a3','甲',10,0,3),b1=record('b1','乙',7,3,1),b2=record('b2','乙',7,3,2),other=record('c1','丙',10,0,1,2.6),old=record('old',null);
const records=[a3,a2,a1,b1,b2,other,old],key=R.conditionKey(a1.config);
let result=R.rank(records,key,'person',2);assert.equal(result.rows.length,2);assert.deepEqual(result.rows.find(r=>r.participant==='甲').ids,['a1','a2']);assert.equal(result.unassigned,1);
const pooled=SDT.summarize([...a1.trials,...a2.trials]);assert.equal(result.rows.find(r=>r.participant==='甲').stats.dPrime,pooled.dPrime);assert.notEqual(pooled.dPrime,(a1.stats.dPrime+a2.stats.dPrime)/2);
result=R.rank(records,key,'person',3);assert.equal(result.rows.length,1);assert.equal(result.waiting[0].participant,'乙');
result=R.rank([a2,a3,b1],key);assert.deepEqual(result.rows.map(r=>r.rank),[1,1,3]);
assert.equal(R.merge([a1],[a1]).duplicates,1);assert.equal(R.merge([a1],[b1,b1]).added,1);
assert.throws(()=>R.merge([a1],[{...a1,participant:'别人'}]),/不同内容/);assert.equal(a1.participant,'甲');
assert.throws(()=>R.validateRecord({...a1,config:{...a1.config,count:40}}));assert.throws(()=>R.validateRecord({...a1,trials:a1.trials.map(t=>({...t,signal:true}))}));
const bundle=JSON.stringify({format:'citrus-sdt-records',version:1,records:[{...a1,stats:{dPrime:999}}]});assert.equal(R.parseBundle(bundle)[0].stats.dPrime,a1.stats.dPrime);
assert.throws(()=>R.parseBundle('{'));assert.throws(()=>R.parseBundle(JSON.stringify({records:[a1]})));assert.throws(()=>R.participant(' '));assert.equal(R.participant(' Ｐ００１ '),'P001');
console.log('PASS: same-condition separation, pooled SDT, earliest-K, insufficient rounds, ties, legacy records, atomic merge, duplicates, corrupt and forged-summary imports.');
module.exports={record};
