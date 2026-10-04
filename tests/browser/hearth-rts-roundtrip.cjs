// Spark only. A controlled start from the ordinary browser journey's earned camp.
// All subsequent gathering, pause/save and reload actions use the real page UI.
const assert=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto'),{spawn}=require('node:child_process'),{once}=require('node:events');
const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright'),{KEY,valid,repairWorkResidue}=require('../../src/hearth-rts/engine.js');
const earnedRaw=fs.readFileSync('artifacts/hearth-rts-earned-camp.json','utf8'),earned=JSON.parse(earnedRaw);
const html=fs.readFileSync('dist/hearth-rts.html','utf8'),clamp='u.work=Math.max(0,u.work-interval)',oldSubtract='u.work-=interval';
assert.equal(html.split(clamp).length,2,'The paired old-behavior control must replace exactly one successful-extraction clamp');
assert.equal(earned.version,5);assert.equal(earned.reclaim.profile,'accepted-opening.outpost-reclaim.v1');
assert.ok(earned.tools&&earned.knapping?.done,'The controlled seed must contain tools earned by the ordinary browser journey');
const oldHTML=html.replace(clamp,oldSubtract),url='http://127.0.0.1:8080/hearth-rts.html';
// This is a controlled compatibility projection, not an untouched historical save.
// Project v5 to v3 and omit v5 reclaim authority; actual gathering in the pinned v3 page below
// generates the legacy residue checkpoint subsequently consumed by bootstrap.
const {reclaim:omittedReclaim,...legacyFields}=structuredClone(earned),legacySeed={...legacyFields,version:3},legacyRaw=JSON.stringify(legacySeed);
const legacySource='tests/fixtures/hearth-rts-input023-v3.html',legacyHTML=fs.readFileSync(legacySource,'utf8');
const legacySHA='4fa74911ae0a0650885355e5e20b4cd2b532c83e4b8bed496a50866a09a63b0a';
assert.equal(createHash('sha256').update(legacyHTML).digest('hex'),legacySHA,'The legacy control must use the retained Input023 v3 page');
assert.equal(legacyHTML.split(clamp).length,2,'The pinned v3 control must replace exactly one clamp and no other source');
assert.equal(omittedReclaim.profile,'accepted-opening.outpost-reclaim.v1');assert.deepEqual(legacySeed,{...legacyFields,version:3});assert.equal(legacySeed.reclaim,undefined);assert.ok(valid(legacySeed));
const cases=[
 {label:'old-subtraction',negativeControl:true,legacy:false,seed:earned,raw:earnedRaw,body:oldHTML},
 {label:'clamped',negativeControl:false,legacy:false,seed:earned,raw:earnedRaw,body:null},
 {label:'legacy-v3-old-subtraction',negativeControl:true,legacy:true,seed:legacySeed,raw:legacyRaw,body:legacyHTML.replace(clamp,oldSubtract)}
];
const totals=s=>Object.fromEntries(['wood','stone','food'].map(r=>[r,s.stock[r]+s.spent[r]+s.deposits.filter(d=>d.kind===r).reduce((sum,d)=>sum+d.amount,0)+s.units.filter(u=>u.resource===r).reduce((sum,u)=>sum+u.cargo,0)]));
fs.mkdirSync('artifacts',{recursive:true});
(async()=>{const server=spawn(process.execPath,['scripts/serve.cjs'],{stdio:['ignore','pipe','inherit']});let browser;
try{
 await once(server.stdout,'data');browser=await playwright.chromium.launch({headless:true,chromiumSandbox:true});
 for(const {label,negativeControl,legacy,seed,raw,body} of cases){
  const context=await browser.newContext({viewport:{width:1440,height:1100}});
  await context.addInitScript(({key,raw})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,raw);},{key:KEY,raw});
  if(body)await context.route('**/hearth-rts.html',route=>route.fulfill({status:200,contentType:'text/html',body}));
  const page=await context.newPage(),errors=[],trace=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.goto(url);await page.locator('[data-unit="u0"]').waitFor();await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
   const read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY),initial=await read();assert.deepEqual(initial,seed,'The full controlled seed must load before any real UI gathering');assert.equal(initial.version,legacy?3:5);assert.equal(await page.locator('#pause').innerText(),'Resume');assert.equal(await page.locator('#stop').isDisabled(),false);
   const deposit=initial.deposits.find(d=>d.kind==='food'&&d.amount>=15&&initial.seen.includes(d.y*36+d.x));assert.ok(deposit,'Use an actual remaining visible finite food deposit');
   await page.locator('[data-unit="u0"]').click();const rect=await page.locator('#world').boundingBox();await page.mouse.click(rect.x+(deposit.x+.5)/36*rect.width,rect.y+(deposit.y+.5)/24*rect.height,{button:'right'});
   assert.deepEqual((await read()).units[0].order,{kind:'gather',target:deposit.id});
   let checkpoint=null,previous=await read();
   for(let step=1;step<=600;step++){
    await page.locator('#pause').click();await page.clock.runFor(100);await page.locator('#pause').click();
    const state=await read(),worker=state.units[0];
    assert.ok(state.time-previous.time<=.10000001,'Sample at every simulation tick; do not skip a transient invalid state');
    trace.push({step,time:state.time,work:worker.work,cargo:worker.cargo,phase:worker.phase,pathLength:worker.path.length,valid:valid(state)});
    assert.deepEqual(totals(state),totals(initial),'Each sampled physical state conserves resources');
    if(negativeControl&&worker.work<0){checkpoint=state;break;}
    if(!negativeControl){assert.ok(valid(state),'Every actual saved gathering checkpoint must remain loadable');if(worker.cargo===2&&worker.work===0){checkpoint=state;break;}}
    previous=state;
   }
   assert.ok(checkpoint,'Observe the second tool-assisted extraction boundary rather than a later idle checkpoint');
   await page.locator('#journey').click();const downloadEvent=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadEvent,downloadPath='artifacts/hearth-rts-roundtrip-'+label+'-download.json';await download.saveAs(downloadPath);
   assert.deepEqual(JSON.parse(fs.readFileSync(downloadPath,'utf8')),checkpoint,'The real UI export must match the exact paused checkpoint in memory and storage');await page.locator('#close').click();
   fs.writeFileSync('artifacts/hearth-rts-roundtrip-'+label+'.json',JSON.stringify({negativeControl,seed:'hearth-rts-earned-camp.json',seedProjection:legacy?'controlled projection: version 5 to 3 and omit v5 reclaim authority':null,source:legacy?{path:legacySource,sha256:legacySHA,mutation:{from:clamp,to:oldSubtract,count:1}}:{path:'dist/hearth-rts.html',mutation:negativeControl?{from:clamp,to:oldSubtract,count:1}:null},downloadPath,trace,checkpoint,errors},null,2));
   await page.screenshot({path:'artifacts/hearth-rts-roundtrip-'+label+'.png',fullPage:true});
   if(negativeControl){
    assert.equal(checkpoint.units[0].cargo,2);assert.equal(checkpoint.units[0].work,-5.551115123125783e-17);assert.equal(valid(checkpoint),false,'Old subtraction must reproduce the genuine invalid generated save');
    assert.equal(checkpoint.version,legacy?3:5);
    if(legacy){const repaired=repairWorkResidue(checkpoint);assert.ok(repaired&&valid(repaired),'Only the generated legacy checkpoint is eligible for explicit residue repair');assert.equal(repaired.version,3);assert.equal(repaired.units[0].work,0);}
    else assert.equal(repairWorkResidue(checkpoint),null,'A current-v5 negative checkpoint must remain strict-invalid and unrepaired');
   }else{
    await page.reload();await page.locator('[data-unit="u0"]').waitFor();assert.equal(await page.locator('#pause').innerText(),'Resume');assert.equal(await page.locator('#stop').isDisabled(),false);assert.deepEqual(await read(),checkpoint);
    await page.clock.runFor(2500);assert.deepEqual(await read(),checkpoint,'The exact carried second-item state stays frozen after refresh');
    await page.locator('#pause').click();await page.clock.runFor(8000);await page.locator('#pause').click();const continued=await read();assert.ok(valid(continued));assert.ok(continued.time>checkpoint.time);assert.deepEqual(totals(continued),totals(initial));
   }
   assert.deepEqual(errors,[]);
  }catch(error){
   await page.screenshot({path:'artifacts/hearth-rts-roundtrip-'+label+'-failure.png',fullPage:true}).catch(()=>{});
   fs.writeFileSync('artifacts/hearth-rts-roundtrip-'+label+'-failure.json',JSON.stringify({trace,errors,page:await page.evaluate(k=>({body:document.body.innerText,raw:localStorage.getItem(k)}),KEY).catch(()=>null)},null,2));throw error;
  }finally{await context.close();}
 }
 console.log('PASS earned-tool extraction: current-v5 old subtraction stays invalid and unrepaired; clamped saves conserve resources and survive paused reload; pinned v3 UI generates the separate repairable legacy checkpoint from a labeled v5-to-v3 seed projection omitting reclaim authority');
}finally{if(browser)await browser.close();server.kill();}})().catch(error=>{console.error(error);process.exitCode=1;});
