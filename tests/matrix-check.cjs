/* Focused regression check. Playwright and Edge are optional development tools. */
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
(async()=>{
 const output=path.resolve(__dirname,'../.sites-runtime/qa');fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1080}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname,'../dist/index.html')).href);
  await page.locator('#start-button:not([disabled])').waitFor();
  await page.locator('[data-view="concept"]').click();
  assert.equal(await page.locator('#matrix-source option:not([disabled])').count(),1);
  assert.equal(await page.locator('#matrix-unit option[value="count"]').isDisabled(),true);
  const cells=async()=>Promise.all(['H','FA','M','CR'].map(k=>page.locator('#matrix-'+k).innerText()));
  await page.locator('#model-d').fill('0');await page.locator('#model-c').fill('0');
  assert.deepEqual(await cells(),['0.50','0.50','0.50','0.50']);
  await page.locator('#model-d').fill('2');await page.locator('#model-c').fill('1');
  assert.deepEqual(await cells(),['0.50','0.02','0.50','0.98']);
  await page.locator('#model-d').fill('4');await page.locator('#model-c').fill('-2');
  assert.deepEqual(await cells(),['1.00','0.50','0.00','0.50']);
  await page.evaluate(()=>{
    const row=(signal,answer,n)=>Array.from({length:n},()=>({signal,answer,rt:400,evidence:1,seed:10,replays:0}));
    localStorage.setItem('citrus-sdt-v1',JSON.stringify([{id:'matrix-test',seed:10,date:1790575200000,config:{count:20,prevalence:.5,dPrime:1.8,duration:1600},trials:[...row(true,true,6),...row(true,false,4),...row(false,true,1),...row(false,false,9)]}]));
  });
  await page.reload();await page.locator('#start-button:not([disabled])').waitFor();await page.locator('[data-view="concept"]').click();
  await page.locator('#matrix-source').selectOption('matrix-test');
  assert.deepEqual(await cells(),['0.60','0.10','0.40','0.90']);
  await page.locator('#model-d').fill('0');await page.locator('#model-c').fill('2');
  assert.deepEqual(await cells(),['0.60','0.10','0.40','0.90']);
  await page.locator('#matrix-unit').selectOption('count');assert.deepEqual(await cells(),['6','1','4','9']);
  await page.locator('[data-view="lab"]').click();await page.locator('[data-view="concept"]').click();
  assert.deepEqual(await cells(),['6','1','4','9']);
  await page.locator('#matrix-unit').selectOption('probability');
  await page.locator('.concept-matrix-panel').screenshot({path:path.join(output,'matrix-desktop.png')});
  await page.setViewportSize({width:390,height:844});await page.locator('.concept-matrix-panel').screenshot({path:path.join(output,'matrix-mobile.png')});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await page.locator('#matrix-unit').selectOption('count');await page.locator('#matrix-source').selectOption('theory');
  assert.equal(await page.locator('#matrix-unit').inputValue(),'probability');
  await page.locator('#matrix-source').selectOption('matrix-test');
  await page.locator('[data-view="history"]').click();await page.locator('#clear-history').click();await page.locator('#confirm-clear').click();
  await page.locator('[data-view="concept"]').click();assert.equal(await page.locator('#matrix-source').inputValue(),'theory');
  assert.deepEqual(errors,[]);
  console.log('PASS: theoretical slider updates, column normalization, actual probabilities/counts, source persistence, no alteration of actual data, empty/deleted history, mobile layout, file:// operation.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
