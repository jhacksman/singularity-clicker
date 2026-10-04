const test=require('node:test'),assert=require('node:assert/strict');
const {Camp,valid}=require('../src/hearth-rts/engine.js');
const snapshot=g=>JSON.parse(g.serialize()),ids=g=>g.s.units.map(u=>u.id);
const totals=g=>Object.fromEntries(['wood','stone','food'].map(r=>[r,g.s.stock[r]+g.s.spent[r]+g.s.deposits.filter(d=>d.kind===r).reduce((n,d)=>n+d.amount,0)+g.s.units.filter(u=>u.resource===r).reduce((n,u)=>n+u.cargo,0)+(g.s.construction?.sites||[]).reduce((n,c)=>n+c.staged[r],0)]));
const check=g=>{assert.ok(valid(g.s));for(const j of g.s.storage.transfers)assert.equal(j.amount,j.remaining+j.delivered+j.recovered+j.cancelled+g.s.units.filter(u=>u.transfer===j.id).reduce((n,u)=>n+u.cargo,0));};
const steps=(g,n)=>{for(let i=0;i<n*10;i++){g.tick(.1);check(g);}};
const until=(g,p,n=180)=>{for(let i=0;i<n*10&&!p();i++){g.tick(.1);check(g);}assert.ok(p(),'Expected physical transition within bound');};
let v3;
function oldAPI(){if(!v3){const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),source=fs.readFileSync(path.join(__dirname,'fixtures/hearth-rts-engine-v3.txt'),'utf8');assert.equal(crypto.createHash('sha256').update(source).digest('hex'),'3b22d81b32f01f44fc033c488e68a91c027889780f82db380ea899f837f20be4');const context={module:{exports:{}},structuredClone};vm.runInNewContext(source,context,{filename:'pinned-hearth-rts-3b15d608-v3.js'});v3=context.module.exports;}return v3;}
function gathered(amount=1,Type=Camp){const g=new Type();g.command(['u0'],{kind:'gather',target:'d0'});until(g,()=>g.s.units[0].cargo===amount);if(amount<5)g.tick(.1);return g;}
const expansion={};
function expanded(legacy=false){const key=legacy?'v3':'v5';if(!expansion[key]){const g=new (legacy?oldAPI().Camp:Camp)();for(const target of ['d0','d1','d2']){g.command(ids(g),{kind:'gather',target});until(g,()=>g.s.units.every(u=>u.phase==='idle'));}const workshop=g.build('workshop',11,15,ids(g));assert.ok(workshop.id);until(g,()=>g.s.buildings.find(b=>b.id===workshop.id).done);g.command(['u0'],{kind:'move',x:25,y:14});until(g,()=>g.s.units[0].phase==='idle');const outpost=g.build('outpost',23,11,ids(g));assert.ok(outpost.id);until(g,()=>g.s.complete);g.command(ids(g),{kind:'idle'});expansion[key]={state:snapshot(g),outpost:outpost.id,workshop:workshop.id};}const saved=expansion[key];return{g:new (legacy?oldAPI().Camp:Camp)(saved.state),outpost:saved.outpost,workshop:saved.workshop};}
function carriedTransfer(){const {g,outpost,workshop}=expanded();g.transfer(['u0'],'b0',outpost,'wood');until(g,()=>!!g.s.units[0].transfer);return{g,outpost,workshop};}
function held(g,x,y){assert.equal(g.command(['u0'],{kind:'move',x,y}),1);until(g,()=>g.s.units[0].phase==='idle');assert.equal(g.s.units[0].x,x);assert.equal(g.s.units[0].y,y);}

test('partial and full gathered loads move on the next tick, preserving work, then hold beside storage',()=>{
 for(const amount of [1,5]){const g=gathered(amount),u=g.s.units[0],before=totals(g),stock={...g.s.stock},produced={...g.s.delivered},work=u.work,pos={x:u.x,y:u.y};
  assert.equal(g.command(['u0'],{kind:'move',x:10,y:12}),1);assert.equal(u.phase,'carryMove');assert.equal(u.cargo,amount);assert.equal(u.work,work);assert.equal(u.next,null);assert.equal(u.dropoff,undefined);assert.deepEqual({x:u.x,y:u.y},pos);check(g);
  g.tick(.1);assert.ok(Math.hypot(u.x-pos.x,u.y-pos.y)>0);assert.ok(Math.hypot(u.x-pos.x,u.y-pos.y)<=.3+1e-12);assert.equal(u.cargo,amount);assert.equal(u.work,work);assert.deepEqual(g.s.stock,stock);assert.deepEqual(g.s.delivered,produced);check(g);
  until(g,()=>u.phase==='idle');assert.deepEqual(u.order,{kind:'idle'});assert.equal(u.x,10);assert.equal(u.y,12);steps(g,10);assert.equal(u.cargo,amount);assert.equal(u.work,work);assert.deepEqual(g.s.stock,stock);assert.deepEqual(g.s.delivered,produced);assert.deepEqual(totals(g),before);
  const copy=new Camp(snapshot(g));assert.deepEqual(copy.s,g.s);assert.equal(copy.command(['u0'],{kind:'idle'}),1);until(copy,()=>!copy.s.units[0].cargo);assert.equal(copy.s.delivered.wood,produced.wood+amount);steps(copy,5);assert.equal(copy.s.units[0].order.kind,'idle');assert.deepEqual(totals(copy),before);
 }
});

test('loaded transfer Move holds original custody beside receiver until explicit Stop receipt',()=>{
 const {g,outpost}=carriedTransfer(),u=g.s.units[0],before=totals(g),production={...g.s.delivered},stock={...g.s.stock},job=u.transfer,work=u.work;
 held(g,23,13);assert.equal(u.transfer,job);assert.equal(u.cargo,5);assert.equal(u.work,work);assert.equal(u.dropoff,undefined);assert.equal(g.store(outpost).incoming.wood,0);steps(g,10);assert.deepEqual(g.s.stock,stock);assert.equal(g.s.storage.transferred.wood,0);
 const raw=g.serialize();assert.equal(g.transfer(['u0'],'b0',outpost,'wood').id,job);assert.equal(g.serialize(),raw);assert.equal(g.command(['u0'],{kind:'idle'}),1);until(g,()=>!u.cargo);assert.equal(g.store(outpost).stock.wood,5);assert.equal(g.s.storage.transferred.wood,5);assert.deepEqual(g.s.delivered,production);assert.deepEqual(totals(g),before);assert.equal(g.s.storage.transfers.length,0);steps(g,10);assert.equal(u.order.kind,'idle');
});

test('Stop during loaded Move recovers a transfer at nearest hearth without production or stale Move replay',()=>{
 const {g,outpost}=carriedTransfer(),u=g.s.units[0],before=totals(g),production={...g.s.delivered},stock=g.store('b0').stock.wood,job=u.transfer,work=u.work,home=g.s.buildings.find(b=>b.id==='b0'),edge=g.around(home).find(p=>Math.hypot(p.x-u.x,p.y-u.y)<.001);assert.ok(edge);
 assert.equal(g.command(['u0'],{kind:'move',x:14,y:8}),1);g.tick(.1);const pos={x:u.x,y:u.y};assert.ok(Math.hypot(u.x-edge.x,u.y-edge.y)>.29);assert.ok(Math.hypot(u.x-edge.x,u.y-edge.y)<=.3+1e-12);assert.deepEqual(g.path(u,g.freeTargets(u,g.around(home))),[]);
 assert.equal(g.command(['u0'],{kind:'idle'}),1);assert.deepEqual({x:u.x,y:u.y},pos);assert.equal(u.order.kind,'idle');assert.equal(u.phase,'return');assert.equal(u.cargo,5);assert.equal(u.resource,'wood');assert.equal(u.transfer,job);assert.equal(u.work,work);assert.equal(u.dropoff,'b0');assert.deepEqual(u.path,[edge]);assert.equal(g.store('b0').stock.wood,stock);check(g);
 const paused=g.serialize();assert.equal(g.command(['u0'],{kind:'idle'}),0);assert.equal(g.serialize(),paused);for(let i=0;i<3;i++)assert.equal(new Camp(JSON.parse(paused)).serialize(),paused);
 let copy=new Camp(snapshot(g));g.tick(.05);copy.tick(.05);assert.deepEqual(copy.s,g.s);assert.ok(Math.hypot(u.x-pos.x,u.y-pos.y)>0);assert.ok(Math.hypot(u.x-pos.x,u.y-pos.y)<=.15+1e-12);assert.ok(Math.hypot(u.x-edge.x,u.y-edge.y)<Math.hypot(pos.x-edge.x,pos.y-edge.y));assert.equal(u.cargo,5);assert.equal(u.transfer,job);assert.equal(u.work,work);assert.equal(g.store('b0').stock.wood,stock);check(g);
 let receipts=0,lastStock=stock;for(let i=0;i<300;i++){g.tick(.1);copy.tick(.1);check(g);assert.deepEqual(copy.s,g.s);copy=new Camp(snapshot(copy));const current=g.store('b0').stock.wood;if(current!==lastStock){receipts++;assert.equal(current-lastStock,5);assert.ok(g.around(home).some(p=>Math.hypot(p.x-u.x,p.y-u.y)<.001));}lastStock=current;assert.deepEqual(totals(g),before);}
 assert.equal(receipts,1);assert.equal(g.store('b0').stock.wood,stock+5);assert.equal(u.cargo,0);assert.equal(u.transfer,undefined);assert.equal(u.order.kind,'idle');assert.equal(u.next,null);assert.notDeepEqual({x:u.x,y:u.y},{x:14,y:8});assert.equal(g.store(outpost).stock.wood,0);assert.equal(g.s.storage.transferred.wood,0);assert.deepEqual(g.s.delivered,production);assert.equal(g.s.storage.transfers.length,0);
});

test('isolated old rounded-home control strands the same earned fractional transfer load',()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),source=fs.readFileSync(path.join(__dirname,'../src/hearth-rts/engine.js'),'utf8'),fixed='u.path=this.approachPath(u,choices[0].path)';assert.equal(source.split(fixed).length,2);const context={module:{exports:{}},structuredClone};vm.runInNewContext(source.replace(fixed,'u.path=choices[0].path'),context,{filename:'isolated-old-rounded-home-control.js'});
 const {g}=carriedTransfer();g.command(['u0'],{kind:'move',x:14,y:8});g.tick(.1);const state=snapshot(g),raw=JSON.stringify(state),old=new context.module.exports.Camp(state),before=totals(g),stock=g.store('b0').stock.wood,pos={x:old.s.units[0].x,y:old.s.units[0].y};assert.equal(JSON.stringify(state),raw);
 assert.equal(old.command(['u0'],{kind:'idle'}),1);assert.equal(old.s.units[0].path.length,0);assert.equal(g.command(['u0'],{kind:'idle'}),1);assert.equal(g.s.units[0].path.length,1);
 for(let i=0;i<30;i++){old.tick(.1);g.tick(.1);check(old);check(g);assert.deepEqual({x:old.s.units[0].x,y:old.s.units[0].y},pos);assert.equal(old.s.units[0].cargo,5);assert.equal(old.store('b0').stock.wood,stock);assert.deepEqual(totals(old),before);}
 assert.equal(g.s.units[0].cargo,0);assert.equal(g.store('b0').stock.wood,stock+5);assert.deepEqual(totals(g),before);assert.equal(old.s.units[0].phase,'return');assert.ok(old.s.units[0].transfer);
});

test('automatic transfer rerouting near its receiver keeps a physical final approach',()=>{
 const {g,outpost}=carriedTransfer(),u=g.s.units[0],before=totals(g),produced={...g.s.delivered},job=u.transfer;
 until(g,()=>u.phase==='transfer'&&u.path.length===1&&Math.hypot(u.x-u.path[0].x,u.y-u.path[0].y)>.01&&Math.hypot(u.x-u.path[0].x,u.y-u.path[0].y)<.4);const edge={...u.path[0]},pos={x:u.x,y:u.y},receiver=g.s.buildings.find(b=>b.id===outpost);assert.deepEqual(g.path(u,g.freeTargets(u,g.around(receiver))),[]);
 // Construction rerouting calls this same helper while a transfer is in motion.
 assert.equal(g.transferHome(u),true);assert.deepEqual({x:u.x,y:u.y},pos);assert.deepEqual(u.path,[edge]);assert.equal(u.transfer,job);assert.equal(u.cargo,5);assert.equal(g.store(outpost).stock.wood,0);check(g);
 g.tick(.01);assert.ok(Math.hypot(u.x-pos.x,u.y-pos.y)>0);assert.ok(Math.hypot(u.x-pos.x,u.y-pos.y)<=.03+1e-12);assert.equal(u.cargo,5);assert.equal(g.store(outpost).stock.wood,0);until(g,()=>!u.cargo);assert.equal(g.store(outpost).stock.wood,5);assert.equal(g.s.storage.transferred.wood,5);assert.deepEqual(g.s.delivered,produced);assert.deepEqual(totals(g),before);steps(g,5);assert.equal(g.store(outpost).stock.wood,5);
});

test('work reassignment after loaded Move still returns first and cannot replay the replaced Move',()=>{
 const {g}=carriedTransfer(),u=g.s.units[0],before=totals(g);held(g,14,8);assert.equal(g.command(['u0'],{kind:'gather',target:'d6'}),1);assert.equal(u.order.kind,'idle');assert.deepEqual(u.next,{kind:'gather',target:'d6'});assert.equal(u.phase,'return');assert.equal(u.cargo,5);until(g,()=>!u.transfer);assert.equal(u.order.kind,'gather');assert.equal(u.cargo,0);assert.equal(u.resource,null);until(g,()=>u.cargo>0);assert.equal(u.resource,'stone');assert.deepEqual(totals(g),before);
});

test('Move releases only its pending share of an uneven group before pickup',()=>{
 for(const leaving of ['u0','u1']){const {g,outpost}=expanded();g.transfer(['u2','u3'],'b0',outpost,'wood');until(g,()=>!g.s.storage.transfers.length);const stock=g.s.stock.wood,before=totals(g);g.transfer(['u0','u1'],'b0',outpost,'wood');assert.deepEqual(g.s.storage.transfers[0].pending,{u0:5,u1:1});g.command([leaving],{kind:'move',x:14,y:8});assert.equal(g.s.stock.wood,stock);assert.equal(g.store('b0').reserved.wood,leaving==='u0'?1:5);assert.equal(g.s.units.find(u=>u.id===leaving).cargo,0);until(g,()=>!g.s.storage.transfers.length);assert.equal(g.store('b0').stock.wood,leaving==='u0'?5:1);assert.deepEqual(totals(g),before);}
});

test('a loaded actor can leave a transfer while a peer retains its unpicked allocation',()=>{
 const {g,outpost}=expanded();g.command(['u0'],{kind:'move',x:10,y:12});until(g,()=>g.s.units[0].phase==='idle');g.transfer(['u0','u1'],'b0',outpost,'wood');until(g,()=>!!g.s.units[0].transfer);const j=g.s.storage.transfers[0],before=totals(g);assert.equal(j.pending.u1,5);g.command(['u0'],{kind:'move',x:14,y:8});assert.equal(j.pending.u1,5);assert.equal(j.cancelled,0);assert.equal(j.remaining,5);until(g,()=>j.delivered===5);assert.equal(g.s.units[0].cargo,5);assert.equal(g.s.units[0].transfer,j.id);assert.equal(j.remaining,0);assert.equal(g.store(outpost).stock.wood,5);assert.deepEqual(totals(g),before);check(g);
});

test('Move cancels a queued transfer behind gathered cargo without changing the gathered resource',()=>{
 const {g,outpost}=expanded();g.command(['u0'],{kind:'gather',target:'d4'});until(g,()=>g.s.units[0].cargo>0);const u=g.s.units[0],before=totals(g),load=u.cargo,available=g.store('b0').available.stone;g.transfer(['u0'],'b0',outpost,'stone');assert.equal(g.store('b0').reserved.stone,5);assert.equal(u.next.kind,'transfer');g.command(['u0'],{kind:'move',x:25,y:14});assert.equal(g.store('b0').available.stone,available);assert.equal(g.s.storage.transfers.length,0);assert.equal(u.transfer,undefined);assert.equal(u.resource,'wood');assert.equal(u.cargo,load);assert.equal(u.next,null);until(g,()=>u.phase==='idle');assert.deepEqual(totals(g),before);
});

test('active repeated Move is identical to one command while a different Move redirects mid-segment',()=>{
 const a=gathered(),b=new Camp(snapshot(a)),order={kind:'move',x:14,y:8};a.command(['u0'],order);b.command(['u0'],order);while(a.s.units[0].phase==='carryMove'){const raw=b.serialize();assert.equal(b.command(['u0'],order),0);assert.equal(b.serialize(),raw);a.tick(.1);b.tick(.1);check(a);assert.deepEqual(b.s,a.s);}
 const g=gathered(),u=g.s.units[0],before=totals(g),work=u.work;g.command(['u0'],order);g.tick(.1);const pos={x:u.x,y:u.y};assert.equal(g.command(['u0'],{kind:'move',x:4,y:15}),1);assert.deepEqual({x:u.x,y:u.y},pos);assert.equal(u.dropoff,undefined);assert.equal(u.work,work);g.tick(.1);assert.ok(Math.hypot(u.x-pos.x,u.y-pos.y)>0);assert.ok(Math.hypot(u.x-pos.x,u.y-pos.y)<=.3+1e-12);until(g,()=>u.phase==='idle');assert.equal(u.x,4);assert.equal(u.y,15);assert.deepEqual(totals(g),before);
});

test('a new Move overrides an identical queued v3 Move while migration itself preserves the old return plan',()=>{
 const old=gathered(1,oldAPI().Camp),target={kind:'move',x:14,y:8};old.command(['u0'],target);assert.equal(old.s.units[0].phase,'return');assert.deepEqual(old.s.units[0].next,target);const raw=old.serialize(),state=JSON.parse(raw),g=new Camp(state),{reclaim,construction,...gameplay}=snapshot(g);assert.deepEqual(gameplay,{...state,version:6});assert.deepEqual(construction,{profile:'accepted-opening.physical-construction.v1',sites:[]});assert.equal(old.serialize(),raw);
 assert.match(reclaim.sourceIdentity,/^canonical-v3-snapshot-[0-9a-f]{8}$/);assert.deepEqual(reclaim,{profile:'accepted-opening.outpost-reclaim.v1',sourceIdentity:reclaim.sourceIdentity,claims:[],recovered:{wood:0,stone:0,food:0},settled:{wood:0,stone:0,food:0},settledSites:0,closedPayments:0});
 assert.equal(g.command(['u0'],target),1);assert.equal(g.s.units[0].phase,'carryMove');assert.equal(g.s.units[0].next,null);assert.equal(g.s.units[0].dropoff,undefined);const pos={x:g.s.units[0].x,y:g.s.units[0].y};g.tick(.1);assert.ok(Math.hypot(g.s.units[0].x-pos.x,g.s.units[0].y-pos.y)>0);assert.equal(g.s.units[0].cargo,state.units[0].cargo);check(g);
});

test('fractional same-rounded-cell and zero-distance Moves reach their exact destination without early arrival',()=>{
 for(const dt of [.1,.2]){const g=gathered(),u=g.s.units[0],x=u.x,y=u.y;assert.ok(!g.blocked(x+1,y));g.command(['u0'],{kind:'move',x:x+1,y});g.tick(dt);const target={kind:'move',x:Math.round(u.x),y:Math.round(u.y)},before={x:u.x,y:u.y};assert.notEqual(u.x,target.x);g.command(['u0'],target);assert.deepEqual(u.path,[{x:target.x,y:target.y}]);check(g);g.tick(.01);assert.ok(Math.hypot(u.x-before.x,u.y-before.y)<=.03+1e-12);until(g,()=>u.phase==='idle');assert.equal(u.x,target.x);assert.equal(u.y,target.y);const work=u.work,cargo=u.cargo;g.command(['u0'],target);assert.deepEqual(u.path,[]);check(g);g.tick(.1);assert.equal(u.phase,'idle');assert.equal(u.work,work);assert.equal(u.cargo,cargo);}
});

test('near-final-node movement uses its exact tick budget and every arrival boundary roundtrips',()=>{
 const g=gathered(),u=g.s.units[0],target={kind:'move',x:u.x+1,y:u.y};g.command(['u0'],target);g.tick(.333332);assert.equal(u.path.length,1);assert.ok(u.x<target.x);check(g);const copy=new Camp(snapshot(g));g.tick(.1);copy.tick(.1);assert.deepEqual(copy.s,g.s);assert.equal(u.x,target.x);assert.equal(u.path.length,0);assert.equal(u.phase,'carryMove');check(g);const arrived=new Camp(snapshot(g));g.tick(.1);arrived.tick(.1);assert.deepEqual(arrived.s,g.s);assert.equal(u.phase,'idle');
});

test('rejected Move commands preserve complete pending, carried, moving and held state',()=>{
 const samples=[gathered(),carriedTransfer().g];const pending=expanded();pending.g.transfer(['u0'], 'b0',pending.outpost,'wood');samples.push(pending.g);const moving=gathered();moving.command(['u0'],{kind:'move',x:14,y:8});moving.tick(.1);samples.push(moving);const holding=gathered();held(holding,14,8);samples.push(holding);
 for(const g of samples){const before=g.serialize();for(const order of [{kind:'move',x:18,y:2},{kind:'move',x:40,y:2},{kind:'move',x:10.5,y:8},{kind:'move',x:7,y:11}]){assert.equal(g.command(['u0','u1'],order),0);assert.equal(g.serialize(),before);}assert.equal(g.command(['u0','missing'],{kind:'move',x:14,y:8}),0);assert.equal(g.serialize(),before);}
});

test('a valid Move target reachable by only one selected actor rejects the whole group atomically',()=>{
 const {g,outpost}=expanded();g.transfer(['u0'],'b0',outpost,'wood');const target={kind:'move',x:14,y:8},trapped=g.s.units[1];trapped.x=2;trapped.y=2;
 // Uncertified v4 route control: fake IDs and zero-cost blockers are not canonical capital.
 g.s.version=4;delete g.s.reclaim;
 // Controlled disconnected-component fixture; normal construction refuses this enclosure.
 for(const [id,x,y]of [['west',0,2],['east',3,2],['north',1,0],['south',1,3]])g.s.buildings.push({id:'group-isolated-'+id,kind:'workshop',x,y,done:true,work:32,cost:{}});
 assert.equal(g.blocked(target.x,target.y),false);assert.ok(g.path(g.s.units[0],[target]));assert.equal(g.path(trapped,[target]),null);assert.equal(g.store('b0').reserved.wood,5);check(g);const before=g.serialize();assert.equal(g.command(['u0','u1'],target),0);assert.equal(g.serialize(),before);assert.equal(g.s.storage.transfers[0].pending.u0,5);assert.equal(g.store('b0').reserved.wood,5);
});

function fundedCarrier(){const g=new Camp();for(const target of ['d0','d2']){g.command(ids(g),{kind:'gather',target});until(g,()=>g.s.units.every(u=>u.phase==='idle'));}g.command(['u0'],{kind:'gather',target:'d1'});until(g,()=>g.s.units[0].cargo>0);g.tick(.1);return g;}
test('new construction reroutes manual cargo toward the same target without a home detour',()=>{
 const g=fundedCarrier(),u=g.s.units[0],target={kind:'move',x:15,y:17},work=u.work,before=totals(g);g.command(['u0'],target);const path=structuredClone(u.path);let built;
 for(const p of path){if(Math.hypot(p.x-u.x,p.y-u.y)<3||Math.hypot(p.x-target.x,p.y-target.y)<3||g.placement('workshop',p.x,p.y))continue;const result=g.build('workshop',p.x,p.y,[]);if(result.id){built=g.s.buildings.find(b=>b.id===result.id);break;}}
 assert.ok(built,'An earned funded structure must intersect the old route');assert.equal(u.phase,'carryMove');assert.deepEqual(u.order,target);assert.equal(u.work,work);assert.equal(u.dropoff,undefined);assert.ok(u.path.every(p=>!(p.x>=built.x&&p.x<built.x+2&&p.y>=built.y&&p.y<built.y+2)));assert.notDeepEqual(u.path,path);until(g,()=>u.phase==='idle');assert.equal(u.x,target.x);assert.equal(u.y,target.y);assert.ok(u.cargo>0);assert.deepEqual(totals(g),before);
});

test('a building over the Move target creates reloadable holding and cancellation never resumes it',()=>{
 const g=fundedCarrier(),u=g.s.units[0],target={kind:'move',x:11,y:15},before=totals(g),work=u.work;g.command(['u0'],target);const site=g.build('workshop',11,15,[]);assert.ok(site.id);assert.equal(u.phase,'idle');assert.deepEqual(u.order,target);assert.deepEqual(u.path,[]);assert.equal(u.work,work);assert.equal(u.dropoff,undefined);check(g);const copy=new Camp(snapshot(g));assert.deepEqual(copy.s,g.s);const pos={x:u.x,y:u.y};assert.equal(g.cancel(site.id),true);steps(g,10);assert.deepEqual({x:u.x,y:u.y},pos);assert.equal(u.phase,'idle');assert.equal(u.work,work);assert.ok(u.cargo>0);assert.deepEqual(totals(g),before);g.command(['u0'],{kind:'idle'});until(g,()=>!u.cargo);steps(g,5);assert.notDeepEqual({x:u.x,y:u.y},{x:11,y:15});
});

test('delivered construction and paid knapping progress remain at their jobs when their workers Move',()=>{
 const g=fundedCarrier();g.command(['u0'],{kind:'idle'});until(g,()=>!g.s.units[0].cargo);const site=g.build('workshop',11,15,['u1']);assert.ok(site.id);const b=g.s.buildings.find(b=>b.id===site.id);until(g,()=>b.work>=2,400);const work=b.work,supplies=structuredClone(g.s.construction.sites.find(c=>c.buildingId===site.id));assert.deepEqual(supplies.staged,{wood:40,stone:30,food:0});g.command(['u1'],{kind:'move',x:14,y:8});steps(g,3);assert.equal(b.work,work);assert.deepEqual(g.s.construction.sites.find(c=>c.buildingId===site.id),supplies);g.command(['u1'],{kind:'build',target:site.id});until(g,()=>b.done);assert.equal(g.beginKnapping(site.id,['u1']),null);until(g,()=>g.s.knapping.work>=2);const craftWork=g.s.knapping.work,paid=structuredClone(g.s.storage.reservations.knapping);g.command(['u1'],{kind:'move',x:14,y:8});steps(g,3);assert.equal(g.s.knapping.work,craftWork);assert.deepEqual(g.s.storage.reservations.knapping,paid);
});

test('active loaded Move rejects forged working states, disconnected paths, bad targets and false custody',()=>{
 const {g}=carriedTransfer();g.command(['u0'],{kind:'move',x:14,y:8});const original=snapshot(g);check(g);
 const changes=[s=>s.units[0].order={kind:'gather',target:'d6'},s=>s.units[0].next={kind:'idle'},s=>s.units[0].dropoff='b0',s=>s.units[0].cargo=0,s=>s.units[0].resource='stone',s=>s.units[0].path=[],s=>s.units[0].path[0].x+=.5,s=>s.units[0].path.at(-1).y++,s=>s.units[0].path=[{x:18,y:2},{x:14,y:8}],s=>s.units[0].path=[{x:14,y:8}],s=>{s.units[0].path.splice(1,0,{x:3,y:3});},s=>{s.units[0].x=17;s.units[0].y=2;s.units[0].order={kind:'move',x:21,y:2};s.units[0].path=[{x:21,y:2}];},s=>s.storage.transfers[0].pending.u0=1];
 for(const phase of ['walk','extract','construct','craft','pickup'])changes.push(s=>s.units[0].phase=phase);
 for(const change of changes){const bad=structuredClone(original);change(bad);assert.equal(valid(bad),false);assert.throws(()=>new Camp(bad));}assert.deepEqual(snapshot(g),original);
});

test('v3 migration preserves local custody and active paid jobs while certifying old capital',()=>{
 const {g:old,outpost,workshop}=expanded(true);for(const [resource,target,amount]of [['wood','d4',40],['stone','d6',30]]){old.command(ids(old),{kind:'gather',target});until(old,()=>old.store(outpost).stock[resource]>=amount);old.command(ids(old),{kind:'idle'});until(old,()=>old.s.units.every(u=>!u.cargo));}
 const site=old.build('workshop',26,13,['u2']);assert.ok(site.id);until(old,()=>old.s.buildings.find(b=>b.id===site.id).work>=2);old.command(['u2'],{kind:'idle'});assert.equal(old.beginKnapping(workshop,['u3']),null);until(old,()=>old.s.knapping.work>=2);old.command(['u3'],{kind:'idle'});
 old.command(['u0'],{kind:'move',x:10,y:12});until(old,()=>old.s.units[0].phase==='idle');old.transfer(['u0','u1'],'b0',outpost,'stone');until(old,()=>!!old.s.units[0].transfer);assert.equal(old.s.storage.transfers[0].pending.u1,5);const state=snapshot(old),raw=JSON.stringify(state),g=new Camp(state),{reclaim,construction,...gameplay}=snapshot(g);
 const activePayments=state.storage.payments.filter(p=>p.kind==='construction'&&p.target===site.id||p.kind==='knapping');assert.equal(activePayments.length,2);assert.equal(state.storage.payments.length,4);
 const preservedStorage={...state.storage,payments:activePayments};assert.deepEqual(gameplay,{...state,version:6,storage:preservedStorage});assert.deepEqual(construction,{profile:'accepted-opening.physical-construction.v1',sites:[]});assert.deepEqual(g.s.storage,preservedStorage);assert.equal(JSON.stringify(state),raw);assert.equal(g.s.storage.version,1);assert.equal(g.s.storage.reservations[site.id].sources[0].storeId,outpost);assert.ok(g.s.storage.reservations.knapping);
 assert.match(reclaim.sourceIdentity,/^canonical-v3-snapshot-[0-9a-f]{8}$/);assert.deepEqual(reclaim,{profile:'accepted-opening.outpost-reclaim.v1',sourceIdentity:reclaim.sourceIdentity,claims:[{id:outpost,buildingId:outpost,unreleased:{wood:60,stone:20,food:0},receipted:{wood:0,stone:0,food:0},assigned:[],basis:{rule:'legacy-state-consistency',origin:'recorded-payment',sourceIdentity:reclaim.sourceIdentity,recipe:'accepted-opening.outpost-reclaim.v1'},origin:[{storeId:'b0',resource:'wood',amount:60,kind:'hearth',x:7,y:11},{storeId:'b0',resource:'stone',amount:20,kind:'hearth',x:7,y:11}]}],recovered:{wood:0,stone:0,food:0},settled:{wood:0,stone:0,food:0},settledSites:0,closedPayments:2});
 for(const current of [new Camp(),g,gathered()]){assert.equal(oldAPI().valid(current.s),false);assert.throws(()=>new (oldAPI().Camp)(snapshot(current)));const future=snapshot(current);future.version=7;assert.equal(valid(future),false);assert.throws(()=>new Camp(future));}
});

test('loaded Move and hold preserve exact every-tick reload continuation and typed totals',()=>{
 for(const base of [gathered(),carriedTransfer().g]){const before=totals(base);base.command(['u0'],{kind:'move',x:14,y:8});let resumed=new Camp(snapshot(base));for(let i=0;i<300;i++){base.tick(.1);resumed.tick(.1);check(base);assert.deepEqual(totals(base),before);assert.deepEqual(resumed.s,base.s);resumed=new Camp(snapshot(resumed));}assert.equal(base.s.units[0].phase,'idle');assert.ok(base.s.units[0].cargo>0);const paused=base.serialize();for(let i=0;i<10;i++)assert.equal(new Camp(JSON.parse(paused)).serialize(),paused);}
});

test('Stop with unreachable storage holds a moved transfer load safely until a reachable return is requested',()=>{
 const {g}=carriedTransfer(),before=totals(g);held(g,2,2);const u=g.s.units[0],job=u.transfer;
 // Uncertified v4 route control: fake IDs and zero-cost blockers are not canonical capital.
 g.s.version=4;delete g.s.reclaim;
 // Controlled unavailable-route fixture; ordinary construction separately rejects trapping actors.
 for(const [id,x,y]of [['west',0,2],['east',3,2],['north',1,0],['south',1,3]])g.s.buildings.push({id:'isolated-'+id,kind:'workshop',x,y,done:true,work:32,cost:{}});
 assert.equal(g.command(['u0'],{kind:'idle'}),1);assert.equal(u.phase,'idle');assert.deepEqual(u.path,[]);assert.equal(u.cargo,5);assert.equal(u.transfer,job);check(g);const copy=new Camp(snapshot(g));steps(copy,10);assert.equal(copy.s.units[0].cargo,5);assert.equal(copy.s.units[0].transfer,job);assert.deepEqual(totals(copy),before);
 copy.s.buildings=copy.s.buildings.filter(b=>!b.id.startsWith('isolated-'));assert.equal(copy.command(['u0'],{kind:'idle'}),1);until(copy,()=>!copy.s.units[0].cargo);assert.deepEqual(totals(copy),before);assert.equal(copy.s.storage.transfers.length,0);
});
