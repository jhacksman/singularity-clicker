// Spark only. A controlled start from the ordinary browser journey's earned camp.
// All subsequent gathering, pause/save and reload actions use the real page UI.
const assert=require('node:assert/strict'),fs=require('node:fs'),{spawn}=require('node:child_process'),{once}=require('node:events');
const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright'),{KEY,valid}=require('../../src/hearth-rts/engine.js');
const earnedRaw=fs.readFileSync('artifacts/hearth-rts-earned-camp.json','utf8'),earned=JSON.parse(earnedRaw);
const html=fs.readFileSync('dist/hearth-rts.html','utf8'),clamp='u.work=Math.max(0,u.work-interval)',oldSubtract='u.work-=interval';
assert.equal(html.split(clamp).length,2,'The paired old-behavior control must replace exactly one successful-extraction clamp');
assert.ok(earned.tools&&earned.knapping?.done,'The controlled seed must contain tools earned by the ordinary browser journey');
const oldHTML=html.replace(clamp,oldSubtract),url='http://127.0.0.1:8080/hearth-rts.html';
const totals=s=>Object.fromEntries(['wood','stone','food'].map(r=>[r,s.stock[r]+s.spent[r]+s.deposits.filter(d=>d.kind===r).reduce((sum,d)=>sum+d.amount,0)+s.units.filter(u=>u.resource===r).reduce((sum,u)=>sum+u.cargo,0)]));
fs.mkdirSync('artifacts',{recursive:true});
(async()=>{const server=spawn(process.execPath,['scripts/serve.cjs'],{stdio:['ignore','pipe','inherit']});let browser;
try{
 await once(server.stdout,'data');browser=await playwright.chromium.launch({headless:true,chromiumSandbox:true});
 for(const negativeControl of [true,false]){
  const label=negativeControl?'old-subtraction':'clamped',context=await browser.newContext({viewport:{width:1440,height:1100}});
  await context.addInitScript(({key,raw})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,raw);},{key:KEY,raw:earnedRaw});
  if(negativeControl)await context.route('**/hearth-rts.html',route=>route.fulfill({status:200,contentType:'text/html',body:oldHTML}));
  const page=await context.newPage(),errors=[],trace=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.goto(url);await page.locator('[data-unit="u0"]').waitFor();await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
   const read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY),initial=await read();assert.deepEqual(initial,earned);assert.equal(await page.locator('#pause').innerText(),'Resume');
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
   fs.writeFileSync('artifacts/hearth-rts-roundtrip-'+label+'.json',JSON.stringify({negativeControl,seed:'hearth-rts-earned-camp.json',trace,checkpoint,errors},null,2));
   await page.screenshot({path:'artifacts/hearth-rts-roundtrip-'+label+'.png',fullPage:true});
   if(negativeControl){
    assert.equal(checkpoint.units[0].cargo,2);assert.equal(checkpoint.units[0].work,-5.551115123125783e-17);assert.equal(valid(checkpoint),false,'Old subtraction must reproduce the genuine invalid generated save');
    // Old subtraction is the only reverted operation. The new explicit recovery
    // path may repair this save; record that separately from the generation proof.
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
 console.log('PASS earned-tool extraction: old-subtraction control generates a rejected negative-work save; corrected per-tick saves conserve resources and survive exact paused reload');
}finally{if(browser)await browser.close();server.kill();}})().catch(error=>{console.error(error);process.exitCode=1;});
