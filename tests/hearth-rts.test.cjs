const test=require('node:test'),assert=require('node:assert/strict');
const {Camp,valid}=require('../src/hearth-rts/engine.js');
const steps=(g,n)=>{for(let i=0;i<n*10;i++)g.tick(.1);};
const totals=g=>Object.fromEntries(['wood','stone','food'].map(r=>[r,g.s.stock[r]+g.s.spent[r]+g.s.deposits.filter(d=>d.kind===r).reduce((n,d)=>n+d.amount,0)+g.s.units.filter(u=>u.resource===r).reduce((n,u)=>n+u.cargo,0)]));
test('finite deposits conserve stock, cargo and spent resources through depletion and refresh',()=>{
 const g=new Camp(),before=totals(g);g.command(g.s.units.map(u=>u.id),{kind:'gather',target:'d0'});steps(g,100);assert.equal(g.s.deposits[0].amount,0);assert.equal(g.s.stock.wood,68);assert.equal(g.s.depleted,1);assert.ok(g.s.units.every(u=>u.phase==='idle'));assert.deepEqual(totals(g),before);const copy=new Camp(JSON.parse(g.serialize()));steps(g,30);steps(copy,30);assert.deepEqual(copy.s,g.s);assert.equal(g.s.deposits[0].amount,0);assert.ok(valid(g.s));
});
test('repeated gather commands cannot accelerate extraction or teleport carried loads',()=>{
 const a=new Camp(),b=new Camp();for(const g of [a,b])g.command(['u0'],{kind:'gather',target:'d0'});for(let i=0;i<600;i++){a.tick(.1);b.command(['u0'],{kind:'gather',target:'d0'});b.tick(.1);}assert.deepEqual(b.s,a.s);
 const g=new Camp();g.command(['u0'],{kind:'gather',target:'d0'});while(!g.s.units[0].cargo)g.tick(.1);const stock=g.s.stock.wood;g.command(['u0'],{kind:'move',x:25,y:13});assert.equal(g.s.stock.wood,stock);assert.ok(g.s.units[0].cargo>0);steps(g,30);assert.ok(g.s.stock.wood>stock);assert.equal(g.s.units[0].cargo,0);assert.equal(g.s.units[0].x,25);
});
test('construction consumes its displayed cost exactly once and cancellation refunds once',()=>{
 const g=new Camp();g.command(g.s.units.map(u=>u.id),{kind:'gather',target:'d0'});steps(g,100);g.command(g.s.units.map(u=>u.id),{kind:'gather',target:'d2'});steps(g,110);const before={...g.s.stock},total=totals(g),result=g.build('outpost',11,15,['u0']);assert.ok(result.id);assert.equal(g.s.stock.wood,before.wood-60);assert.equal(g.s.stock.stone,before.stone-20);assert.deepEqual(totals(g),total);assert.ok(g.cancel(result.id));assert.deepEqual(g.s.stock,before);assert.equal(g.cancel(result.id),false);assert.deepEqual(totals(g),total);
 const site=g.build('outpost',11,15,g.s.units.map(u=>u.id));assert.ok(site.id);steps(g,30);assert.ok(g.s.buildings.find(b=>b.id===site.id).done);assert.equal(g.cancel(site.id),false);assert.deepEqual(totals(g),total);
});
test('workers path through the ford and an eastern outpost shortens return trips',()=>{
 const g=new Camp(),u=g.s.units[0],path=g.path(u,[{x:26,y:13}]);assert.ok(path.length>0);assert.ok(path.every(p=>!g.water(p.x,p.y)));assert.ok(path.some(p=>p.x===18&&p.y>=11&&p.y<=14));g.command(['u0'],{kind:'move',x:26,y:13});steps(g,30);assert.equal(u.x,26);assert.ok(g.visible(29,15));u.cargo=1;u.resource='wood';g.home(u);const original=u.path.length;g.s.buildings.push({id:'fixture-outpost',kind:'outpost',x:23,y:11,done:true,work:24,cost:{wood:60,stone:20}});g.home(u);assert.ok(u.path.length<original/2);
});
test('invalid/future saves fail closed; unknown orders and unreachable sites cannot corrupt saves',()=>{
 const g=new Camp();for(const change of [s=>s.version=4,s=>s.stock.wood=-1,s=>s.units[0].cargo=9,s=>s.deposits[0].amount=Infinity,s=>s.units[0].order={kind:'made-up'}]){const s=JSON.parse(g.serialize());change(s);assert.throws(()=>new Camp(s));}const before=g.serialize();assert.ok(g.build('outpost',18,2,['u0']).error);assert.equal(g.serialize(),before);assert.ok(valid(g.s));
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
const earnedWorkshop=()=>{const g=new Camp();g.command(g.s.units.map(u=>u.id),{kind:'gather',target:'d0'});steps(g,100);g.command(g.s.units.map(u=>u.id),{kind:'gather',target:'d2'});steps(g,100);const b=g.build('workshop',11,15,g.s.units.map(u=>u.id));assert.ok(b.id);steps(g,35);return {g,id:b.id};};
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
 const g=new Camp();g.command(['u0'],{kind:'gather',target:'d0'});while(!g.s.units[0].cargo)g.tick(.1);const old=JSON.parse(g.serialize());old.version=1;delete old.tools;delete old.knapping;delete old.storage;const raw=JSON.stringify(old),migrated=new Camp(old);assert.equal(JSON.stringify(old),raw);assert.equal(migrated.s.version,3);assert.equal(migrated.s.tools,false);assert.equal(migrated.s.knapping,null);for(const field of ['stock','spent','deposits','buildings','units','seen'])assert.deepEqual(migrated.s[field],old[field]);assert.ok(valid(migrated.s));const future={...migrated.s,version:4};assert.throws(()=>new Camp(future));
});
