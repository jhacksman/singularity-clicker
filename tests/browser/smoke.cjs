// Run only on the Spark CI browser runtime. No browser package is installed by this script.
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {Camp}=require('../../src/engine.js');
const {Hearth}=require('../../src/hearth/engine.js');
const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const CAVE='singularity-clicker.cave.v1',HEARTH='singularity-clicker.hearth.v1';
(async()=>{
 const server=spawn(process.execPath,['scripts/serve.cjs'],{stdio:['ignore','pipe','inherit']});
 let browser;
 try{
  await Promise.race([once(server.stdout,'data'),once(server,'exit').then(()=>{throw Error('Server exited before listening');})]);
  browser=await playwright[process.env.BROWSER||'chromium'].launch({headless:true});
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8080');
  await page.locator('#focus-action').click();
  const acted=JSON.parse(await page.evaluate(k=>localStorage.getItem(k),CAVE));
  assert.equal(acted.run.counts.forage,1);
  await page.reload();
  assert.equal(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),CAVE)).run.counts.forage,1);
  const completed=new Camp(null,17);completed.r.innovation=1198;completed.act('grunt');for(let i=0;i<3;i++)completed.fireStep();
  await page.evaluate(([key,value])=>localStorage.setItem(key,value),[CAVE,completed.serialize()]);
  await page.reload();await page.locator('#event-action').click();
  await page.locator('#modal a[href="hearth.html"]').click();
  await page.locator('#people [data-person="0"]').waitFor();
  await page.locator('#pause').click();await page.locator('[data-job="wood"]').click();
  for(let i=0;i<25;i++){await page.locator('#step').click();await page.locator('[data-job="wood"]').click();}
  const before=JSON.parse(await page.evaluate(k=>localStorage.getItem(k),HEARTH));
  assert.equal(before.time,25);assert.equal(before.people[0].job,'wood');
  await page.reload();await page.locator('#pause').click();
  const after=JSON.parse(await page.evaluate(k=>localStorage.getItem(k),HEARTH));
  assert.deepEqual(after,before);
  await page.locator('#map-toggle').click();await page.locator('#map-toggle').click();
  await page.locator('#settings').click();await page.locator('#modal a[href="index.html"]').click();
  assert.equal(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),CAVE)).run.complete,true);
  await context.close();

  // An asynchronous host that cannot write must still export the live journey.
  const recovery=await browser.newContext(),rp=await recovery.newPage();rp.on('pageerror',e=>errors.push(e.message));
  const initial=new Hearth().serialize();
  await rp.addInitScript(({initial,key})=>{
   window.SingularityPlatform={load:async k=>k===key?initial:null,save:async()=>{throw Error('disk full');},download:async(name,text)=>{window.exported=text;}};
  },{initial,key:HEARTH});
  await rp.goto('http://127.0.0.1:8080/hearth.html');
  await rp.locator('#people [data-person="0"]').waitFor();await rp.locator('#pause').click();
  await rp.locator('[data-job="wood"]').click();await rp.locator('#settings').click();await rp.locator('#export').click();
  await rp.waitForFunction(()=>!!window.exported);
  assert.equal(JSON.parse(await rp.evaluate(()=>window.exported)).people[0].job,'wood');
  await recovery.close();

  // Unknown-version saves are preserved for export, never silently reset.
  const corrupt=await browser.newContext(),cp=await corrupt.newPage();cp.on('pageerror',e=>errors.push(e.message));
  const unknown=JSON.stringify({...JSON.parse(initial),version:2});
  await cp.addInitScript(({unknown,key})=>{
   window.SingularityPlatform={load:async()=>unknown,save:async()=>{throw Error('must not overwrite');},download:async(name,text)=>{window.exported=text;}};
  },{unknown,key:HEARTH});
  await cp.goto('http://127.0.0.1:8080/hearth.html');await cp.locator('#people [data-person="0"]').waitFor();
  await cp.locator('#settings').click();await cp.locator('#export').click();await cp.waitForFunction(()=>!!window.exported);
  assert.equal(await cp.evaluate(()=>window.exported),unknown);
  await corrupt.close();assert.deepEqual(errors,[]);
  console.log('PASS browser smoke: Cave actions/refresh, completion/navigation, Hearth repeated orders/refresh/map, failed-save export, unknown-version preservation; no page errors');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
