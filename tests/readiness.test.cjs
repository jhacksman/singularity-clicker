const test=require('node:test');
const assert=require('node:assert/strict');
const {Hearth,TECH,valid}=require('../src/hearth/engine.js');
const {Camp}=require('../src/engine.js');
const restore=g=>new Hearth(JSON.parse(g.serialize()));

test('repeated assignments preserve deterministic work across refreshes',()=>{
 let repeated=new Hearth(),control=new Hearth();
 for(const g of [repeated,control])g.assign([0],'wood');
 for(let i=0;i<120;i++){
  repeated.assign([0],'wood');repeated.tick(1);control.tick(1);
  if(i%17===0)repeated=restore(repeated);
 }
 assert.deepEqual(repeated.s,control.s);
 assert.ok(repeated.s.stats.wood>0);
});
test('changing jobs or resting carries an existing load home before depositing',()=>{
 for(const job of ['food','idle']){
  let g=new Hearth();g.assign([0],'wood');
  let p=g.s.people[0];for(let i=0;i<120&&!p.load;i++)g.tick(1);
  assert.ok(p.load>0);const load=p.load,stock=g.tile.stock.wood;
  g.assign([0],job);assert.equal(g.tile.stock.wood,stock);assert.equal(p.load,load);assert.equal(p.phase,'home');
  g=restore(g);p=g.s.people[0];
  for(let i=0;i<120&&p.load;i++)g.tick(1);
  assert.equal(p.load,0);assert.equal(g.s.stats.wood,load);assert.equal(p.job,job);assert.ok(valid(g.s));
 }
});
test('fractional payment tolerance never writes a negative balance or invalid save',()=>{
 const g=new Hearth();g.s.knowledge=TECH.knapping.knowledge;g.tile.stock.stone=3-1e-9;
 assert.equal(g.learn('knapping'),true);assert.equal(g.tile.stock.stone,0);assert.ok(valid(g.s));assert.deepEqual(restore(g).s,g.s);
 const before=g.serialize();assert.equal(g.learn('knapping'),false);assert.equal(g.serialize(),before);
});
test('locked practices and unaffordable payments are atomic',()=>{
 const g=new Hearth();g.s.knowledge=999;
 const before=g.serialize();assert.equal(g.learn('plow'),false);assert.equal(g.serialize(),before);
 assert.equal(g.pay(g.tile,{wood:1,food:999}),false);assert.equal(g.serialize(),before);
});
test('v1 saves preserve both stages; unknown versions are rejected without migration guesses',()=>{
 for(const C of [Camp,Hearth]){
  const g=new C(),saved=g.serialize();assert.equal(new C(JSON.parse(saved)).serialize(),saved);
  for(const version of [0,2,'1',null]){const state=JSON.parse(saved);state.version=version;assert.throws(()=>new C(state));assert.equal(g.serialize(),saved);}
 }
});
test('Cave rejects contradictory completion flags that strand the fire encounter',()=>{
 for(const mutate of [s=>s.run.event=4,s=>s.run.complete=true,s=>{s.run.event=4;s.run.complete=true;}]){
  const state=JSON.parse(new Camp().serialize());mutate(state);assert.equal(Camp.valid(state),false);assert.throws(()=>new Camp(state));
 }
});

test('herders explain missing animal provisions instead of claiming the herd is settled',()=>{
 const g=new Hearth();g.s.tech=['husbandry'];
 for(let x=12;x<=15;x++)for(let y=12;y<=15;y++)if(x===12||x===15||y===12||y===15)g.tile.buildings.push({id:`f${x}-${y}`,kind:x===13&&y===12?'gate':'fence',x,y,done:true,paid:true,work:10,growth:0,durability:100});
 g.tile.buildings.push({id:'pen',kind:'pen',x:13,y:13,done:true,paid:true,work:50,growth:0,durability:100});
 const p=g.s.people[0];Object.assign(p,{x:13,y:13,job:'herd',work:19});g.tile.stock.food=2;g.tile.stock.water=3;
 g.tick(1);assert.equal(g.tile.herd,0);assert.match(p.blocked,/Needs 6 food and 3 water/);
});
test('an ordinary Hearth policy completes with recurring save restoration and no boosted state',()=>{
 const {execFileSync}=require('node:child_process'),path=require('node:path');
 const output=execFileSync(process.execPath,[path.join(__dirname,'../scripts/diagnostics/hearth-playthrough.cjs')],{encoding:'utf8'});
 const summary=JSON.parse(output.trim().split('\n').at(-1));assert.equal(summary.complete,true);assert.ok(summary.time<=7200);
 assert.ok(summary.milestones.some(m=>m.planned==='enclosure'));assert.ok(summary.milestones.some(m=>m.learned==='plow'));
 console.log('Command-only Hearth completion with periodic save restoration:',summary.time,'simulated seconds');
});
