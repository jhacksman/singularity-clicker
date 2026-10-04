// Clock control follows https://playwright.dev/docs/api/class-clock#clock-pause-at
// Isolated persistence fault fixtures; the earned-camp artifact comes from real browser play.
const assert=require('node:assert/strict'),fs=require('node:fs'),{spawn}=require('node:child_process'),{once}=require('node:events');
const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright'),{KEY,valid}=require('../../src/hearth-rts/engine.js');
const earned=JSON.parse(fs.readFileSync('artifacts/hearth-rts-earned-camp.json','utf8'));
const legacy={...structuredClone(earned),version:2};delete legacy.storage;
const raw=JSON.stringify(legacy,null,2)+'\n',current=JSON.stringify(earned),url='http://127.0.0.1:8080/hearth-rts.html';
(async()=>{const server=spawn(process.execPath,['scripts/serve.cjs'],{stdio:['ignore','pipe','inherit']});let browser;
try{await once(server.stdout,'data');browser=await playwright.chromium.launch({headless:true,chromiumSandbox:true});
const open=async(seed,fault)=>{const context=await browser.newContext({viewport:{width:1280,height:720}});await context.addInitScript(({key,seed,fault})=>{const set=Storage.prototype.setItem;if(!localStorage.getItem(key))set.call(localStorage,key,seed);if(fault)Storage.prototype.setItem=function(k,v){if(k===fault)throw new DOMException('Fixture quota failure','QuotaExceededError');return set.call(this,k,v);};},{key:KEY,seed,fault});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.goto(url);await page.locator('[data-unit="u0"]').waitFor();await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));return{context,page,errors};};
const exported=async(page,name)=>{await page.locator('#journey').click();const event=page.waitForEvent('download');await page.locator('#export').click();const download=await event,path='artifacts/'+name+'.json';await download.saveAs(path);return fs.readFileSync(path,'utf8');};
for(const suffix of ['.before-v3','']){const {context,page,errors}=await open(raw,KEY+suffix);assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),raw,'Failed migration write must retain legacy save');assert.equal(await page.locator('#pause').innerText(),'Resume');assert.equal(await page.locator('#stop').isDisabled(),true);await page.clock.runFor(2500);assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),raw);const backup=await exported(page,'hearth-rts-recovery-'+(suffix?'backup-failure':'save-failure'));if(suffix)assert.equal(backup,raw,'Rejected migration exports exact original bytes');else{assert.deepEqual(JSON.parse(backup).stock,legacy.stock);assert.match(await page.locator('#toast').innerText(),/Saving stopped/);assert.doesNotMatch(await page.locator('#toast').innerText(),/original|could not be loaded/);}assert.deepEqual(errors,[]);await context.close();}
for(const faultSuffix of ['.import-before-v3','',null]){const {context,page,errors}=await open(current,null);await page.locator('#stores').click();if(faultSuffix!==null)await page.locator('#pause').click();if(faultSuffix!==null)await page.evaluate(fault=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===fault)throw new DOMException('Fixture write failure','QuotaExceededError');return set.call(this,k,v);};},KEY+faultSuffix);await page.locator('#journey').click();page.once('dialog',d=>d.accept());await page.locator('#file').setInputFiles({name:'legacy-v2.json',mimeType:'application/json',buffer:Buffer.from(raw)});
if(faultSuffix!==null){await page.locator('#save-status').filter({hasText:'Import could not be saved'}).waitFor();assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),current);assert.equal(await page.locator('#dialog').evaluate(d=>d.open),true);assert.equal(await page.locator('#pause').innerText(),'Resume');assert.match(await page.locator('#toast').innerText(),/Import failed/);assert.doesNotMatch(await page.locator('#toast').innerText(),/restored/);const event=page.waitForEvent('download');await page.locator('#export').click();const download=await event,path='artifacts/hearth-rts-failed-import-'+(faultSuffix?'backup':'main')+'.json';await download.saveAs(path);assert.deepEqual(JSON.parse(fs.readFileSync(path,'utf8')),earned,'Failed import must keep the prior camp in memory as well');await page.locator('#close').click();await page.clock.runFor(2500);assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),current,'Closing the failed import must not resume or overwrite the previous camp');assert.equal(await page.locator('#pause').innerText(),'Resume');}
else{await page.locator('#dialog').waitFor({state:'hidden'});assert.equal(await page.evaluate(k=>localStorage.getItem(k+'.import-before-v3'),KEY),raw);const migrated=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);assert.equal(migrated.version,3);assert.equal(await page.locator('#store-title').count(),0,'Successful import must clear old store inspector controls');assert.deepEqual(migrated.stock,legacy.stock);assert.deepEqual(migrated.units,legacy.units);assert.equal(await page.locator('#pause').innerText(),'Resume');await page.clock.runFor(2500);assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY),migrated);}
assert.deepEqual(errors,[]);await page.screenshot({path:'artifacts/hearth-rts-import-'+(faultSuffix===null?'saved':faultSuffix?'backup-failed':'write-failed')+'.png',fullPage:true});await context.close();}
// Existing raw snapshots remain immutable across distinct imports and failed replacement.
{const {context,page,errors}=await open(current,null);const importRaw=async(text,success=true)=>{await page.locator('#journey').click();page.once('dialog',d=>d.accept());await page.locator('#file').setInputFiles({name:'retained.json',mimeType:'application/json',buffer:Buffer.from(text)});if(success)await page.locator('#dialog').waitFor({state:'hidden'});else await page.locator('#save-status').filter({hasText:'Import could not be saved'}).waitFor();};
await importRaw(raw);await importRaw(raw);assert.equal(await page.evaluate(k=>localStorage.getItem(k+'.import-before-v3.1'),KEY),null,'Identical raw imports reuse their backup');const second=JSON.stringify({...legacy,time:legacy.time+1},null,1)+'\n';await importRaw(second);assert.equal(await page.evaluate(k=>localStorage.getItem(k+'.import-before-v3'),KEY),raw);assert.equal(await page.evaluate(k=>localStorage.getItem(k+'.import-before-v3.1'),KEY),second);const prior=await page.evaluate(k=>localStorage.getItem(k),KEY);await page.evaluate(key=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Fixture main-write failure','QuotaExceededError');return set.call(this,k,v);};},KEY);const third=JSON.stringify({...legacy,time:legacy.time+2});await importRaw(third,false);assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),prior);assert.equal(await page.evaluate(k=>localStorage.getItem(k+'.import-before-v3'),KEY),raw);assert.equal(await page.evaluate(k=>localStorage.getItem(k+'.import-before-v3.1'),KEY),second);assert.equal(await page.evaluate(k=>localStorage.getItem(k+'.import-before-v3.2'),KEY),third);assert.deepEqual(errors,[]);await context.close();}
// Isolated collision fixture: a prior site's Cancel closure must never survive import.
// Keep the original 1280x720 viewport and ordinary visible click. The negative
// control drops only preventScroll, reproducing the previous focus() call.
{
 const before=structuredClone(earned),site=before.buildings.find(b=>b.kind==='workshop');
 site.done=false;site.work=1;before.tools=false;before.knapping=null;
 before.storage.reservations[site.id]={sources:[{storeId:'b0',resource:'wood',amount:40},{storeId:'b0',resource:'stone',amount:30}]};
 const incoming=structuredClone(before),other=incoming.buildings.find(b=>b.id===site.id);
 other.kind='outpost';other.cost={wood:60,stone:20};
 incoming.storage.reservations[other.id]={sources:[{storeId:'b0',resource:'wood',amount:60},{storeId:'b0',resource:'stone',amount:20}]};
 assert.ok(valid(before),'The pre-import site fixture must be admitted');
 assert.ok(valid(incoming),'The different colliding-ID project must be admitted');
 for(const oldFocus of [true,false]){
  const {context,page,errors}=await open(JSON.stringify(before),null),label=oldFocus?'old-focus':'fixed-focus';
  try{
   const loaded=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);
   assert.deepEqual(loaded.buildings.find(b=>b.id===site.id),site);
   assert.equal(await page.locator('#stop').isDisabled(),false,'Fixture must load as a usable paused camp');
   const bounds=await page.locator('#world').boundingBox(),point={x:bounds.x+(site.x+.5)/36*bounds.width,y:bounds.y+(site.y+.5)/24*bounds.height};
   assert.ok(point.x>0&&point.x<1280&&point.y>0&&point.y<720,'Intended site click is inside the viewport');
   assert.ok(bounds.y+bounds.height>720,'This regression requires a partially visible canvas');
   await page.evaluate(({oldFocus,point})=>{
    const canvas=document.getElementById('world'),nativeFocus=canvas.focus.bind(canvas);
    const snapshot=()=>{const r=canvas.getBoundingClientRect();return{scrollX,scrollY,rect:{x:r.x,y:r.y,width:r.width,height:r.height},activeElement:document.activeElement?.id||document.activeElement?.tagName,hitElement:document.elementFromPoint(point.x,point.y)?.id,mapped:{x:(point.x-r.x)/r.width*36,y:(point.y-r.y)/r.height*24},inspect:document.getElementById('inspect').innerText};};
    window.__focusProbe={oldFocus,point,events:[],calls:[],initial:snapshot()};
    for(const type of ['pointerdown','pointerup'])canvas.addEventListener(type,e=>window.__focusProbe.events.push({type,clientX:e.clientX,clientY:e.clientY,...snapshot()}),true);
    canvas.focus=options=>{const before=snapshot();const result=oldFocus?nativeFocus():nativeFocus(options);window.__focusProbe.calls.push({requestedOptions:options||null,effectivePreventScroll:!oldFocus&&!!options?.preventScroll,before,after:snapshot()});return result;};
   },{oldFocus,point});
   await page.mouse.click(point.x,point.y);
   const probe=await page.evaluate(()=>({...window.__focusProbe,finalScrollY:scrollY,inspector:document.getElementById('inspect').innerText,buttonCount:document.querySelectorAll('#inspect button').length}));
   fs.writeFileSync('artifacts/hearth-rts-collision-'+label+'.json',JSON.stringify({probe,loaded,errors},null,2));
   await page.screenshot({path:'artifacts/hearth-rts-collision-'+label+'.png',fullPage:true});
   assert.equal(probe.calls.length,1,'Observe the app focus call during the actual pointer gesture');
   assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY),loaded,'Inspection must not mutate the paused camp');
   if(oldFocus){
    assert.ok(probe.calls[0].after.scrollY>probe.calls[0].before.scrollY,'Old focus must reproduce actual scrolling, otherwise the proposed cause is disproved');
    assert.ok(probe.calls[0].after.mapped.y>=site.y+2,'The same client point must miss the intended site after scrolling');
    assert.equal(probe.buttonCount,0,'Old focus reproduces the absent site inspector');
   }else{
    assert.equal(probe.calls[0].after.scrollY,probe.calls[0].before.scrollY);
    assert.equal(probe.finalScrollY,probe.initial.scrollY,'Native pointer handling must not shift the map after focus returns');
    assert.deepEqual(probe.calls[0].after.rect,probe.calls[0].before.rect);
    assert.equal(probe.calls[0].after.activeElement,'world','Keyboard focus remains on the canvas');
    assert.match(await page.locator('#inspect button').innerText(),/Cancel site/);
    await page.locator('#journey').click();page.once('dialog',d=>d.accept());
    await page.locator('#file').setInputFiles({name:'different-project-same-id.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(incoming))});
    await page.locator('#dialog').waitFor({state:'hidden'});
    assert.equal(await page.locator('#inspect button').count(),0);
    const after=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);
    assert.deepEqual(after.buildings.find(b=>b.id===site.id),other);
    assert.deepEqual(after.storage.reservations,incoming.storage.reservations);
    fs.writeFileSync('artifacts/hearth-rts-collision-imported.json',JSON.stringify(after,null,2));
    await page.screenshot({path:'artifacts/hearth-rts-collision-imported.png',fullPage:true});
   }
   assert.deepEqual(errors,[]);
  }catch(error){
   await page.screenshot({path:'artifacts/hearth-rts-collision-'+label+'-failure.png',fullPage:true}).catch(()=>{});
   fs.writeFileSync('artifacts/hearth-rts-collision-'+label+'-failure.json',JSON.stringify(await page.evaluate(k=>({probe:window.__focusProbe||null,body:document.body.innerText,raw:localStorage.getItem(k)}),KEY).catch(()=>({})),null,2));
   throw error;
  }finally{await context.close();}
 }
 console.log('PASS same-viewport focus regression: old focus scrolls and misses the site; fixed focus preserves coordinates; colliding-ID import clears stale Cancel and retains incoming paid project');
}
console.log('PASS persistence fault fixtures: boot backup/main write failures retain raw legacy save; import backup/main failures retain prior disk+memory and truthful recovery; successful import preserves exact raw bytes and stays paused');
}finally{if(browser)await browser.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
