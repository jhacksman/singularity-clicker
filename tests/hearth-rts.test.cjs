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
 const g=new Camp();for(const change of [s=>s.version=2,s=>s.stock.wood=-1,s=>s.units[0].cargo=9,s=>s.deposits[0].amount=Infinity,s=>s.units[0].order={kind:'made-up'}]){const s=JSON.parse(g.serialize());change(s);assert.throws(()=>new Camp(s));}const before=g.serialize();assert.ok(g.build('outpost',18,2,['u0']).error);assert.equal(g.serialize(),before);assert.ok(valid(g.s));
});
