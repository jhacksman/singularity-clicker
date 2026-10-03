// Run only on the Spark CI browser runtime. No browser package is installed by this script.
const assert=require('node:assert/strict');
const fs=require('node:fs');
fs.mkdirSync('artifacts',{recursive:true});
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
  browser=await playwright[process.env.BROWSER||'chromium'].launch({headless:true,chromiumSandbox:true});
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8080');
  await page.locator('#focus-action').click();
  const acted=JSON.parse(await page.evaluate(k=>localStorage.getItem(k),CAVE));
  assert.equal(acted.run.counts.forage,1);
  await page.reload();
  assert.equal(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),CAVE)).run.counts.forage,1);
  const completed=new Camp(null,17);completed.r.innovation=1198;completed.act('grunt');for(let i=0;i<3;i++)completed.fireStep();
  await page.addInitScript(([key,value])=>{if(!sessionStorage.getItem('completion-fixture')){localStorage.setItem(key,value);sessionStorage.setItem('completion-fixture','1');}},[CAVE,completed.serialize()]);
  await page.reload();await page.locator('#event-action').click();
  await page.screenshot({path:'artifacts/cave-completion.png',fullPage:true});
  await page.locator('#modal a[href="hearth.html"]').click();
  await page.locator('#people [data-person="0"]').waitFor();
  await page.locator('#pause').click();await page.locator('[data-job="wood"]').click();
  for(let i=0;i<25;i++){await page.locator('#step').click();await page.locator('[data-job="wood"]').click();}
  const before=JSON.parse(await page.evaluate(k=>localStorage.getItem(k),HEARTH));
  assert.equal(before.time,25);assert.equal(before.people[0].job,'wood');
  await page.reload();await page.locator('#pause').click();
  const after=JSON.parse(await page.evaluate(k=>localStorage.getItem(k),HEARTH));
  assert.deepEqual(after,before);
  await page.screenshot({path:'artifacts/hearth-orders.png',fullPage:true});
  const selectOnly=async id=>{await page.evaluate(id=>{for(const b of document.querySelectorAll('[data-person]'))if(b.getAttribute('aria-pressed')==='true'&&Number(b.dataset.person)!==id)b.click();const target=document.querySelector('[data-person="'+id+'"]');if(target.getAttribute('aria-pressed')!=='true')target.click();},id);};
  for(const [id,job] of [[1,'food'],[2,'water']]){await selectOnly(id);await page.locator('[data-job="'+job+'"]').click();}
  await page.locator('#tab-build').click();await page.locator('[data-build="shelter"]').click();
  const bounds=await page.locator('#world').boundingBox();const u=Math.min(bounds.width/56,bounds.height/31),sx=u*1.45,sy=u*.72;
  await page.mouse.click(bounds.x+bounds.width*.5+(9-13)*sx,bounds.y+bounds.height*.19+(9+13)*sy);
  await page.locator('#tab-work').click();await selectOnly(3);await page.locator('[data-job="build"]').click();
  await page.evaluate(()=>{for(let i=0;i<140;i++)document.getElementById('step').click();});
  let progressed=JSON.parse(await page.evaluate(k=>localStorage.getItem(k),HEARTH));
  assert.ok(progressed.tiles[progressed.location].buildings.some(b=>b.kind==='shelter'&&b.done));
  assert.ok(progressed.stats.wood>0&&progressed.stats.food>0);assert.ok(progressed.knowledge>=8);
  await page.locator('#tab-learn').click();await page.locator('[data-learn="knapping"]').click();
  progressed=JSON.parse(await page.evaluate(k=>localStorage.getItem(k),HEARTH));assert.ok(progressed.tech.includes('knapping'));
  await page.screenshot({path:'artifacts/hearth-first-shelter-and-learning.png',fullPage:true});
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
  await corrupt.close();
  const depleted=new Hearth();depleted.assign([0],'stone');for(let i=0;i<1200;i++)depleted.tick(1);
  assert.equal(depleted.s.migration,true);
  const migration=await browser.newContext(),mp=await migration.newPage();mp.on('pageerror',e=>errors.push(e.message));
  await mp.addInitScript(([key,value])=>localStorage.setItem(key,value),[HEARTH,depleted.serialize()]);
  await mp.goto('http://127.0.0.1:8080/hearth.html');
  await mp.locator('[data-safe-destination]').first().waitFor();
  await mp.screenshot({path:'artifacts/hearth-safe-migration.png',fullPage:true});
  const destination=await mp.locator('[data-safe-destination]').first().getAttribute('data-safe-destination');
  await mp.locator('[data-safe-destination]').first().click();await mp.locator('#travel-confirm').click();
  const migrated=JSON.parse(await mp.evaluate(k=>localStorage.getItem(k),HEARTH));
  assert.equal(migrated.location,destination);assert.equal(migrated.people.length,depleted.s.people.length);assert.equal(migrated.migration,false);
  await migration.close();assert.deepEqual(errors,[]);
  console.log('PASS browser smoke: Cave actions/refresh, completion/navigation, Hearth repeated orders/refresh/map, failed-save export, unknown-version preservation, safe depleted-camp migration; no page errors');
 }catch(error){
  if(browser)for(const [i,context] of browser.contexts().entries())for(const [j,page] of context.pages().entries()){
   await page.screenshot({path:`artifacts/failure-${i}-${j}.png`,fullPage:true}).catch(()=>{});
   fs.writeFileSync(`artifacts/failure-${i}-${j}.txt`,await page.locator('body').innerText().catch(()=>''));
  }throw error;
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
