/* Pure SDT mathematics, shared by the app and Node validation. No network dependencies. */
(function(root){
  'use strict';
  function normalCDF(x){
    const a=Math.abs(x),t=1/(1+0.2316419*a);
    const p=1-Math.exp(-a*a/2)/Math.sqrt(2*Math.PI)*t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
    return x>=0?p:1-p;
  }
  // Acklam's inverse-normal rational approximation, accurate enough for SDT display.
  function normalInv(p){
    if(!(p>0&&p<1))throw new RangeError('Probability must be inside (0, 1)');
    const a=[-39.6968302866538,220.946098424521,-275.928510446969,138.357751867269,-30.6647980661472,2.50662827745924];
    const b=[-54.4760987982241,161.585836858041,-155.698979859887,66.8013118877197,-13.2806815528857];
    const c=[-0.00778489400243029,-0.322396458041136,-2.40075827716184,-2.54973253934373,4.37466414146497,2.93816398269878];
    const d=[0.00778469570904146,0.32246712907004,2.445134137143,3.75440866190742];
    if(p<0.02425){const q=Math.sqrt(-2*Math.log(p));return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
    if(p>0.97575)return -normalInv(1-p);
    const q=p-.5,r=q*q;return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  }
  function seedRandom(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
  function gaussian(random){return Math.sqrt(-2*Math.log(Math.max(random(),Number.EPSILON)))*Math.cos(2*Math.PI*random());}
  function makeTrials(count,prevalence,dPrime,seed){
    if(![6,20,40,60].includes(count)||!(prevalence>0&&prevalence<1)||!Number.isFinite(dPrime)||dPrime<0)throw new RangeError('Invalid trial configuration');
    const random=seedRandom(seed),positive=Math.round(count*prevalence);
    if(positive===0||positive===count)throw new RangeError('Both classes are required');
    const trials=Array.from({length:count},(_,i)=>{const signal=i<positive;return {signal,evidence:gaussian(random)+(signal?dPrime:0),seed:Math.floor(random()*4294967296),replays:0};});
    for(let i=count-1;i>0;i--){const j=Math.floor(random()*(i+1));[trials[i],trials[j]]=[trials[j],trials[i]];}return trials;
  }
  function summarize(trials){
    const counts={H:0,M:0,FA:0,CR:0};
    for(const trial of trials){if(typeof trial.signal!=='boolean'||typeof trial.answer!=='boolean')throw new Error('Unanswered trial');counts[trial.signal?(trial.answer?'H':'M'):(trial.answer?'FA':'CR')]++;}
    const {H,M,FA,CR}=counts,nSignal=H+M,nNoise=FA+CR;
    if(!nSignal||!nNoise)throw new Error('Both classes are required');
    const hit=H/nSignal,fa=FA/nNoise,hitCorrected=(H+.5)/(nSignal+1),faCorrected=(FA+.5)/(nNoise+1),zH=normalInv(hitCorrected),zF=normalInv(faCorrected);
    return {...counts,n:trials.length,nSignal,nNoise,hit,fa,hitCorrected,faCorrected,dPrime:zH-zF,c:-(zH+zF)/2,accuracy:(H+CR)/trials.length};
  }
  root.SDT={normalCDF,normalInv,seedRandom,gaussian,makeTrials,summarize};
  if(typeof module!=='undefined')module.exports=root.SDT;
})(typeof window!=='undefined'?window:globalThis);
