/* Optional development QA. Requires Playwright; not needed to run the website. */
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
(async()=>{
 const output=path.resolve(__dirname,'../.sites-runtime/qa');fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1080}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 // ModelContext harness checks the optional WebMCP contract if the browser lacks it.
 await page.addInitScript(()=>{if(!document.modelContext){Object.defineProperty(document,'modelContext',{value:{registerTool(tool){window.qaRegisteredTool=tool;}}});}});
 await page.clock.install();
 await page.goto(pathToFileURL(path.resolve(__dirname,'../dist/index.html')).href);
 await page.locator('#start-button:not([disabled])').waitFor();
 await page.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
 await page.locator('#duration').selectOption('1000');await page.locator('#trials').selectOption('20');
 await page.locator('#participant').fill('QA001');
 await page.locator('#start-button').click();
 await page.keyboard.press('j');assert.equal(await page.locator('#trial-label').innerText(),'01 / 20');
 await page.clock.runFor(600);await page.screenshot({path:path.join(output,'stimulus.png')});
 await page.locator('#exit-button').click();await page.locator('#cancel-exit').click();
 for(let i=0;i<20;i++){
   await page.clock.runFor(2200);
   assert.equal(await page.locator('#answer-yes').isEnabled(),true,'response buttons must unlock');
   await page.keyboard.press(i%2?'j':'f');
   await page.keyboard.press(i%2?'j':'f'); // rapid duplicate must be ignored
 }
 await page.clock.runFor(500);
 assert.equal(await page.locator('#view-results').isVisible(),true);
 assert.equal(await page.locator('#trial-review tbody tr').count(),20);
 const numbers=await page.locator('#confusion-matrix strong').allTextContents();assert.equal(numbers.map(Number).reduce((a,b)=>a+b),20);
 const metrics=await page.locator('#metric-grid').innerText();assert.ok(!/NaN|Infinity/.test(metrics));
 assert.equal(await page.locator('#trial-review tbody tr').first().locator('td').last().textContent(),'1');
 await page.screenshot({path:path.join(output,'results.png'),fullPage:true});
 const downloadPromise=page.waitForEvent('download');await page.locator('#export-button').click();const download=await downloadPromise;await download.saveAs(path.join(output,'round.csv'));const csv=fs.readFileSync(path.join(output,'round.csv'),'utf8');assert.equal(csv.trim().split(/\r?\n/).length,21);
 const api=await page.evaluate(async()=>{const t=window.qaRegisteredTool;if(!t)return {unavailable:true};const valid=await t.execute({});let rejected=false;try{await t.execute({unexpected:true});}catch(e){rejected=true;}return {name:t.name,valid,rejected};});
 if(!api.unavailable){assert.equal(api.name,'read_citrus_lab_status');assert.equal(api.valid.phase,'idle');assert.equal(api.valid.lastCompletedResult.n,20);assert.ok(api.rejected);}
 await page.locator('#explore-button').click();await page.locator('#model-c').fill('1');await page.locator('#model-d').fill('2.6');assert.equal(await page.locator('#model-c-value').innerText(),'1.00');await page.screenshot({path:path.join(output,'concept.png'),fullPage:true});
 await page.locator('[data-view="history"]').click();assert.equal(await page.locator('#history-content tbody tr').count(),1);
 await page.reload();await page.locator('#start-button:not([disabled])').waitFor();await page.locator('[data-view="history"]').click();assert.equal(await page.locator('#history-content tbody tr').count(),1);
 await page.locator('#clear-history').click();await page.locator('#cancel-clear').click();assert.equal(await page.locator('#history-content tbody tr').count(),1);
 await page.locator('[data-view="lab"]').click();await page.locator('#duration').selectOption('1000');await page.locator('#practice-button').click();
 for(let i=0;i<6;i++){await page.clock.runFor(4500);await page.locator('#answer-no').click();}
 await page.clock.runFor(2000);assert.ok((await page.locator('#practice-feedback').innerText()).includes('练习结束'));assert.equal(await page.locator('#history-count').innerText(),'1');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'mobile horizontal overflow');
 await page.locator('[data-view="history"]').click();await page.locator('#clear-history').click();await page.locator('#confirm-clear').click();assert.ok((await page.locator('#history-content').innerText()).includes('还没有'));
 // File URL directly, including the submission's root entry point and local assets.
 const filePage=await context.newPage();filePage.on('pageerror',e=>errors.push(e.message));await filePage.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);await filePage.locator('#start-button:not([disabled])').waitFor();assert.ok(filePage.url().includes('/dist/index.html'));await filePage.locator('#practice-button').click();await filePage.locator('#answer-no:not([disabled])').waitFor();await filePage.locator('#answer-no').click();await filePage.locator('#exit-button').click();await filePage.locator('#confirm-exit').click();
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks:['20-trial full round','premature and duplicate key rejection','pause and replay','four-outcome total','finite SDT results','CSV export','charts','history persistence','practice exclusion','clear confirmation','390px layout','file:// run'],webmcp:api.unavailable?'native browser context unavailable':'contract harness passed',screenshots:output},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
