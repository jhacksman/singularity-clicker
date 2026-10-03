// Full Hearth progression through the browser's existing controls, with no save boosts.
const assert=require('node:assert/strict'),fs=require('node:fs'),{spawn}=require('node:child_process'),{once}=require('node:events');
const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright'),{TECH,BUILD}=require('../../src/hearth/engine.js');
const KEY='singularity-clicker.hearth.v1';fs.mkdirSync('artifacts',{recursive:true});
(async()=>{const server=spawn(process.execPath,['scripts/serve.cjs'],{stdio:['ignore','pipe','inherit']});let browser,page;
 try{await Promise.race([once(server.stdout,'data'),once(server,'exit').then(()=>{throw Error('Server did not start');})]);browser=await playwright.chromium.launch({headless:true,chromiumSandbox:true});const context=await browser.newContext({viewport:{width:1280,height:900}});page=await context.newPage();const errors=[],milestones=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8080/hearth.html');await page.locator('#people [data-person="0"]').waitFor();await page.locator('#pause').click();await page.locator('#step').click();
 const read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);
 const tab=name=>page.locator('#tab-'+name).click();
 const plan=async(kind,x,y)=>{await tab('build');await page.locator('[data-build="'+kind+'"]').click();const r=await page.locator('#world').boundingBox(),u=Math.min(r.width/56,r.height/31);await page.mouse.click(r.x+r.width*.5+(x-y)*u*1.45,r.y+r.height*.19+(x+y)*u*.72);await tab('work');};
 const clear=(t,x,y)=>Math.hypot(x-9,y-9)>=2&&!t.buildings.some(b=>b.x===x&&b.y===y)&&!t.nodes.some(n=>n.x===x&&n.y===y&&(n.kind==='water'||n.amount>0));
 let state=await read(),lastMilestoneCount=0;
 while(state.time<7200&&!state.complete){
  for(const[id,d]of Object.entries(TECH))if(!state.tech.includes(id)&&d.needs.every(k=>state.tech.includes(k))&&state.knowledge>=d.knowledge&&Object.entries(d.cost).every(([k,v])=>state.tiles[state.location].stock[k]>=v)){await tab('learn');await page.locator('[data-learn="'+id+'"]').click();state=await read();milestones.push({time:state.time,learned:id});}
  for(const kind of ['shelter','store','rack','field','plow']){let t=state.tiles[state.location];if(t.buildings.some(b=>b.kind===kind)||!BUILD[kind].needs.every(k=>state.tech.includes(k)))continue;const spot=[[9,13],[9,14],[9,15],[9,16],[9,17],[13,9],[14,9],[15,9]].find(([x,y])=>clear(t,x,y));if(spot){await plan(kind,...spot);state=await read();}}
  let t=state.tiles[state.location];
  if(state.tech.includes('husbandry')&&!t.buildings.some(b=>b.kind==='pen')){
   let cells=null;for(let x=1;x<=14&&!cells;x++)for(let y=1;y<=14&&!cells;y++){const candidate=[];for(let dx=0;dx<4;dx++)for(let dy=0;dy<4;dy++)if(dx===0||dy===0||dx===3||dy===3)candidate.push({x:x+dx,y:y+dy,kind:dx===1&&dy===0?'gate':'fence'});candidate.push({x:x+1,y:y+1,kind:'pen'});if(candidate.every(p=>clear(t,p.x,p.y)))cells=candidate;}
   if(cells){for(const p of cells)await plan(p.kind,p.x,p.y);state=await read();milestones.push({time:state.time,planned:'enclosure'});}
  }
  t=state.tiles[state.location];const next=Object.entries(TECH).find(([id,d])=>!state.tech.includes(id)&&d.needs.every(k=>state.tech.includes(k))),unfinished=t.buildings.find(b=>!b.done),demand={wood:30,food:30,water:30,stone:3,fiber:6,seed:3};
  for(const cost of [next?.[1].cost,unfinished&&BUILD[unfinished.kind].cost])for(const[k,v]of Object.entries(cost||{}))demand[k]=Math.max(demand[k],v+2);
  await tab('work');if(t.stock.seed<demand.seed&&state.time-state.practiceAt>=35){await page.locator('[data-practice="gather"]').click();await page.locator('#practice-act').click();await page.locator('#practice-done').click();state=await read();t=state.tiles[state.location];}
  const people=state.people.filter(p=>p.tile===state.location&&!p.route);
  for(let i=0;i<people.length;i++){
   let job;if(i<3)job=['wood','food','water'][i];else if(i===3&&state.tech.includes('plow')&&t.trained&&t.buildings.some(b=>b.kind==='plow'&&b.done))job='plow';else if(i===3&&t.buildings.some(b=>b.kind==='pen'&&b.done)&&t.trained<1)job='herd';else if(unfinished&&Object.entries(BUILD[unfinished.kind].cost).every(([k,v])=>t.stock[k]>=v))job='build';else job=['fiber','stone','wood','food','water'].sort((a,b)=>(demand[b]-t.stock[b])-(demand[a]-t.stock[a]))[0];
   if(people[i].job===job)continue;await page.evaluate(({id,job})=>{for(const b of document.querySelectorAll('[data-person][aria-pressed="true"]'))if(Number(b.dataset.person)!==id)b.click();const target=document.querySelector('[data-person="'+id+'"]');if(target.getAttribute('aria-pressed')!=='true')target.click();document.querySelector('[data-job="'+job+'"]').click();},{id:people[i].id,job});
  }
  await page.evaluate(()=>{for(let i=0;i<10;i++)document.getElementById('step').click();});state=await read();
  if(milestones.length!==lastMilestoneCount){console.log(JSON.stringify({time:state.time,latest:milestones.at(-1),people:state.people.length,knowledge:Math.floor(state.knowledge),food:Math.floor(state.tiles[state.location].stock.food)}));lastMilestoneCount=milestones.length;}
 }
 assert.equal(state.complete,true,'Full browser policy must finish the first furrow');assert.ok(state.plowed>=1);assert.ok(state.tiles[state.location].trained>=1);await page.screenshot({path:'artifacts/hearth-full-browser-completion.png',fullPage:true});fs.writeFileSync('artifacts/hearth-earned-completed-save.json',JSON.stringify(state));fs.writeFileSync('artifacts/hearth-browser-milestones.json',JSON.stringify(milestones,null,2));assert.deepEqual(errors,[]);
 console.log('PASS full Hearth browser controls: first furrow at '+state.time+' simulated seconds; no boosted state, no page errors');await context.close();
 }catch(error){if(page){await page.screenshot({path:'artifacts/hearth-progression-failure.png',fullPage:true}).catch(()=>{});fs.writeFileSync('artifacts/hearth-progression-failure.txt',await page.locator('body').innerText().catch(()=>''));}throw error;}finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
