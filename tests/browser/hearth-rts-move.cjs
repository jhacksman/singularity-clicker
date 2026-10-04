// Spark only. Earn the gathered load through ordinary UI, then reuse its exact
// exported checkpoint for equivalent inputs. Transfer seed comes from the main journey.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {KEY,valid}=require('../../src/hearth-rts/engine.js');
const url='http://127.0.0.1:8080/hearth-rts.html',target={x:2,y:3};
const legacyHTML=fs.readFileSync('tests/fixtures/hearth-rts-input023-v3.html','utf8');
assert.equal(crypto.createHash('sha256').update(legacyHTML).digest('hex'),'4fa74911ae0a0650885355e5e20b4cd2b532c83e4b8bed496a50866a09a63b0a');
const resources=['wood','stone','food'];
const totals=s=>Object.fromEntries(resources.map(r=>[r,s.stock[r]+s.spent[r]+s.deposits.filter(d=>d.kind===r).reduce((n,d)=>n+d.amount,0)+s.units.filter(u=>u.resource===r).reduce((n,u)=>n+u.cargo,0)]));
const unit=(s,id)=>s.units.find(u=>u.id===id);
function gatheredRouteWitness(before,accepted,id){
 // This particular earned western fixture has a clear north/west L-shaped route.
 // Its Manhattan lower bound independently excludes a hidden trip to the hearth.
 // This is not a general claim that obstacle routes must approach a goal each tick.
 const u=unit(before,id),start={x:Math.round(u.x),y:Math.round(u.y)};
 assert.ok(Math.abs(u.x-start.x)<1e-8&&Math.abs(u.y-start.y)<1e-8);assert.ok(start.x>target.x&&start.y>target.y&&start.x<18);
 const legs=horizontalFirst=>{const p={...start},path=[];for(const axis of horizontalFirst?['x','y']:['y','x'])while(p[axis]!==target[axis]){p[axis]--;path.push({...p});}return path;};
 const clear=p=>p.x<18&&!before.deposits.some(d=>d.amount>0&&d.x===p.x&&d.y===p.y)&&!before.buildings.some(b=>{const size=b.kind==='hearth'?3:2;return p.x>=b.x&&p.x<b.x+size&&p.y>=b.y&&p.y<b.y+size;});
 const witness=[legs(true),legs(false)].find(path=>path.every(clear));assert.ok(witness,'The earned fixture must actually have the independently checked shortest route');
 const route=unit(accepted,id).path;assert.equal(route.length,witness.length,'A loaded Move cannot add a home waypoint to this open-region route');
 assert.ok(route.every(p=>p.x>=target.x&&p.x<=start.x&&p.y>=target.y&&p.y<=start.y));return witness;
}
function nextMovement(accepted,first,id){
 const u=unit(accepted,id),moved=unit(first,id),node=u.path[0];assert.ok(node);
 const dx=node.x-u.x,dy=node.y-u.y,d=Math.hypot(dx,dy),budget=Math.min(d,.3);assert.ok(d>0);
 assert.ok(Math.abs(moved.x-(u.x+dx/d*budget))<1e-8);assert.ok(Math.abs(moved.y-(u.y+dy/d*budget))<1e-8);
 for(const field of ['cargo','resource','work'])assert.equal(moved[field],u[field]);
}
function atStoreEdge(u,b){
 const size=b.kind==='hearth'?3:2,near=(a,c)=>Math.abs(a-c)<.001;
 for(let i=0;i<size;i++)if(near(u.x,b.x-1)&&near(u.y,b.y+i)||near(u.x,b.x+size)&&near(u.y,b.y+i)||near(u.y,b.y-1)&&near(u.x,b.x+i)||near(u.y,b.y+size)&&near(u.x,b.x+i))return true;
 return false;
}
function custody(s){
 assert.ok(valid(s),'Every observed current checkpoint must remain strictly loadable');
 for(const job of s.storage.transfers){
  const carried=s.units.filter(u=>u.transfer===job.id).reduce((n,u)=>n+u.cargo,0);
  assert.equal(job.amount,job.remaining+job.delivered+job.recovered+job.cancelled+carried);
  assert.equal(job.remaining,Object.values(job.pending).reduce((n,v)=>n+v,0));
 }
}
fs.mkdirSync('artifacts',{recursive:true});
(async()=>{
 const server=spawn(process.execPath,['scripts/serve.cjs'],{stdio:['ignore','pipe','inherit']});let browser;
 const report={source:'current Spark build',scope:'IC02 Move portion only',groups:[]};
 try{
  await once(server.stdout,'data');browser=await playwright.chromium.launch({headless:true,chromiumSandbox:true});
  async function open(label,raw=null,{touch=false,legacy=false}={}){
   const context=await browser.newContext({viewport:touch?{width:390,height:844}:{width:1440,height:1100},hasTouch:touch,isMobile:touch,recordVideo:{dir:'artifacts/rts-move-video',size:touch?{width:390,height:844}:{width:1440,height:1100}}});
   if(raw!==null)await context.addInitScript(({key,raw})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,raw);},{key:KEY,raw});
   // Read-only input telemetry is reinstalled on reload; no game state is exposed or changed.
   await context.addInitScript(()=>{window.__moveInput=[];for(const name of ['pointerdown','pointerup','contextmenu','keydown','keyup','click'])document.addEventListener(name,e=>window.__moveInput.push({name,target:e.target.id||e.target.closest?.('[data-unit]')?.dataset.unit||e.target.closest?.('button,a')?.id||e.target.tagName,key:e.key||null,button:e.button,pointerType:e.pointerType||null,trusted:e.isTrusted}),true);});
   if(legacy)await context.route('**/hearth-rts.html',route=>route.fulfill({status:200,contentType:'text/html',body:legacyHTML}));
   const page=await context.newPage(),errors=[],events=[];page.on('pageerror',e=>errors.push(e.message));
   await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.goto(url);await page.locator('[data-unit="u0"]').waitFor();
   if(await page.locator('#pause').innerText()==='Pause')await page.locator('#pause').click();
   await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
   assert.equal(await page.locator('#pause').innerText(),'Resume');
   let exportNumber=0;
   const readSaved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
   const material=totals(await readSaved());
   async function exported(name){
    await page.locator('#journey').click();const event=page.waitForEvent('download');await page.locator('#export').click();const download=await event;
    const path='artifacts/hearth-rts-move-'+label+'-'+(++exportNumber)+'-'+name+'.json';await download.saveAs(path);const raw=fs.readFileSync(path,'utf8');await page.locator('#close').click();return raw;
   }
   async function point(x,y){
    await page.locator('#world').scrollIntoViewIfNeeded();const b=await page.locator('#world').boundingBox();
    const t=await page.locator('#world').evaluate(c=>({width:c.width,height:c.height,x:Number(c.dataset.cameraX||0),y:Number(c.dataset.cameraY||0),scale:Number(c.dataset.cameraScale||1)}));
    const p={x:b.x+(x*32*t.scale+t.x)/t.width*b.width,y:b.y+(y*32*t.scale+t.y)/t.height*b.height};
    assert.equal(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.id,p),'world','Input must reach visible map rather than tray/overlay');return p;
   }
   async function ground(x,y,method='context'){
    if(method==='m')await page.keyboard.press('m');
    if(method==='button')await page.locator('#move').click();
    if(method==='touch')await page.locator('#move').tap();
    const p=await point(x+.5,y+.5);
    if(method==='touch')await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y,{button:method==='context'?'right':'left'});
   }
   async function tick(ms=100){
    assert.equal(await page.locator('#pause').innerText(),'Resume');await page.locator('#pause').click();await page.clock.runFor(ms);await page.locator('#pause').click();
    assert.equal(await page.locator('#pause').innerText(),'Resume');const state=await readSaved(); // Pause synchronously saves the live camp.
    if(!legacy)custody(state);assert.deepEqual(totals(state),material);return state;
   }
   async function nextTick(before){let s=before;for(let i=0;i<3&&s.time===before.time;i++)s=await tick();assert.ok(Math.abs(s.time-before.time-.1)<1e-8,'Observe exactly the next simulation tick despite animation-frame alignment');return s;}
   async function until(predicate,label,max=120){let s=await readSaved();for(let i=0;i<max&&!predicate(s);i++)s=await tick(500);assert.ok(predicate(s),'Timed out: '+label);return s;}
   async function captureEvents(){events.push(...await page.evaluate(()=>window.__moveInput.splice(0)));}
   async function close(){await captureEvents();assert.deepEqual(errors,[]);await context.close();return{events,errors};}
   return{context,page,readSaved,exported,point,ground,tick,nextTick,until,captureEvents,close,errors,events};
  }
  async function evidenceFailure(f,label,error){
   await f.page.screenshot({path:'artifacts/hearth-rts-move-'+label+'-failure.png',fullPage:true}).catch(()=>{});
   fs.writeFileSync('artifacts/hearth-rts-move-'+label+'-failure.json',JSON.stringify({error:String(error),errors:f.errors,state:await f.readSaved().catch(()=>null),body:await f.page.locator('body').innerText().catch(()=>''),events:[...f.events,...await f.page.evaluate(()=>window.__moveInput).catch(()=>[])]},null,2));
  }
  // No seeded state in this first group: two wood are physically extracted from d0.
  let earnedRaw;
  {const f=await open('earned');try{
   await f.page.locator('[data-unit="u0"]').click();const p=await f.point(5.5,6.5);await f.page.mouse.click(p.x,p.y,{button:'right'});
   const earned=await f.until(s=>s.units[0].cargo>=2,'ordinary partial wood load');assert.equal(earned.units[0].resource,'wood');assert.ok(earned.units[0].cargo<5);
   custody(earned);earnedRaw=await f.exported('earned-load');fs.writeFileSync('artifacts/hearth-rts-move-earned-load.json',earnedRaw);
   await f.page.screenshot({path:'artifacts/hearth-rts-move-earned-load.png',fullPage:true});report.groups.push({name:'ordinary-earned-load',seed:'fresh page; no state injection',state:JSON.parse(earnedRaw),...await f.close()});
  }catch(e){await evidenceFailure(f,'earned',e);await f.context.close();throw e;}}
  const earned=JSON.parse(earnedRaw);
  for(const method of ['m','button','touch','context']){
   const f=await open(method,earnedRaw,{touch:method==='touch'});try{
    if(method==='touch')await f.page.locator('[data-unit="u0"]').tap();else await f.page.locator('[data-unit="u0"]').click();const before=JSON.parse(await f.exported('before'));
    await f.ground(target.x,target.y,method);const message=await f.page.locator('#toast').innerText();
    assert.match(message,/Move/i);assert.match(message,/Resume|planned/i);assert.doesNotMatch(message,/return home before/i);
    const acceptedRaw=await f.exported('accepted'),accepted=JSON.parse(acceptedRaw),u=unit(accepted,'u0'),old=unit(before,'u0');custody(accepted);
    assert.equal(u.phase,'carryMove');assert.deepEqual(u.order,{kind:'move',...target});assert.equal(u.next,null);assert.equal(u.dropoff,undefined);
    for(const field of ['x','y','cargo','resource','work'])assert.equal(u[field],old[field]);assert.deepEqual(accepted.stock,before.stock);assert.deepEqual(accepted.delivered,before.delivered);assert.deepEqual(totals(accepted),totals(before));
    assert.deepEqual(u.path.at(-1),target);const routeWitness=gatheredRouteWitness(before,accepted,'u0');await f.page.screenshot({path:'artifacts/hearth-rts-move-'+method+'-planned.png',fullPage:true});
    await f.ground(target.x,target.y,method);assert.equal(await f.exported('repeated'),acceptedRaw,'Repeated active Move must preserve the complete paused live state');
    await f.ground(18,3,'context');assert.equal(await f.page.locator('#toast').innerText(),'Move needs clear ground. Previous orders kept.');assert.equal(await f.exported('invalid'),acceptedRaw);
    const first=await f.nextTick(accepted);nextMovement(accepted,first,'u0');assert.deepEqual(first.stock,before.stock);custody(first);
    await f.page.screenshot({path:'artifacts/hearth-rts-move-'+method+'-first-tick.png',fullPage:true});
    const arrival=await f.until(s=>unit(s,'u0').phase==='idle','loaded Move arrival');const held=unit(arrival,'u0');
    assert.equal(held.x,target.x);assert.equal(held.y,target.y);assert.equal(held.cargo,old.cargo);assert.equal(held.resource,'wood');assert.deepEqual(held.order,{kind:'idle'});assert.deepEqual(held.path,[]);assert.equal(held.next,null);
    assert.deepEqual(arrival.stock,before.stock);assert.deepEqual(arrival.delivered,before.delivered);assert.match(await f.page.locator('[data-unit="u0"]').innerText(),/Holding/i);
    const waited=await f.tick(3000);assert.deepEqual(unit(waited,'u0'),held);assert.deepEqual(waited.stock,before.stock);assert.deepEqual(totals(waited),totals(before));custody(waited);
    const heldRaw=await f.exported('held');await f.page.screenshot({path:'artifacts/hearth-rts-move-'+method+'-held.png',fullPage:true});
    await f.captureEvents();await f.page.reload();await f.page.locator('[data-unit="u0"]').waitFor();assert.equal(await f.page.locator('#pause').innerText(),'Resume');assert.equal(await f.exported('reload'),heldRaw);
    await f.page.locator('[data-unit="u0"]').click();await f.page.locator('#stop').click();const returning=JSON.parse(await f.exported('return-planned'));
    assert.equal(unit(returning,'u0').phase,'return');assert.equal(unit(returning,'u0').cargo,old.cargo);
    const receipt=await f.until(s=>!unit(s,'u0').cargo&&unit(s,'u0').phase==='idle','physical Stop receipt');
    assert.equal(receipt.stock.wood,before.stock.wood+old.cargo);assert.equal(receipt.delivered.wood,before.delivered.wood+old.cargo);assert.deepEqual(totals(receipt),totals(before));custody(receipt);
    const settled=await f.tick(3000);assert.deepEqual(unit(settled,'u0'),unit(receipt,'u0'));assert.deepEqual(settled.deposits,receipt.deposits);
    await f.captureEvents();assert.ok(f.events.some(e=>e.trusted&&e.target==='world'&&e.name==='pointerdown'));
    if(method==='touch')assert.ok(f.events.some(e=>e.trusted&&e.target==='move'&&e.name==='pointerdown'&&e.pointerType==='touch'));
    if(method==='m')assert.ok(f.events.some(e=>e.trusted&&e.name==='keydown'&&e.key==='m'));
    report.groups.push({name:method,seed:'ordinary-earned-load',message,before,accepted,routeWitness,first,arrival,held:waited,receipt,...await f.close()});
   }catch(e){await evidenceFailure(f,method,e);await f.context.close();throw e;}
  }
  // Historical whole-page control. Only the seed schema is projected to v3;
  // page bytes are the exact retained Input023 build, with old return-first Move.
  {const projected=structuredClone(earned);projected.version=3;const f=await open('legacy-return-first',JSON.stringify(projected),{legacy:true});try{
   await f.page.locator('[data-unit="u0"]').click();const before=JSON.parse(await f.exported('before'));assert.deepEqual(before,projected);
   await f.ground(target.x,target.y,'m');const after=JSON.parse(await f.exported('accepted')),u=unit(after,'u0');
   assert.equal(u.phase,'return');assert.deepEqual(u.next,{kind:'move',...target});assert.notDeepEqual(u.path.at(-1),target);assert.equal(u.cargo,unit(before,'u0').cargo);
   assert.match(await f.page.locator('#toast').innerText(),/return home before/i);const first=await f.nextTick(after);assert.equal(unit(first,'u0').cargo,u.cargo);assert.notDeepEqual({x:unit(first,'u0').x,y:unit(first,'u0').y},{x:u.x,y:u.y});
   await f.page.screenshot({path:'artifacts/hearth-rts-move-legacy-return-first.png',fullPage:true});report.groups.push({name:'old-return-first-negative-control',seed:'ordinary-earned-load with explicitly projected version3',sourceCommit:'3b15d6081f5396fcc579140c09d86e532674e2dd',before,accepted:after,first,...await f.close()});
  }catch(e){await evidenceFailure(f,'legacy-return-first',e);await f.context.close();throw e;}}
  {const raw=fs.readFileSync('artifacts/hearth-rts-transfer-carried.json','utf8'),f=await open('transfer',raw);try{
   const before=JSON.parse(await f.exported('before')),carrier=before.units.find(u=>u.transfer&&u.cargo);assert.ok(carrier);const job=before.storage.transfers.find(j=>j.id===carrier.transfer);assert.ok(job);assert.equal(before.storage.transfers.length,1);custody(before);
   await f.page.locator('[data-unit="'+carrier.id+'"]').click();await f.ground(target.x,target.y,'button');const accepted=JSON.parse(await f.exported('accepted')),u=unit(accepted,carrier.id);
   assert.equal(u.phase,'carryMove');assert.equal(u.transfer,carrier.transfer);assert.equal(u.dropoff,undefined);assert.equal(u.next,null);assert.deepEqual(u.order,{kind:'move',...target});assert.deepEqual(u.path.at(-1),target);
   for(const field of ['x','y','cargo','resource','work'])assert.equal(u[field],carrier[field],'Transfer Move acceptance preserves '+field);assert.deepEqual(accepted.storage,before.storage);custody(accepted);
   const first=await f.nextTick(accepted);nextMovement(accepted,first,carrier.id);assert.equal(unit(first,carrier.id).transfer,job.id);custody(first);
   await f.page.screenshot({path:'artifacts/hearth-rts-move-transfer-first-tick.png',fullPage:true});
   const held=await f.until(s=>unit(s,carrier.id).phase==='idle','transfer held arrival');assert.equal(unit(held,carrier.id).x,target.x);assert.equal(unit(held,carrier.id).y,target.y);assert.equal(unit(held,carrier.id).cargo,carrier.cargo);assert.equal(unit(held,carrier.id).transfer,job.id);custody(held);
   // Peers may legitimately deliver during this Move. Settle them before attributing
   // the selected carrier's later receipt to an exact physical store.
   const peersSettled=await f.until(s=>s.units.filter(v=>v.id!==carrier.id).every(v=>!v.cargo&&v.phase==='idle')&&s.storage.transfers.find(j=>j.id===job.id)?.remaining===0,'other transfer carriers settled');
   assert.equal(unit(peersSettled,carrier.id).cargo,carrier.cargo);assert.equal(unit(peersSettled,carrier.id).transfer,job.id);assert.equal(unit(peersSettled,carrier.id).x,target.x);assert.equal(unit(peersSettled,carrier.id).y,target.y);
   await f.page.locator('#select-all').click();await f.page.locator('#stores').click();await f.page.locator('#store-destination').selectOption(job.to);await f.page.locator('#store-resource').selectOption(job.resource);
   const repeatBefore=await f.exported('duplicate-before');await f.page.locator('#store-transfer').click();const duplicateMessage=await f.page.locator('#toast').innerText();assert.match(duplicateMessage,/already|existing/i);assert.equal(await f.exported('duplicate-after'),repeatBefore,'Existing transfer activation cannot resume a manually held carrier');
   await f.page.locator('[data-unit="'+carrier.id+'"]').click();await f.page.screenshot({path:'artifacts/hearth-rts-move-transfer-held.png',fullPage:true});
   const saved=await f.exported('held'),priorStop=JSON.parse(saved);await f.captureEvents();await f.page.reload();await f.page.locator('[data-unit="'+carrier.id+'"]').waitFor();assert.equal(await f.exported('reload'),saved);
   await f.page.locator('[data-unit="'+carrier.id+'"]').click();await f.page.locator('#stop').click();const returnPlanned=JSON.parse(await f.exported('return-planned')),returning=unit(returnPlanned,carrier.id),source=returnPlanned.buildings.find(b=>b.id===job.from);
   assert.equal(source.kind,'hearth','This fixture returns its western held load to the original hearth');assert.equal(returning.phase,'return');assert.equal(returning.dropoff,source.id);assert.equal(returning.transfer,job.id);
   for(const field of ['x','y','cargo','resource','work'])assert.equal(returning[field],unit(priorStop,carrier.id)[field]);assert.deepEqual(returnPlanned.storage,priorStop.storage,'Stop plans physical return without remote credit');assert.deepEqual(returnPlanned.stock,priorStop.stock);assert.ok(atStoreEdge(returning.path.at(-1),source));
   let settled=returnPlanned,receiptBefore=null;const returnTrace=[];
   for(let i=0;i<400&&unit(settled,carrier.id).cargo;i++){
    const previous=settled;settled=await f.nextTick(previous);const prev=unit(previous,carrier.id),now=unit(settled,carrier.id);
    assert.ok(Math.hypot(now.x-prev.x,now.y-prev.y)<=.30000001,'Return never teleports');returnTrace.push({time:settled.time,x:now.x,y:now.y,cargo:now.cargo,phase:now.phase,stores:settled.storage.stores});
    if(now.cargo)assert.deepEqual(settled.storage.stores,priorStop.storage.stores,'Goods remain carried until a physical receipt');
    else{receiptBefore=previous;assert.ok(atStoreEdge(prev,source)&&atStoreEdge(now,source),'Receipt occurs only at the named source perimeter');}
   }
   assert.ok(receiptBefore,'Observe the actual cargo-to-store transition');assert.equal(unit(settled,carrier.id).cargo,0);assert.equal(unit(settled,carrier.id).phase,'idle');assert.equal(settled.storage.transfers.some(j=>j.id===job.id),false);
   const expectedStores=structuredClone(priorStop.storage.stores);expectedStores[source.id][carrier.resource]+=carrier.cargo;assert.deepEqual(settled.storage.stores,expectedStores,'Exactly the source store receives this returned load; other stores stay unchanged');
   assert.deepEqual(settled.storage.transferred,priorStop.storage.transferred,'Returning to source is recovery, not destination delivery');
   assert.deepEqual(settled.delivered,before.delivered,'Transfer custody cannot become new gathered production');assert.deepEqual(totals(settled),totals(before));
   assert.equal(settled.storage.transferred[job.resource],before.storage.transferred[job.resource]+job.amount-job.delivered-job.recovered-job.cancelled-carrier.cargo,'Other carriers deliver; the manually held western load returns to source storage');custody(settled);
   const afterReceipt=await f.tick(3000);assert.deepEqual(unit(afterReceipt,carrier.id),unit(settled,carrier.id));assert.deepEqual(afterReceipt.storage.stores,settled.storage.stores);
   report.groups.push({name:'loaded-transfer',seed:'ordinary main-browser physical pickup',before,accepted,first,held,peersSettled,duplicateMessage,returnPlanned,returnTrace,receiptBefore,settled,...await f.close()});
  }catch(e){await evidenceFailure(f,'transfer',e);await f.context.close();throw e;}}
  report.complete=true;console.log('PASS IC02 Move subset: ordinary earned cargo, M/button/emulated-touch/context input, next-tick carried movement, hold/reload, rejection/repeat, physical Stop receipt, transfer custody and pinned old return-first control');
 }finally{fs.writeFileSync('artifacts/hearth-rts-move-report.json',JSON.stringify(report,null,2));if(browser)await browser.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
