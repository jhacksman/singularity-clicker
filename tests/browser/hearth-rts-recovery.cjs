// Clock control follows https://playwright.dev/docs/api/class-clock#clock-pause-at
// Isolated persistence fault fixtures; the earned-camp artifact comes from real browser play.
const assert=require('node:assert/strict'),fs=require('node:fs'),{spawn}=require('node:child_process'),{once}=require('node:events');
const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright'),{KEY,valid}=require('../../src/hearth-rts/engine.js');
const earned=JSON.parse(fs.readFileSync('artifacts/hearth-rts-earned-camp.json','utf8'));
assert.equal(earned.version,5,'Use the current browser-earned v5 camp');assert.equal(earned.reclaim.profile,'accepted-opening.outpost-reclaim.v1');
// Controlled compatibility projections: v3 changes the version and omits v5 reclaim authority;
// v2 additionally omits the local-storage fields absent from its pooled schema.
const fixtures=[2,3].map(version=>{const legacy=structuredClone(earned);legacy.version=version;delete legacy.reclaim;if(version===2)delete legacy.storage;return{version,legacy,raw:JSON.stringify(legacy,null,2)+'\n',families:version===2?[5,3,4]:[5,4]};});
const current=JSON.stringify(earned),url='http://127.0.0.1:8080/hearth-rts.html';
(async()=>{const server=spawn(process.execPath,['scripts/serve.cjs'],{stdio:['ignore','pipe','inherit']});let browser;
try{await once(server.stdout,'data');browser=await playwright.chromium.launch({headless:true,chromiumSandbox:true});
const open=async(seed,fault)=>{const context=await browser.newContext({viewport:{width:1280,height:720}});await context.addInitScript(({key,seed,fault})=>{const set=Storage.prototype.setItem;if(!localStorage.getItem(key))set.call(localStorage,key,seed);if(fault)Storage.prototype.setItem=function(k,v){if(k===fault)throw new DOMException('Fixture quota failure','QuotaExceededError');return set.call(this,k,v);};},{key:KEY,seed,fault});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.goto(url);await page.locator('[data-unit="u0"]').waitFor();await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));return{context,page,errors};};
const downloadRaw=async(page,name)=>{const event=page.waitForEvent('download');await page.locator('#export').click();const download=await event,path='artifacts/'+name+'.json';await download.saveAs(path);return fs.readFileSync(path,'utf8');};
const exported=async(page,name)=>{if(!await page.locator('#dialog').evaluate(d=>d.open))await page.locator('#journey').click();return downloadRaw(page,name);};
const assertMigrated=(migrated,legacy)=>{
 assert.equal(migrated.version,5);const {reclaim,...world}=migrated;
 for(const field of ['stock','spent','delivered','deposits','buildings','units','seen','time','nextId','depleted','complete','tools','knapping'])assert.deepEqual(migrated[field],legacy[field],'Migration preserves '+field);
 if(legacy.version===3){
  assert.notDeepEqual(legacy.storage.stores.b0,legacy.stock,'The v3 fixture must contain earned local stock outside the hearth');
  assert.deepEqual(legacy.storage.payments,[{kind:'recruitment',target:null,sources:[{storeId:'b0',resource:'food',amount:25}],refunded:false}]);
  const storage={...legacy.storage,payments:[]};
  assert.deepEqual(migrated.storage,storage,'v3 local custody remains unchanged while one closed recruitment row compacts');
  assert.deepEqual(world,{...legacy,version:5,storage},'v3 gameplay changes only its schema and closed payment detail');
 }else{
  const stores=Object.fromEntries(legacy.buildings.filter(b=>b.done&&['hearth','outpost'].includes(b.kind)).map(b=>[b.id,b.kind==='hearth'?{...legacy.stock}:{wood:0,stone:0,food:0}]));
  assert.deepEqual(world,{...legacy,version:5,storage:{version:1,stores,transfers:[],nextId:1,transferred:{wood:0,stone:0,food:0},reservations:{},payments:[]}},'v2 pooled stock is adopted at the hearth exactly once');
 }
 const outposts=legacy.buildings.filter(b=>b.kind==='outpost');assert.equal(outposts.length,1);assert.equal(typeof reclaim.sourceIdentity,'string');
 assert.deepEqual(reclaim,{profile:'accepted-opening.outpost-reclaim.v1',sourceIdentity:reclaim.sourceIdentity,
  claims:[{id:outposts[0].id,buildingId:outposts[0].id,unreleased:{wood:60,stone:20,food:0},receipted:{wood:0,stone:0,food:0},assigned:[],basis:{rule:'legacy-state-consistency',origin:'payment-origin-unrecorded',sourceIdentity:reclaim.sourceIdentity,recipe:'accepted-opening.outpost-reclaim.v1'},origin:[]}],
  recovered:{wood:0,stone:0,food:0},settled:{wood:0,stone:0,food:0},settledSites:0,closedPayments:legacy.version===3?1:0});
};
const assertRawBackups=async(page,fixture,prefix,count)=>{
 for(const family of [3,4,5])assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY+prefix+family),fixture.families.slice(0,count).includes(family)?fixture.raw:null,'Exact raw retention for '+prefix+family);
};
const importRaw=async(page,text,name,success=true)=>{
 if(await page.locator('#dialog').evaluate(d=>d.open))await page.locator('#close').click();
 await page.locator('#journey').click();assert.match(await page.locator('#save-status').innerText(),/This RTS camp has a separate save slot/,'Await this import from a fresh Journey status');
 page.once('dialog',d=>d.accept());await page.locator('#file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(text)});
 if(success)await page.locator('#dialog').waitFor({state:'hidden'});else await page.locator('#save-status').filter({hasText:'Import could not be saved'}).waitFor();
};
for(const fixture of fixtures){
 const {version,legacy,raw,families}=fixture,suffixes=families.map(v=>'.before-v'+v);
 for(const faultSuffix of [...suffixes,'',null]){
  const label='hearth-rts-recovery-v'+version+'-'+(faultSuffix===null?'saved':faultSuffix?faultSuffix.slice(1)+'-failure':'save-failure');
  const {context,page,errors}=await open(raw,faultSuffix===null?null:KEY+faultSuffix),disk=await page.evaluate(k=>localStorage.getItem(k),KEY);
  await assertRawBackups(page,fixture,'.before-v',faultSuffix?suffixes.indexOf(faultSuffix):families.length);
  if(faultSuffix!==null)assert.equal(disk,raw,'Failed migration write must retain exact legacy bytes');else assertMigrated(JSON.parse(disk),legacy);
  assert.equal(await page.locator('#pause').innerText(),'Resume');assert.equal(await page.locator('#stop').isDisabled(),faultSuffix!==null);
  await page.clock.runFor(2500);assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),disk);
  const memory=await exported(page,label);
  if(faultSuffix!==null)assert.equal(memory,raw,'Any failed required backup or main write exports exact original bytes');
  else{
   assertMigrated(JSON.parse(memory),legacy);
   assert.equal(memory,disk,'Successful startup adopts the same v5 camp in memory and on disk');
  }
  assert.deepEqual(errors,[]);await context.close();
 }
}
for(const fixture of fixtures){
 const {version,legacy,raw,families}=fixture,suffixes=families.map(v=>'.import-before-v'+v);
 for(const faultSuffix of [...suffixes,'',null]){
  const label='hearth-rts-import-v'+version+'-'+(faultSuffix===null?'saved':faultSuffix?faultSuffix.slice(1)+'-failure':'write-failure');
  const {context,page,errors}=await open(current,null);await page.locator('#stores').click();
  const before=await exported(page,label+'-before');assert.deepEqual(JSON.parse(before),earned);await page.locator('#close').click();
  if(faultSuffix!==null){
   await page.locator('#pause').click();assert.equal(await page.locator('#pause').innerText(),'Pause');
   await page.evaluate(fault=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===fault)throw new DOMException('Fixture write failure','QuotaExceededError');return set.call(this,k,v);};},KEY+faultSuffix);
  }
  await importRaw(page,raw,'projected-v'+version+'.json',faultSuffix===null);
  await assertRawBackups(page,fixture,'.import-before-v',faultSuffix?suffixes.indexOf(faultSuffix):families.length);
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY+'.outgoing-before-import-v5'),faultSuffix?null:before,'Outgoing live preservation completes after incoming backups and before the main write');
  assert.equal(await page.locator('#pause').innerText(),'Resume');
  if(faultSuffix!==null){
   assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),current);assert.equal(await page.locator('#dialog').evaluate(d=>d.open),true);
   assert.match(await page.locator('#toast').innerText(),/Import failed/);assert.doesNotMatch(await page.locator('#toast').innerText(),/restored/);
   assert.equal(await downloadRaw(page,label+'-after'),before,'Failed import must keep the complete previous live camp byte-for-byte');
   await page.locator('#close').click();await page.clock.runFor(2500);
   assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),current,'Closing the failed import must not overwrite the previous save');assert.equal(await page.locator('#pause').innerText(),'Resume');
   assert.equal(await exported(page,label+'-after-wait'),before,'Closing the failed import must leave its previous live camp paused');await page.locator('#close').click();
  }else{
   const migrated=await page.evaluate(k=>localStorage.getItem(k),KEY);assertMigrated(JSON.parse(migrated),legacy);
   assert.equal(await page.locator('#store-title').count(),0,'Successful import must clear old store inspector controls');
   await page.clock.runFor(2500);assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),migrated);
   assert.equal(await exported(page,label+'-after'),migrated,'Successful import adopts the same paused v5 camp in memory and on disk');await page.locator('#close').click();
  }
  assert.deepEqual(errors,[]);await page.screenshot({path:'artifacts/'+label+'.png',fullPage:true});await context.close();
 }
}
// Identical raw bytes reuse each applicable family; distinct A/B/C bytes stay immutable.
for(const fixture of fixtures){
 const {version,legacy,raw,families}=fixture,{context,page,errors}=await open(current,null),label='hearth-rts-retained-v'+version;
 await importRaw(page,raw,'retained-a.json');await importRaw(page,raw,'retained-a-again.json');await assertRawBackups(page,fixture,'.import-before-v',families.length);
 for(const family of families)assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY+'.import-before-v'+family+'.1'),null,'Identical raw imports reuse their backup');
 const secondState={...legacy,time:legacy.time+1},second=JSON.stringify(secondState,null,1)+'\n';await importRaw(page,second,'retained-b.json');
 const prior=await page.evaluate(k=>localStorage.getItem(k),KEY);assertMigrated(JSON.parse(prior),secondState);
 const priorMemory=await exported(page,label+'-before-c');assert.equal(priorMemory,prior);await page.locator('#close').click();
 for(const family of families){assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY+'.import-before-v'+family),raw);assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY+'.import-before-v'+family+'.1'),second);}
 await page.evaluate(key=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Fixture main-write failure','QuotaExceededError');return set.call(this,k,v);};},KEY);
 const third=JSON.stringify({...legacy,time:legacy.time+2});await importRaw(page,third,'retained-c.json',false);
 assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),prior);await assertRawBackups(page,fixture,'.import-before-v',families.length);
 for(const family of families){
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY+'.import-before-v'+family+'.1'),second);
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY+'.import-before-v'+family+'.2'),third);
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY+'.import-before-v'+family+'.3'),null);
 }
 assert.equal(await downloadRaw(page,label+'-failed-c'),priorMemory,'Failed C replacement keeps B in live memory as well as on disk');
 assert.equal(await page.locator('#pause').innerText(),'Resume');assert.match(await page.locator('#toast').innerText(),/Import failed/);assert.doesNotMatch(await page.locator('#toast').innerText(),/restored/);
 await page.locator('#close').click();await page.clock.runFor(2500);assert.equal(await page.evaluate(k=>localStorage.getItem(k),KEY),prior);assert.equal(await page.locator('#pause').innerText(),'Resume');
 assert.equal(await exported(page,label+'-failed-c-after-wait'),priorMemory);assert.deepEqual(errors,[]);await context.close();
}
// Isolated collision fixture: a prior site's Cancel closure must never survive import.
// Keep the original 1280x720 viewport and ordinary visible click. The negative
// control drops only preventScroll, reproducing the previous focus() call.
{
 const before=structuredClone(earned),site=before.buildings.find(b=>b.kind==='workshop');
 // This preexisting inspector/focus collision fixture deliberately changes paid
 // projects without rebalancing their bills. Keep it playable and uncertified v4.
 before.version=4;delete before.reclaim;
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
   assert.equal(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.id,point),'world','The ordinary paired click must reach the visible map, not the persistent command tray');
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
console.log('PASS projected v2/v3 persistence fixtures: each applicable v5/v3/v4 backup and main-write fault preserves raw bytes; every failed startup adoption exports the original; failed imports retain prior disk and downloaded memory; successful adoption preserves gameplay in certified v5; identical imports reuse backups and distinct A/B/C bytes survive failed replacement');
}finally{if(browser)await browser.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
