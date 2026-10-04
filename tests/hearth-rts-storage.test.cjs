const test=require('node:test'),assert=require('node:assert/strict');
const {Camp,valid}=require('../src/hearth-rts/engine.js');
const resources=['wood','stone','food'];
const steps=(g,seconds)=>{for(let i=0;i<seconds*10;i++)g.tick(.1);};
const until=(g,predicate,seconds=180)=>{for(let i=0;i<seconds*10&&!predicate();i++)g.tick(.1);assert.ok(predicate(),'Expected physical work to finish within the test bound');};
const totals=g=>Object.fromEntries(resources.map(r=>[r,g.s.stock[r]+g.s.spent[r]+g.s.deposits.filter(d=>d.kind===r).reduce((sum,d)=>sum+d.amount,0)+g.s.units.filter(u=>u.resource===r).reduce((sum,u)=>sum+u.cargo,0)]));
const custody=g=>{assert.ok(valid(g.s));for(const r of resources)assert.equal(g.stores().reduce((sum,b)=>sum+b.stock[r],0),g.s.stock[r]);};
let earned;
function expanded(){
 if(!earned){
  const g=new Camp(),ids=g.s.units.map(u=>u.id);
  for(const target of ['d0','d1','d2']){g.command(ids,{kind:'gather',target});until(g,()=>g.s.units.every(u=>u.phase==='idle'));}
  const workshop=g.build('workshop',11,15,ids);assert.ok(workshop.id);until(g,()=>g.s.buildings.find(b=>b.id===workshop.id).done);
  g.command(['u0'],{kind:'move',x:25,y:14});until(g,()=>g.s.units[0].phase==='idle');
  const outpost=g.build('outpost',23,11,ids);assert.ok(outpost.id);until(g,()=>g.s.complete);g.command(ids,{kind:'idle'});
  earned={state:JSON.parse(g.serialize()),workshop:workshop.id,outpost:outpost.id};
 }
 return{g:new Camp(earned.state),workshop:earned.workshop,outpost:earned.outpost};
}

test('fresh local custody preserves the accepted uncapped opening and item totals',()=>{
 const g=new Camp();assert.equal(g.s.version,3);assert.deepEqual(g.s.stock,{wood:20,stone:10,food:0});assert.deepEqual(g.store('b0').stock,g.s.stock);assert.deepEqual(g.economy().available,g.s.stock);
 const before=totals(g);g.command(g.s.units.map(u=>u.id),{kind:'gather',target:'d0'});until(g,()=>g.s.units.every(u=>u.phase==='idle'));
 assert.equal(g.store('b0').stock.wood,68);assert.equal(g.economy().produced.wood,48);assert.deepEqual(totals(g),before);custody(g);
});

test('completed outposts own real gathering receipts; transfers reserve, pick up and deliver one finite load per worker',()=>{
 const {g,outpost}=expanded(),before=totals(g),stock=g.s.stock.wood,source=g.store('b0').stock.wood,production=g.s.delivered.wood;
 const quote=g.quoteTransfer(['u0','u1'],'b0',outpost,'wood');assert.equal(quote.amount,10);assert.equal(quote.error,null);
 const result=g.transfer(['u0','u1'],'b0',outpost,'wood');assert.equal(result.assigned,2);assert.equal(g.s.stock.wood,stock);assert.equal(g.store('b0').reserved.wood,10);assert.equal(g.store('b0').available.wood,source-10);
 until(g,()=>g.s.units.some(u=>u.transfer));assert.ok(g.s.units.some(u=>u.cargo>0));assert.equal(g.store(outpost).stock.wood,0);assert.equal(g.s.stock.wood+g.economy().inTransit.wood,stock);custody(g);
 until(g,()=>g.s.storage.transfers.length===0);assert.equal(g.store('b0').stock.wood,source-10);assert.equal(g.store(outpost).stock.wood,10);assert.equal(g.s.stock.wood,stock);assert.equal(g.s.delivered.wood,production);assert.equal(g.economy().transferred.wood,10);assert.deepEqual(totals(g),before);custody(g);
});

test('repeated active transfer orders preserve the exact job, path, pickup reservation and receipt count',()=>{
 const {g,outpost}=expanded(),a=new Camp(JSON.parse(g.serialize())),b=new Camp(JSON.parse(g.serialize()));
 const expected=a.transfer(['u0','u1'],'b0',outpost,'wood');b.transfer(['u0','u1'],'b0',outpost,'wood');
 for(let i=0;i<500&&a.s.storage.transfers.length;i++){assert.deepEqual(b.transfer(['u0','u1'],'b0',outpost,'wood'),expected);a.tick(.1);b.tick(.1);assert.deepEqual(a.s,b.s);}
 assert.equal(a.s.storage.transfers.length,0);assert.equal(a.s.storage.transferred.wood,10);custody(a);
});

test('two groups cannot reserve or spend the same last stored items',()=>{
 const {g,outpost}=expanded(),amount=g.store('b0').stock.wood;assert.equal(amount,16);
 assert.equal(g.transfer(['u0','u1','u2'],'b0',outpost,'wood').amount,15);assert.equal(g.transfer(['u3'],'b0',outpost,'wood').amount,1);
 assert.equal(g.store('b0').available.wood,0);assert.equal(g.canPay({wood:1}),false);assert.equal(g.canPay({wood:1},'b0'),false);
 const state=g.serialize();assert.equal(g.pay({wood:1}),false);assert.equal(g.serialize(),state);
 until(g,()=>!g.s.storage.transfers.length);assert.equal(g.store(outpost).stock.wood,16);custody(g);
});

test('Stop before pickup releases only that worker allocation and prunes finished history',()=>{
 const {g,outpost}=expanded(),before=totals(g);g.transfer(['u0','u1'],'b0',outpost,'wood');g.command(['u0'],{kind:'idle'});
 assert.equal(g.store('b0').reserved.wood,5);assert.equal(g.s.storage.transfers[0].cancelled,5);assert.equal(g.s.units[0].cargo,0);
 until(g,()=>!g.s.storage.transfers.length);assert.equal(g.store(outpost).stock.wood,5);assert.equal(g.store('b0').reserved.wood,0);assert.deepEqual(totals(g),before);custody(g);
 for(let i=0;i<100;i++){g.transfer(['u0'],'b0',outpost,'wood');g.command(['u0'],{kind:'idle'});assert.equal(g.s.storage.transfers.length,0);}custody(g);
});

test('Stop after pickup keeps the load with its actor until a physical receipt without new production',()=>{
 const {g,outpost}=expanded(),before=totals(g),production={...g.s.delivered},stored={...g.s.stock};g.transfer(['u0'],'b0',outpost,'wood');until(g,()=>!!g.s.units[0].transfer);
 const u=g.s.units[0];assert.equal(u.cargo,5);g.command([u.id],{kind:'idle'});assert.equal(u.cargo,5);assert.equal(g.s.stock.wood,stored.wood-5);assert.equal(u.next.kind,'idle');
 const copy=new Camp(JSON.parse(g.serialize()));for(let i=0;i<400;i++){g.tick(.1);copy.tick(.1);}assert.deepEqual(g.s,copy.s);
 assert.equal(u.cargo,0);assert.equal(g.s.stock.wood,stored.wood);assert.deepEqual(g.s.delivered,production);assert.deepEqual(totals(g),before);custody(g);
});

test('a transfer queued behind gathered cargo preserves its origin and Stop releases its future reservation',()=>{
 const {g,outpost}=expanded();g.command(['u0'],{kind:'gather',target:'d4'});until(g,()=>g.s.units[0].cargo>0);const u=g.s.units[0],load=u.cargo,production=g.s.delivered.wood,before=totals(g);
 const assigned=g.transfer(['u0'],'b0',outpost,'stone');assert.equal(assigned.amount,5);assert.equal(u.next.kind,'transfer');assert.equal(u.transfer,undefined);assert.equal(g.store('b0').reserved.stone,5);
 custody(g);g.command(['u0'],{kind:'idle'});assert.equal(g.store('b0').reserved.stone,0);assert.equal(g.s.storage.transfers.length,0);assert.equal(u.cargo,load);
 until(g,()=>!u.cargo);assert.equal(g.s.delivered.wood,production+load);assert.deepEqual(totals(g),before);custody(g);
});

test('queued transfer returns original gathered cargo once then carries only its reserved resource',()=>{
 const {g,outpost}=expanded();g.command(['u0'],{kind:'gather',target:'d4'});until(g,()=>g.s.units[0].cargo>0);const u=g.s.units[0],load=u.cargo,production={...g.s.delivered},before=totals(g);
 g.transfer(['u0'],'b0',outpost,'stone');until(g,()=>!!u.transfer);assert.equal(u.resource,'stone');assert.equal(u.cargo,5);assert.equal(g.s.delivered.wood,production.wood+load);custody(g);
 until(g,()=>!g.s.storage.transfers.length);assert.equal(g.store(outpost).stock.stone,5);assert.equal(g.s.delivered.stone,production.stone);assert.deepEqual(totals(g),before);custody(g);
});

test('invalid transfers and invalid reassignment are atomic for existing orders and reservations',()=>{
 const {g,outpost}=expanded();g.transfer(['u0'],'b0',outpost,'wood');const state=g.serialize();
 for(const args of [[['u1'],'b0','b0','wood'],[['u1'],'missing',outpost,'wood'],[['u1'],'b0',outpost,'water'],[[],'b0',outpost,'wood'],[['u1','missing'],'b0',outpost,'wood']]){assert.ok(g.transfer(...args).error);assert.equal(g.serialize(),state);}
 for(const order of [{kind:'made-up'},{kind:'gather',target:'missing'},{kind:'move',x:18,y:2}]){assert.equal(g.command(['u0'],order),0);assert.equal(g.serialize(),state);}custody(g);
 assert.equal(g.command(['u0','missing'],{kind:'idle'}),0);assert.equal(g.serialize(),state);
});

test('recruitment spends hearth food after actual food transfer from an eastern drop-off',()=>{
 const {g,outpost}=expanded(),before=totals(g),ids=g.s.units.map(u=>u.id);g.command(ids,{kind:'gather',target:'d7'});until(g,()=>g.store(outpost).stock.food>=30);g.command(ids,{kind:'idle'});until(g,()=>g.s.units.every(u=>u.cargo===0));
 assert.equal(g.store('b0').stock.food,0);assert.match(g.train(),/food.*Hearth/);const people=g.s.units.length;
 g.transfer(ids,outpost,'b0','food');until(g,()=>!g.s.storage.transfers.length);g.transfer(['u0'],outpost,'b0','food');until(g,()=>!g.s.storage.transfers.length);
 assert.equal(g.store('b0').stock.food,25);assert.equal(g.train(),null);assert.equal(g.s.units.length,people+1);assert.equal(g.store('b0').stock.food,0);assert.deepEqual(totals(g),before);custody(g);
});

test('local crafting cannot spend a remote supply and each reservation refunds its original source',()=>{
 const {g,workshop,outpost}=expanded(),before=totals(g);g.transfer(g.s.units.map(u=>u.id),'b0',outpost,'stone');until(g,()=>!g.s.storage.transfers.length);
 assert.equal(g.knappingFunding(workshop).storeId,'b0');assert.equal(g.s.stock.stone,20);assert.match(g.beginKnapping(workshop,['u0']),/stone.*Hearth/);
 g.transfer(['u0','u1'],outpost,'b0','stone');until(g,()=>!g.s.storage.transfers.length);assert.equal(g.beginKnapping(workshop,['u0']),null);assert.equal(g.s.storage.reservations.knapping.sources.find(p=>p.resource==='stone').storeId,'b0');
 until(g,()=>g.s.tools);assert.equal(g.s.storage.reservations.knapping,undefined);assert.deepEqual(totals(g),before);custody(g);
});

test('opening construction may combine stores, while later construction names a local source and refunds exact custody',()=>{
 const {g,outpost}=expanded(),ids=g.s.units.map(u=>u.id);g.command(ids,{kind:'gather',target:'d4'});until(g,()=>g.store(outpost).stock.wood>=60);g.command(ids,{kind:'idle'});until(g,()=>g.s.units.every(u=>!u.cargo));
 const local=g.funding('workshop',26,13);assert.equal(local.mode,'local');assert.equal(local.storeId,outpost);assert.ok(local.missing.stone>0);
 // Imported pre-expansion state retains the accepted pooled funding contract.
 const legacy=JSON.parse(g.serialize());legacy.complete=false;const opening=new Camp(legacy);assert.equal(opening.funding('outpost',26,13).mode,'opening-pool');const before=opening.stores().map(b=>({id:b.id,stock:b.stock})),total=totals(opening);
 const site=opening.build('outpost',26,13,[]);assert.ok(site.id);assert.ok(opening.s.storage.reservations[site.id].sources.some(p=>p.storeId==='b0'));assert.ok(opening.s.storage.reservations[site.id].sources.some(p=>p.storeId===outpost));
 assert.equal(opening.cancel(site.id),true);assert.equal(opening.cancel(site.id),false);assert.deepEqual(opening.stores().map(b=>({id:b.id,stock:b.stock})),before);assert.deepEqual(totals(opening),total);custody(opening);
});

test('v1 and v2 migration preserves every legacy world field and the exact uncapped aggregate once',()=>{
 const base=new Camp();base.command(['u0'],{kind:'gather',target:'d0'});until(base,()=>base.s.units[0].cargo>0);
 for(const version of [1,2]){const legacy=JSON.parse(base.serialize());legacy.version=version;delete legacy.storage;if(version===1){delete legacy.tools;delete legacy.knapping;}const raw=JSON.stringify(legacy),g=new Camp(legacy);
  assert.equal(JSON.stringify(legacy),raw);assert.equal(g.s.version,3);for(const field of ['stock','spent','deposits','buildings','units','seen','time','complete'])assert.deepEqual(g.s[field],legacy[field]);assert.deepEqual(g.store('b0').stock,legacy.stock);
  const copy=new Camp(JSON.parse(g.serialize()));assert.deepEqual(copy.s,g.s);assert.deepEqual(totals(copy),totals(base));custody(copy);
 }
});

test('save/reload at reservation, pickup and receipt preserves exact obligations and progression',()=>{
 const {g,outpost}=expanded(),before=totals(g);g.transfer(['u0','u1'],'b0',outpost,'wood');const pending=new Camp(JSON.parse(g.serialize()));assert.deepEqual(pending.s,g.s);custody(pending);
 until(g,()=>g.s.units.some(u=>u.transfer));const inFlight=new Camp(JSON.parse(g.serialize()));for(let i=0;i<400;i++){g.tick(.1);inFlight.tick(.1);}assert.deepEqual(inFlight.s,g.s);assert.deepEqual(totals(g),before);
 const received=new Camp(JSON.parse(g.serialize()));steps(received,5);steps(g,5);assert.deepEqual(received.s,g.s);custody(received);
});

test('malformed v3 ownership, reservations and transfer obligations fail closed',()=>{
 const {g,outpost}=expanded();g.transfer(['u0'],'b0',outpost,'wood');
 for(const change of [s=>s.version=4,s=>s.storage.version=2,s=>s.stock.wood++,s=>delete s.storage.stores.b0,s=>s.storage.stores[outpost].stone=-1,s=>s.storage.transfers.push(structuredClone(s.storage.transfers[0])),s=>s.storage.transfers[0].remaining++,s=>s.storage.transfers[0].pending.u0=6,s=>s.storage.transfers[0].to='missing',s=>s.units[0].dropoff='missing']){
  const bad=JSON.parse(g.serialize());change(bad);assert.equal(valid(bad),false);assert.throws(()=>new Camp(bad));
 }
 const fresh=new Camp();fresh.command(fresh.s.units.map(u=>u.id),{kind:'gather',target:'d0'});until(fresh,()=>fresh.s.units.every(u=>u.phase==='idle'));fresh.command(fresh.s.units.map(u=>u.id),{kind:'gather',target:'d2'});until(fresh,()=>fresh.s.units.every(u=>u.phase==='idle'));const site=fresh.build('workshop',11,15,[]);assert.ok(site.id);
 for(const change of [s=>delete s.storage.reservations[site.id],s=>s.storage.reservations[site.id].sources[0].amount++,s=>s.spent.wood=0]){const bad=JSON.parse(fresh.serialize());change(bad);assert.equal(valid(bad),false);assert.throws(()=>new Camp(bad));}
});

test('a funded site with no reachable work edge is rejected without spending or advancing its ID',()=>{
 const g=new Camp(),ids=g.s.units.map(u=>u.id);for(const target of ['d0','d2']){g.command(ids,{kind:'gather',target});until(g,()=>g.s.units.every(u=>u.phase==='idle'));}
 // Geometry-only fixtures close the two legal sides of a corner site.
 g.s.buildings.push({id:'edge-n',kind:'workshop',x:2,y:0,done:true,work:32,cost:{}},{id:'edge-w',kind:'workshop',x:0,y:2,done:true,work:32,cost:{}});g.s.seen=Array.from({length:36*24},(_,i)=>i);
 const before=g.serialize();assert.ok(g.build('workshop',0,0,ids).error);assert.equal(g.serialize(),before);custody(g);
});

test('workshop funding searches reachable perimeter edges at the top-left map corner',()=>{
 const g=new Camp();g.s.buildings.push({id:'corner-workshop',kind:'workshop',x:0,y:0,done:true,work:32,cost:{}});const before=g.serialize(),q=g.knappingFunding('corner-workshop');assert.equal(q.storeId,'b0');assert.equal(q.error,null);assert.equal(g.serialize(),before);
});

test('uneven group allocations release exactly the stopped share and never strand the other load',()=>{
 for(const stop of ['u0','u1']){const {g,outpost}=expanded();g.transfer(['u2','u3'],'b0',outpost,'wood');until(g,()=>!g.s.storage.transfers.length);
  // Six remaining earned wood make deterministic shares of five and one.
  const before=totals(g),result=g.transfer(['u0','u1'],'b0',outpost,'wood');assert.equal(result.amount,6);assert.deepEqual(g.s.storage.transfers[0].pending,{u0:5,u1:1});
  g.command([stop],{kind:'idle'});assert.equal(g.store('b0').reserved.wood,stop==='u0'?1:5);until(g,()=>!g.s.storage.transfers.length);
  assert.equal(g.store('b0').stock.wood,stop==='u0'?5:1);assert.deepEqual(totals(g),before);custody(g);
 }
});

test('migration rejects unpaid legacy construction without mutating the legacy payload',()=>{
 for(const version of [1,2]){const legacy=JSON.parse(new Camp().serialize());legacy.version=version;delete legacy.storage;if(version===1){delete legacy.tools;delete legacy.knapping;}
  legacy.buildings.push({id:'unpaid',kind:'workshop',x:11,y:15,done:false,work:0,cost:{wood:40,stone:30}});const raw=JSON.stringify(legacy);assert.throws(()=>new Camp(legacy));assert.equal(JSON.stringify(legacy),raw);
 }
});

test('fractional legacy holdings remain owned while transfers carry only whole items',()=>{
 const {g,outpost}=expanded(),legacy=JSON.parse(g.serialize());legacy.version=2;delete legacy.storage;legacy.stock.wood=.5;const migrated=new Camp(legacy),before=migrated.serialize();
 assert.deepEqual(migrated.store('b0').stock,legacy.stock);assert.ok(migrated.transfer(['u0'],'b0',outpost,'wood').error);assert.equal(migrated.serialize(),before);custody(migrated);
 legacy.stock.wood=5.5;const funded=new Camp(legacy);assert.equal(funded.transfer(['u0'],'b0',outpost,'wood').amount,5);until(funded,()=>!funded.s.storage.transfers.length);assert.equal(funded.store('b0').stock.wood,.5);assert.equal(funded.store(outpost).stock.wood,5);custody(funded);
});

test('a transfer save cannot give the same worker held cargo and another pending allocation',()=>{
 const {g,outpost}=expanded();g.transfer(['u0'],'b0',outpost,'wood');const bad=JSON.parse(g.serialize()),j=bad.storage.transfers[0],u=bad.units[0];
 j.pending.u0=2;j.remaining=2;u.cargo=3;u.resource='wood';u.transfer=j.id;u.phase='transfer';u.dropoff=outpost;bad.storage.stores.b0.wood-=3;bad.stock.wood-=3;
 assert.equal(j.amount,5);assert.equal(j.remaining+u.cargo,j.amount);assert.equal(valid(bad),false);assert.throws(()=>new Camp(bad));
 const excessive=JSON.parse(g.serialize());excessive.storage.transfers[0].amount=6;excessive.storage.transfers[0].delivered=1;assert.equal(valid(excessive),false);
});

const closeHearthCorner=g=>g.s.buildings.push(
 {id:'corner-n',kind:'workshop',x:6,y:9,done:true,work:32,cost:{}},
 {id:'corner-w',kind:'workshop',x:4,y:10,done:true,work:32,cost:{}},
 {id:'corner-s',kind:'workshop',x:5,y:12,done:true,work:32,cost:{}}
);
test('transfer admission and pickup require a continuous actor-to-store-to-receiver path',()=>{
 const {g,outpost,workshop}=expanded();closeHearthCorner(g);const u=g.s.units[0];u.x=6;u.y=11;u.path=[];u.order={kind:'idle'};u.phase='idle';
 assert.deepEqual(g.path(u,g.around(g.s.buildings[0])),[]);const before=g.serialize();assert.ok(g.transfer(['u0'],'b0',outpost,'wood').error);assert.equal(g.serialize(),before);
 assert.match(g.beginKnapping(workshop,['u0']),/reachable path/);assert.equal(g.serialize(),before);assert.match(g.beginKnapping(workshop,['u1','u0']),/reachable path/);assert.equal(g.serialize(),before);
 g.transfer(['u1'],'b0',outpost,'wood');until(g,()=>!!g.s.units[1].transfer);assert.notDeepEqual({x:g.s.units[1].x,y:g.s.units[1].y},{x:6,y:11});until(g,()=>!g.s.storage.transfers.length);custody(g);
});

test('recruitment selects a reachable hearth edge instead of an isolated empty pocket',()=>{
 const {g,workshop}=expanded();closeHearthCorner(g);g.command(['u1'],{kind:'gather',target:'d3'});until(g,()=>g.store('b0').stock.food>=25);g.command(['u1'],{kind:'idle'});until(g,()=>!g.s.units[1].cargo);
 assert.equal(g.blocked(6,11),false);assert.equal(g.train(),null);const newcomer=g.s.units.at(-1);assert.notDeepEqual({x:newcomer.x,y:newcomer.y},{x:6,y:11});assert.ok(g.path(newcomer,g.around(g.s.buildings.find(b=>b.id===workshop))));custody(g);
});

const fundedOpening=()=>{const g=new Camp(),ids=g.s.units.map(u=>u.id);for(const target of ['d0','d2']){g.command(ids,{kind:'gather',target});until(g,()=>g.s.units.every(u=>u.phase==='idle'));}return g;};
test('one hundred paused build/cancel cycles retain bounded payment history and exact original custody',()=>{
 const g=fundedOpening(),before=totals(g),stores=g.stores(),time=g.s.time,size=g.serialize().length;
 for(let i=0;i<100;i++){const site=g.build('workshop',11,15,[]);assert.ok(site.id);assert.equal(g.s.storage.payments.length,1);assert.equal(g.cancel(site.id),true);assert.equal(g.s.storage.payments.length,0);assert.equal(Object.keys(g.s.storage.reservations).length,0);}
 assert.equal(g.s.time,time);assert.deepEqual(g.stores(),stores);assert.deepEqual(totals(g),before);assert.ok(g.serialize().length<size+80);const copy=new Camp(JSON.parse(g.serialize()));assert.deepEqual(copy.s,g.s);custody(g);
});

test('paid unfinished v1/v2 construction migrates once with exact progress and original-source refund',()=>{
 const base=fundedOpening(),stock={...base.s.stock},total=totals(base),site=base.build('workshop',11,15,['u0']);assert.ok(site.id);until(base,()=>base.s.buildings.find(b=>b.id===site.id).work>=2);
 for(const version of [1,2]){const legacy=JSON.parse(base.serialize());legacy.version=version;delete legacy.storage;if(version===1){delete legacy.tools;delete legacy.knapping;}const raw=JSON.stringify(legacy),g=new Camp(legacy);
  assert.equal(JSON.stringify(legacy),raw);assert.deepEqual(g.s.buildings,legacy.buildings);assert.deepEqual(g.s.units,legacy.units);assert.deepEqual(g.s.stock,legacy.stock);assert.deepEqual(g.s.spent,legacy.spent);assert.equal(g.s.storage.reservations[site.id].legacy,true);
  assert.equal(g.cancel(site.id),true);assert.deepEqual(g.store('b0').stock,stock);assert.deepEqual(totals(g),total);assert.equal(g.cancel(site.id),false);custody(g);
 }
});

test('paid partial v2 knapping migrates its progress and resumes without another material charge',()=>{
 const {g:base,workshop}=expanded();assert.equal(base.beginKnapping(workshop,['u0']),null);until(base,()=>base.s.knapping.work>=2);base.command(['u0'],{kind:'idle'});
 const legacy=JSON.parse(base.serialize());legacy.version=2;delete legacy.storage;const raw=JSON.stringify(legacy),g=new Camp(legacy),stock={...g.s.stock},total=totals(g);
 assert.equal(JSON.stringify(legacy),raw);assert.deepEqual(g.s.knapping,legacy.knapping);assert.deepEqual(g.s.units,legacy.units);assert.equal(g.s.storage.reservations.knapping.legacy,true);assert.equal(g.beginKnapping(workshop,['u0']),null);assert.deepEqual(g.s.stock,stock);
 until(g,()=>g.s.tools);assert.deepEqual(g.s.stock,stock);assert.deepEqual(totals(g),total);assert.equal(g.s.storage.reservations.knapping,undefined);custody(g);
});

test('construction cannot seal the final access edge of a stocked completed outpost',()=>{
 const {g,outpost}=expanded(),ids=g.s.units.map(u=>u.id);
 for(const [resource,target,amount]of [['wood','d4',50],['stone','d6',30]]){g.command(ids,{kind:'gather',target});until(g,()=>g.store(outpost).stock[resource]>=amount);g.command(ids,{kind:'idle'});until(g,()=>g.s.units.every(u=>!u.cargo));}
 g.command(ids,{kind:'move',x:12,y:13});until(g,()=>g.s.units.every(u=>u.phase==='idle'));
 // Three fixed obstacles leave the southern store edge open. A fourth would seal its actual stock.
 g.s.buildings.push({id:'seal-w',kind:'workshop',x:21,y:11,done:true,work:32,cost:{}},{id:'seal-e',kind:'workshop',x:25,y:11,done:true,work:32,cost:{}},{id:'seal-n',kind:'workshop',x:23,y:9,done:true,work:32,cost:{}});
 g.s.complete=false;assert.equal(g.placement('workshop',23,13),null);const before=g.serialize();assert.ok(g.build('workshop',23,13,[]).error);assert.equal(g.serialize(),before);assert.ok(g.store(outpost).stock.wood>=50);custody(g);
});

test('transfer cargo cannot import into a working, walking or pickup phase and change resource type',()=>{
 const {g,outpost,workshop}=expanded(),before=totals(g);g.transfer(['u0'],'b0',outpost,'wood');until(g,()=>!!g.s.units[0].transfer);
 const saved=g.serialize(),u=g.s.units[0],job=g.s.storage.transfers[0];assert.equal(u.cargo,5);assert.equal(u.resource,'wood');assert.equal(job.pending.u0,0);assert.equal(job.remaining,0);custody(g);
 for(const [phase,order]of [
  ['extract',{kind:'gather',target:'d6'}],
  ['construct',{kind:'build',target:workshop}],
  ['craft',{kind:'craft',target:workshop}],
  ['walk',{kind:'move',x:25,y:14}],
  ['pickup',{kind:'transfer',target:job.id}]
 ]){const bad=JSON.parse(saved);bad.units[0].phase=phase;bad.units[0].order=order;bad.units[0].path=[];bad.units[0].work=.6;const raw=JSON.stringify(bad);
  // In particular, the five carried wood must never enter extraction from the stone source.
  assert.deepEqual(totals({s:bad}),before);assert.equal(valid(bad),false,phase);assert.throws(()=>new Camp(bad),/compatible RTS Hearth save/);assert.equal(JSON.stringify(bad),raw);assert.equal(g.serialize(),saved);
 }
 until(g,()=>!g.s.storage.transfers.length);assert.equal(g.store(outpost).stock.wood,5);assert.deepEqual(totals(g),before);custody(g);
});

test('valid transfer cargo survives Stop, Move and Gather reassignment with typed conservation after reload',()=>{
 const {g:base,outpost}=expanded();base.transfer(['u0'],'b0',outpost,'wood');until(base,()=>!!base.s.units[0].transfer);const saved=base.serialize(),before=totals(base);
 for(const order of [{kind:'idle'},{kind:'move',x:25,y:14},{kind:'gather',target:'d6'}]){const g=new Camp(JSON.parse(saved)),u=g.s.units[0];assert.equal(g.command(['u0'],order),1);assert.equal(u.phase,'return');assert.equal(u.cargo,5);assert.equal(u.resource,'wood');assert.deepEqual(u.next,order);custody(g);
  const copy=new Camp(JSON.parse(g.serialize()));assert.deepEqual(copy.s,g.s);for(let i=0;i<500;i++){g.tick(.1);copy.tick(.1);}assert.deepEqual(copy.s,g.s);assert.deepEqual(totals(g),before);custody(g);
 }
});

test('blocked idle transfer cargo remains reloadable and can recover without loss or conversion',()=>{
 const {g,outpost}=expanded(),before=totals(g);g.transfer(['u0'],'b0',outpost,'wood');until(g,()=>!!g.s.units[0].transfer);
 // Isolate the carrier at a store edge to exercise the genuine blocked-return state.
 closeHearthCorner(g);const u=g.s.units[0];u.x=6;u.y=11;assert.equal(g.transferHome(u),false);assert.equal(u.phase,'idle');assert.deepEqual(u.path,[]);assert.equal(u.cargo,5);custody(g);
 const copy=new Camp(JSON.parse(g.serialize()));assert.equal(copy.s.units[0].phase,'idle');steps(copy,2);assert.equal(copy.s.units[0].cargo,5);assert.deepEqual(totals(copy),before);
 const malformed=JSON.parse(copy.serialize());malformed.units[0].path=[{x:6,y:11}];assert.equal(valid(malformed),false);assert.throws(()=>new Camp(malformed));
 assert.equal(copy.command(['u0'],{kind:'idle'}),1);assert.equal(copy.s.units[0].phase,'return');until(copy,()=>!copy.s.units[0].cargo);assert.equal(copy.s.storage.transfers.length,0);assert.deepEqual(totals(copy),before);custody(copy);
});
