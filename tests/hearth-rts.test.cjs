const test=require('node:test'),assert=require('node:assert/strict');
const {Camp,valid,repairWorkResidue}=require('../src/hearth-rts/engine.js');
const steps=(g,n)=>{for(let i=0;i<n*10;i++)g.tick(.1);};
const totals=g=>Object.fromEntries(['wood','stone','food'].map(r=>[r,g.s.stock[r]+g.s.spent[r]+g.s.deposits.filter(d=>d.kind===r).reduce((n,d)=>n+d.amount,0)+g.s.units.filter(u=>u.resource===r).reduce((n,u)=>n+u.cargo,0)]));
const certifiedWithoutOutposts=(g,closedPayments=0)=>{assert.equal(g.s.version,5);assert.equal(g.s.reclaim.profile,'accepted-opening.outpost-reclaim.v1');assert.deepEqual(g.s.reclaim.claims,[]);assert.deepEqual(g.s.reclaim.recovered,{wood:0,stone:0,food:0});assert.deepEqual(g.s.reclaim.settled,{wood:0,stone:0,food:0});assert.equal(g.s.reclaim.settledSites,0);assert.equal(g.s.reclaim.closedPayments,closedPayments);assert.equal(typeof g.s.reclaim.sourceIdentity,'string');};
test('finite deposits conserve stock, cargo and spent resources through depletion and refresh',()=>{
 const g=new Camp(),before=totals(g);g.command(g.s.units.map(u=>u.id),{kind:'gather',target:'d0'});steps(g,100);assert.equal(g.s.deposits[0].amount,0);assert.equal(g.s.stock.wood,68);assert.equal(g.s.depleted,1);assert.ok(g.s.units.every(u=>u.phase==='idle'));assert.deepEqual(totals(g),before);const copy=new Camp(JSON.parse(g.serialize()));steps(g,30);steps(copy,30);assert.deepEqual(copy.s,g.s);assert.equal(g.s.deposits[0].amount,0);assert.ok(valid(g.s));
});
test('repeated gather commands cannot accelerate extraction or teleport carried loads',()=>{
 const a=new Camp(),b=new Camp();for(const g of [a,b])g.command(['u0'],{kind:'gather',target:'d0'});for(let i=0;i<600;i++){a.tick(.1);b.command(['u0'],{kind:'gather',target:'d0'});b.tick(.1);}assert.deepEqual(b.s,a.s);
 const g=new Camp();g.command(['u0'],{kind:'gather',target:'d0'});while(!g.s.units[0].cargo)g.tick(.1);const stock=g.s.stock.wood;g.command(['u0'],{kind:'move',x:25,y:13});assert.equal(g.s.stock.wood,stock);assert.ok(g.s.units[0].cargo>0);steps(g,30);assert.equal(g.s.stock.wood,stock);assert.ok(g.s.units[0].cargo>0);assert.equal(g.s.units[0].x,25);g.command(['u0'],{kind:'idle'});steps(g,30);assert.ok(g.s.stock.wood>stock);assert.equal(g.s.units[0].cargo,0);
});
test('construction consumes its displayed cost exactly once and cancellation refunds once',()=>{
 const g=new Camp();g.command(g.s.units.map(u=>u.id),{kind:'gather',target:'d0'});steps(g,100);g.command(g.s.units.map(u=>u.id),{kind:'gather',target:'d2'});steps(g,110);const before={...g.s.stock},total=totals(g),result=g.build('outpost',11,15,['u0']);assert.ok(result.id);assert.equal(g.s.stock.wood,before.wood-60);assert.equal(g.s.stock.stone,before.stone-20);assert.deepEqual(totals(g),total);assert.ok(g.cancel(result.id));assert.deepEqual(g.s.stock,before);assert.equal(g.cancel(result.id),false);assert.deepEqual(totals(g),total);
 const site=g.build('outpost',11,15,g.s.units.map(u=>u.id));assert.ok(site.id);steps(g,30);assert.ok(g.s.buildings.find(b=>b.id===site.id).done);assert.equal(g.cancel(site.id),false);assert.deepEqual(totals(g),total);
});
test('workers path through the ford and an eastern outpost shortens return trips',()=>{
 // This preexisting geometry-only control deliberately has uncertified v4 cargo/capital.
 const g=new Camp();g.s.version=4;delete g.s.reclaim;const u=g.s.units[0],path=g.path(u,[{x:26,y:13}]);assert.ok(path.length>0);assert.ok(path.every(p=>!g.water(p.x,p.y)));assert.ok(path.some(p=>p.x===18&&p.y>=11&&p.y<=14));g.command(['u0'],{kind:'move',x:26,y:13});steps(g,30);assert.equal(u.x,26);assert.ok(g.visible(29,15));u.cargo=1;u.resource='wood';g.home(u);const original=u.path.length;g.s.buildings.push({id:'fixture-outpost',kind:'outpost',x:23,y:11,done:true,work:24,cost:{wood:60,stone:20}});g.home(u);assert.ok(u.path.length<original/2);
});
test('invalid/future saves fail closed; unknown orders and unreachable sites cannot corrupt saves',()=>{
 const g=new Camp();for(const change of [s=>s.version=6,s=>s.stock.wood=-1,s=>s.units[0].cargo=9,s=>s.deposits[0].amount=Infinity,s=>s.units[0].order={kind:'made-up'}]){const s=JSON.parse(g.serialize());change(s);assert.throws(()=>new Camp(s));}const before=g.serialize();assert.ok(g.build('outpost',18,2,['u0']).error);assert.equal(g.serialize(),before);assert.ok(valid(g.s));
});
test('a selected group reserves distinct gathering positions around a deposit',()=>{
 const g=new Camp();g.command(g.s.units.map(u=>u.id),{kind:'gather',target:'d0'});
 const destinations=g.s.units.map(u=>u.path.at(-1));assert.ok(destinations.every(Boolean));assert.equal(new Set(destinations.map(p=>p.x+','+p.y)).size,4);
});
test('final deliveries reserve distinct drop-off positions without losing cargo',()=>{
 const g=new Camp(),before=totals(g);g.command(g.s.units.map(u=>u.id),{kind:'gather',target:'d0'});steps(g,100);
 assert.equal(g.s.stock.wood,68);assert.ok(g.s.units.every(u=>u.cargo===0&&u.phase==='idle'));assert.deepEqual(totals(g),before);
 for(let i=0;i<g.s.units.length;i++)for(let j=i+1;j<g.s.units.length;j++)assert.ok(Math.hypot(g.s.units[i].x-g.s.units[j].x,g.s.units[i].y-g.s.units[j].y)>=.9,'Returned workers must remain individually visible');
 const copy=new Camp(JSON.parse(g.serialize()));steps(copy,10);assert.deepEqual(copy.s.units,g.s.units);
});
const earnedWorkshop=(CampType=Camp)=>{const g=new CampType();g.command(g.s.units.map(u=>u.id),{kind:'gather',target:'d0'});steps(g,100);g.command(g.s.units.map(u=>u.id),{kind:'gather',target:'d2'});steps(g,100);const b=g.build('workshop',11,15,g.s.units.map(u=>u.id));assert.ok(b.id);steps(g,35);return {g,id:b.id};};
test('workshop knapping reserves once, retains interrupted work and completes through assigned workers',()=>{
 const {g,id}=earnedWorkshop(),initial=totals(g),stock={...g.s.stock};assert.equal(g.beginKnapping(id,[]),'Select villagers to craft the tools');assert.deepEqual(g.s.stock,stock);assert.equal(g.beginKnapping(id,['u0']),null);assert.equal(g.s.stock.wood,stock.wood-4);assert.equal(g.s.stock.stone,stock.stone-8);
 while(g.s.knapping.work<2)g.tick(.1);const work=g.s.knapping.work;g.command(['u0'],{kind:'idle'});steps(g,2);assert.equal(g.s.knapping.work,work);const copy=new Camp(JSON.parse(g.serialize()));assert.equal(g.beginKnapping(id,['u0']),null);assert.equal(copy.beginKnapping(id,['u0']),null);for(let i=0;i<300;i++){g.beginKnapping(id,['u0']);g.tick(.1);copy.tick(.1);}assert.deepEqual(g.s,copy.s);assert.ok(g.s.tools);assert.ok(g.s.knapping.done);assert.equal(g.s.knapping.work,12);assert.deepEqual(totals(g),initial);assert.equal(g.s.stock.wood,stock.wood-4);assert.ok(valid(g.s));
});
test('crafted tools improve extraction without creating resources or increasing cargo capacity',()=>{
 const {g,id}=earnedWorkshop();const plain=new Camp(JSON.parse(g.serialize()));g.beginKnapping(id,g.s.units.map(u=>u.id));steps(g,25);assert.ok(g.s.tools);
 // Controlled extraction comparison isolates tool effect from travel and crafting time.
 for(const camp of [plain,g]){for(const u of camp.s.units){u.order={kind:'idle'};u.phase='idle';u.path=[];}const u=camp.s.units[0],d=camp.s.deposits[1];u.x=d.x-1;u.y=d.y;u.cargo=0;u.work=0;camp.command([u.id],{kind:'gather',target:d.id});}
 const before=totals(g);steps(plain,2);steps(g,2);assert.ok(g.s.units[0].cargo>plain.s.units[0].cargo);assert.ok(g.s.units[0].cargo<=5);assert.deepEqual(totals(g),before);
});
test('RTS v1 migrates without changing world, cargo or orders and future formats are rejected',()=>{
 const g=new Camp();g.command(['u0'],{kind:'gather',target:'d0'});while(!g.s.units[0].cargo)g.tick(.1);const old=JSON.parse(g.serialize());old.version=1;delete old.tools;delete old.knapping;delete old.storage;delete old.reclaim;const raw=JSON.stringify(old),migrated=new Camp(old);assert.equal(JSON.stringify(old),raw);certifiedWithoutOutposts(migrated);assert.equal(migrated.s.tools,false);assert.equal(migrated.s.knapping,null);for(const field of ['stock','spent','deposits','buildings','units','seen'])assert.deepEqual(migrated.s[field],old[field]);assert.ok(valid(migrated.s));const future={...migrated.s,version:6};assert.throws(()=>new Camp(future));
});

const earnedToolGatherer=(CampType=Camp)=>{const {g,id}=earnedWorkshop(CampType);assert.equal(g.beginKnapping(id,g.s.units.map(u=>u.id)),null);steps(g,25);assert.equal(g.s.tools,true);assert.equal(g.s.knapping.done,true);assert.equal(g.command(['u0'],{kind:'gather',target:'d1'}),1);return g;};
test('earned tools remain strictly saveable through every extraction tick, carried return and repeated roundtrip',()=>{
 const g=earnedToolGatherer(),before=totals(g),delivered=g.s.delivered.wood;let copy=new Camp(JSON.parse(g.serialize())),extractTicks=0,sawNinth=false,sawReturn=false;
 for(let i=0;i<600;i++){
  const u=g.s.units[0];if(u.phase==='extract'&&!u.path.length)extractTicks++;
  g.tick(.1);copy.tick(.1);assert.ok(valid(g.s),'Strict save validity at tick '+i);assert.deepEqual(copy.s,g.s);assert.deepEqual(totals(g),before);assert.ok(g.s.units.every(u=>u.work>=0&&u.cargo<=5));
  if(extractTicks===9){sawNinth=true;assert.equal(u.cargo,2);assert.equal(u.work,0);}
  if(u.phase==='return'&&u.cargo>0)sawReturn=true;
  copy=new Camp(JSON.parse(copy.serialize()));assert.deepEqual(copy.s,g.s);
 }
 assert.equal(sawNinth,true);assert.equal(sawReturn,true);assert.ok(g.s.delivered.wood>=delivered+10,'At least two real loads must reach storage');
 const paused=g.serialize();for(let i=0;i<50;i++){assert.equal(g.serialize(),paused);assert.equal(new Camp(JSON.parse(paused)).serialize(),paused);}assert.deepEqual(totals(g),before);
});

const generatedResidue={};
const naturalResidue=(legacy=false)=>{
 const generation=legacy?'v3':'v5';if(generatedResidue[generation])return structuredClone(generatedResidue[generation]);
 // Negative control differs only in the extraction remainder assignment; all other source and inputs match.
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(legacy?require('node:path').join(__dirname,'fixtures/hearth-rts-engine-v3.txt'):require.resolve('../src/hearth-rts/engine.js'),'utf8'),clamp='u.work=Math.max(0,u.work-interval)';
 assert.equal(source.split(clamp).length,2,'The old-behavior control must replace exactly one assignment');
 const context={module:{exports:{}},structuredClone};vm.runInNewContext(source.replace(clamp,'u.work-=interval'),context,{filename:'hearth-rts-old-remainder-control.js'});
 const fixedContext={module:{exports:{}},structuredClone};vm.runInNewContext(source,fixedContext,{filename:'hearth-rts-fixed-remainder-control.js'});
 const old=earnedToolGatherer(context.module.exports.Camp),fixed=earnedToolGatherer(fixedContext.module.exports.Camp),before=totals(old);assert.equal(old.s.version,legacy?3:5);assert.deepEqual(JSON.parse(old.serialize()),JSON.parse(fixed.serialize()));
 for(let i=0;i<600;i++){
  old.tick(.1);fixed.tick(.1);const raw=JSON.parse(old.serialize()),u=raw.units[0];assert.deepEqual(totals(old),before);assert.deepEqual(totals(fixed),before);
  if(u.work<0){
   assert.ok(u.work>=-1e-12);assert.equal(u.phase,'extract');assert.equal(u.cargo,2);assert.equal(u.resource,'wood');assert.equal(valid(raw),false);assert.ok(valid(fixed.s));
   const expected=structuredClone(raw);expected.units[0].work=0;assert.deepEqual(JSON.parse(fixed.serialize()),expected,'The entire natural trace differs only in the repaired remainder');
   old.command(['u0'],{kind:'idle'});const returning=JSON.parse(old.serialize());assert.equal(returning.units[0].phase,'return');assert.equal(returning.units[0].work,u.work);
   generatedResidue[generation]={extract:raw,returning};return structuredClone(generatedResidue[generation]);
  }
  assert.deepEqual(raw,JSON.parse(fixed.serialize()));
 }
 assert.fail('The old subtraction must naturally reproduce a negative extraction remainder');
};
test('current v5 and projected v4 subtraction negative controls remain invalid and explicitly unrepaired',()=>{
 const examples=naturalResidue();for(const checkpoint of [examples.extract,examples.returning])for(const version of [4,5]){const original=structuredClone(checkpoint);original.version=version;if(version===4)delete original.reclaim;const raw=JSON.stringify(original);assert.equal(valid(original),false);assert.equal(repairWorkResidue(original),null);assert.throws(()=>new Camp(original));assert.equal(JSON.stringify(original),raw);}
});
test('pinned v3 subtraction naturally produces an invalid earned-tools save and repair changes only its residue',()=>{
 const examples=naturalResidue(true);for(const original of [examples.extract,examples.returning]){const raw=JSON.stringify(original),before=totals({s:original});assert.equal(valid(original),false);assert.throws(()=>new Camp(original));
  const repaired=repairWorkResidue(original),expected=structuredClone(original);expected.units[0].work=0;assert.notEqual(repaired,original);assert.deepEqual(repaired,expected);assert.equal(JSON.stringify(original),raw);assert.equal(valid(repaired),true);assert.equal(repairWorkResidue(repaired),null);
  const restored=new Camp(repaired);certifiedWithoutOutposts(restored,2);steps(restored,30);assert.ok(valid(restored.s));assert.deepEqual(totals(restored),before);assert.equal(JSON.stringify(original),raw);
 }
});

test('explicit work-residue recovery preserves v1/v2/v3 world state before normal migration',()=>{
 // v1/v2 compatibility inputs are explicitly projected from the generated pinned-v3 checkpoint.
 const {extract}=naturalResidue(true);for(const version of [1,2,3]){const original=structuredClone(extract);original.version=version;if(version<3)delete original.storage;if(version===1){delete original.tools;delete original.knapping;}const raw=JSON.stringify(original),before=totals({s:original});
  const repaired=repairWorkResidue(original);assert.ok(repaired);assert.equal(repaired.version,version);assert.equal(JSON.stringify(original),raw);assert.equal(valid(original),false);assert.equal(valid(repaired),true);
  const migrated=new Camp(repaired);
  // The v1 projection omits the paid tool project but retains its spent bill: playable, uncertified.
  if(version===1){assert.equal(migrated.s.version,4);assert.equal(migrated.s.reclaim,undefined);assert.ok(migrated.reclaimIssue);}else certifiedWithoutOutposts(migrated,version===3?2:0);
  for(const field of ['stock','spent','deposits','buildings','units','seen','time','complete'])assert.deepEqual(migrated.s[field],repaired[field]);assert.deepEqual(totals(migrated),before);assert.equal(JSON.stringify(original),raw);
 }
});

test('work-residue repair rejects material negatives, unrelated work, transfer cargo and otherwise malformed saves',()=>{
 const {extract}=naturalResidue(true);const mutations=[
  s=>s.version=4,s=>s.units[0].work=-1.0001e-12,s=>s.units[0].work=-.1,s=>s.units[0].work=-Infinity,
  s=>s.units[0].work=NaN,s=>s.units[0].cargo=0,s=>s.units[0].cargo=6,s=>s.units[0].resource='stone',
  s=>s.units[0].order.target='missing',s=>s.units[0].order={kind:'build',target:s.buildings[1].id},
  s=>s.units[0].phase='walk',s=>s.units[0].phase='craft',s=>s.units[0].phase='construct',s=>s.units[0].transfer='t1',
  s=>{s.units[0].phase='idle';s.units[0].path=[{x:9,y:5}];},s=>s.units[1].work=-.1,
  s=>s.stock.wood++,s=>s.knapping.work=-.1,s=>s.time=-1
 ];
 for(const mutate of mutations){const bad=structuredClone(extract);mutate(bad);const before=structuredClone(bad);assert.equal(repairWorkResidue(bad),null);assert.deepEqual(bad,before);}
 assert.equal(repairWorkResidue(null),null);assert.equal(repairWorkResidue(new Camp().s),null);
 const boundary=structuredClone(extract);boundary.units[0].work=-1e-12;assert.equal(repairWorkResidue(boundary).units[0].work,0);
 const held=structuredClone(extract);held.units[0].phase='idle';held.units[0].path=[];const raw=JSON.stringify(held),repaired=repairWorkResidue(held);assert.ok(repaired);assert.equal(repaired.units[0].phase,'idle');assert.equal(repaired.units[0].cargo,held.units[0].cargo);assert.equal(JSON.stringify(held),raw);assert.deepEqual(totals(new Camp(repaired)),totals({s:held}));
});
