const test=require('node:test');
const assert=require('node:assert/strict');
const {Hearth,TECH,valid}=require('../src/hearth/engine.js');
const steps=(g,n)=>{for(let i=0;i<n;i++)g.tick(1);};
test('autonomous workers return loads and serialized progress round trips',()=>{
 const g=new Hearth();g.assign([0],'wood');g.assign([1],'food');g.assign([2],'water');g.assign([3],'stone');steps(g,240);
 assert.ok(g.s.stats.wood>0);assert.ok(g.s.stats.food>0);assert.ok(g.s.stats.stone>0);assert.ok(g.s.knowledge>0);assert.ok(valid(g.s));assert.deepEqual(new Hearth(JSON.parse(g.serialize())).s,g.s);
});
test('empty supplies preserve people and always permit a normal neighboring migration',()=>{
 const g=new Hearth();for(const k of Object.keys(g.tile.stock))g.tile.stock[k]=0;steps(g,180);assert.equal(g.s.people.length,4);assert.ok(g.s.migration);
 const next=g.neighbors().find(t=>t.type!=='mountain');assert.ok(g.travelQuote(next.id).ok);assert.equal(g.migrate(next.id),null);assert.equal(g.s.people.length,4);assert.ok(g.tile.stock.wood>=4);assert.ok(!g.s.migration);
});
test('ordinary recovery gathering still works without food or water',()=>{
 const g=new Hearth();g.tile.stock.food=0;g.tile.stock.water=0;g.assign([0],'food');g.assign([1],'water');steps(g,80);assert.ok(g.tile.stock.food>0);assert.ok(g.tile.stock.water>0);
});
test('protected trees remain untouched and clearing slows regrowth',()=>{
 const g=new Hearth(),n=g.tile.nodes.find(n=>n.kind==='wood');n.protected=true;const before=n.amount;g.assign([0],'wood',n.id);steps(g,90);assert.ok(n.amount>=before);
 const t=g.tile;for(const node of t.nodes.filter(n=>n.kind==='wood')){node.amount=0;node.regrow=0;}steps(g,650);assert.equal(t.nodes.filter(n=>n.kind==='wood'&&n.amount>0).length,0);
});
test('high elevation sees two away and another ridge blocks the middle',()=>{
 const g=new Hearth();for(const t of Object.values(g.s.tiles))t.seen=false;
 g.s.location='0,0';for(const p of g.s.people)p.tile='0,0';g.tile.stock.food=100;g.tile.stock.water=100;g.tile.stock.wood=100;g.s.tech=['baskets','sledges'];assert.equal(g.migrate('1,0'),null);
 assert.ok(g.s.tiles['3,0'].seen);assert.ok(g.s.tiles['1,1'].seen);assert.equal(g.s.tiles['1,2'].seen,false);
});
test('outlines reserve no materials; assigned builders complete and migration preserves them',()=>{
 const g=new Hearth();assert.equal(g.place('shelter',9,13),null);const b=g.tile.buildings[0];assert.equal(g.tile.stock.wood,36);assert.ok(!b.done);g.assign([0,1],'build',b.id);steps(g,130);assert.ok(b.done);const home=g.tile.id;const dest=g.neighbors().find(t=>t.type!=='mountain');g.migrate(dest.id);assert.ok(g.s.tiles[home].buildings[0].done);
});
test('gathering routes debit provisions, deliver actual resources, and recall safely',()=>{
 const g=new Hearth();g.s.tech=['routes','baskets'];const t=g.neighbors()[0];t.visited=true;const node=t.nodes.find(n=>n.kind==='wood');assert.ok(node);const total=t.nodes.filter(n=>n.kind==='wood').reduce((a,n)=>a+n.amount,0),food=g.tile.stock.food;
 assert.equal(g.dispatch([0],t.id,'wood'),null);assert.equal(g.tile.stock.food,food-4);assert.equal(g.people().length,3);const control=new Hearth(JSON.parse(g.serialize()));control.s.routes=[];steps(control,85);steps(g,85);const untouched=control.s.tiles[t.id].nodes.filter(n=>n.kind==='wood').reduce((a,n)=>a+n.amount,0);assert.ok(t.nodes.filter(n=>n.kind==='wood').reduce((a,n)=>a+n.amount,0)<untouched-5);
 g.recall(g.s.routes[0].id);assert.equal(g.people().length,4);assert.ok(valid(g.s));
});
test('a plow needs a prepared field and trained team; prestige preserves completed state',()=>{
 const g=new Hearth();g.s.tech=Object.keys(TECH);g.s.knowledge=350;
 for(const [kind,x,y]of [['field',9,13],['plow',9,14]]){assert.equal(g.place(kind,x,y),null);const b=g.tile.buildings.at(-1);b.done=true;b.paid=true;b.growth=100;}
 g.assign([0],'plow');steps(g,60);assert.ok(!g.s.complete);g.tile.trained=1;g.tile.herd=1;steps(g,120);assert.ok(g.s.complete);assert.equal(g.s.plowed,1);
 const old=g.prestige();assert.ok(JSON.parse(old).complete);assert.equal(g.s.traditions,1);assert.ok(!g.s.complete);assert.ok(valid(g.s));
});
test('malformed saves are rejected before replacing the running journey',()=>{
 const g=new Hearth();for(const mutate of [s=>s.tiles[s.location].stock.wood=-1,s=>s.people[0].x=NaN,s=>s.tech.push('made-up'),s=>s.routes=[{from:'missing'}],s=>s.people.push(s.people[0])]){const s=JSON.parse(g.serialize());mutate(s);assert.throws(()=>new Hearth(s));}
});
