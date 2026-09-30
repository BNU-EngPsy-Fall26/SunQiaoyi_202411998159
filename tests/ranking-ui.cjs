'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {record}=require('./ranking.test.cjs');
(async()=>{
 const output=path.resolve(__dirname,'../.sites-runtime/qa');fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1080}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname,'../dist/index.html')).href);await page.locator('#start-button:not([disabled])').waitFor();
  await page.locator('#start-button').click();assert.equal(await page.locator('#participant').evaluate(el=>el.validity.valid),false);assert.equal(await page.locator('#mode-label').innerText(),'检测准备');
  const records=[record('p1a','P001',7,2,100),record('p1b','P001',8,1,200),record('p1c','P001',9,1,300),record('p2a','P002',6,3,100),record('p2b','P002',7,2,200),record('other','P003',10,0,100,2.6)];
  await page.evaluate(rows=>localStorage.setItem('citrus-sdt-v1',JSON.stringify(rows)),records);await page.reload();await page.locator('#start-button:not([disabled])').waitFor();await page.locator('[data-view="history"]').click();
  assert.equal(await page.locator('#rank-condition option').count(),2);assert.equal(await page.locator('#rank-table tbody tr').count(),5);
  assert.equal(await page.locator('#rank-roc-chart .roc-point').count(),4);assert.equal(await page.locator('#rank-roc-key>span').count(),5);assert.ok((await page.locator('#rank-roc-chart').textContent()).includes('P001'));
  await page.locator('#rank-mode').selectOption('person');assert.equal(await page.locator('#rank-table tbody tr').count(),1);assert.ok((await page.locator('#rank-waiting').innerText()).includes('P002'));
  assert.equal(await page.locator('#rank-roc-chart .roc-point').count(),1);
  await page.locator('#rank-rounds').selectOption('2');assert.equal(await page.locator('#rank-table tbody tr').count(),2);
  assert.equal(await page.locator('#rank-roc-chart .roc-point').count(),2);
  const nextDownload=page.waitForEvent('download');await page.locator('#bundle-export').click();const bundleFile=path.join(output,'ranking-export.json');await(await nextDownload).saveAs(bundleFile);assert.equal(JSON.parse(fs.readFileSync(bundleFile,'utf8')).records.length,6);
  await page.locator('#bundle-file').setInputFiles(bundleFile);await page.locator('#import-status').filter({hasText:'跳过6条'}).waitFor();assert.equal(await page.locator('#history-count').innerText(),'6');
  const importFile=path.join(output,'ranking-input.json');
  fs.writeFileSync(importFile,JSON.stringify({format:'citrus-sdt-records',version:1,records:[record('xss','<img src=x>',8,2,400),{bad:true}]}));
  await page.locator('#bundle-file').setInputFiles(importFile);await page.locator('#import-status').filter({hasText:'导入失败'}).waitFor();assert.equal(await page.locator('#history-count').innerText(),'6');
  fs.writeFileSync(importFile,JSON.stringify({format:'citrus-sdt-records',version:1,records:[record('xss','<img src=x>',8,2,400),record('p2c','P002',7,1,300)]}));
  await page.locator('#bundle-file').setInputFiles(importFile);await page.locator('#import-status').filter({hasText:'已导入2轮'}).waitFor();assert.equal(await page.locator('#history-count').innerText(),'8');assert.equal(await page.locator('#history-content img').count(),0);
  await page.locator('#rank-rounds').selectOption('3');assert.equal(await page.locator('#rank-table tbody tr').count(),2);
  const csvDownload=page.waitForEvent('download');await page.locator('#rank-export').click();const csvFile=path.join(output,'ranking.csv');await(await csvDownload).saveAs(csvFile);assert.equal(fs.readFileSync(csvFile,'utf8').trim().split(/\r?\n/).length,3);
  await page.locator('.leaderboard-panel').screenshot({path:path.join(output,'leaderboard-desktop.png')});
  await page.setViewportSize({width:390,height:844});await page.locator('.leaderboard-panel').screenshot({path:path.join(output,'leaderboard-mobile.png')});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.reload();await page.locator('[data-view="history"]').click();assert.equal(await page.locator('#history-count').innerText(),'8');
  assert.deepEqual(errors,[]);console.log('PASS: required ID, condition selector, both ranking modes, quota, JSON export/import, deduplication, atomic rejection, safe participant rendering, CSV, persistence, mobile layout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
