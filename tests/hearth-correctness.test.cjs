const test=require('node:test'),assert=require('node:assert/strict');
const {Hearth,valid}=require('../src/hearth/engine.js');
const steps=(g,n)=>{for(let i=0;i<n;i++)g.tick(1);};
const building=(kind,x,y,extra={})=>({id:kind+x+','+y,kind,x,y,work:100,paid:true,done:true,growth:0,durability:100,...extra});
test('completed drying racks conserve camp food without changing water or creating food',()=>{
 const plain=new Hearth(),dried=new Hearth(JSON.parse(plain.serialize()));dried.s.tech=['drying'];dried.tile.buildings.push(building('rack',9,13));steps(plain,100);steps(dried,100);
 assert.ok(dried.tile.stock.food>plain.tile.stock.food);assert.ok(dried.tile.stock.food<38);assert.equal(dried.tile.stock.water,plain.tile.stock.water);
 const restored=new Hearth(JSON.parse(dried.serialize()));steps(dried,20);steps(restored,20);assert.deepEqual(restored.s,dried.s);assert.ok(valid(restored.s));
});
test('drying reduces actual mountain and gathering-party food provisions, not free migration',()=>{
 const g=new Hearth();g.s.location='0,0';for(const p of g.s.people)p.tile='0,0';g.tile.visited=true;g.s.tech=['baskets','sledges','routes','drying'];Object.assign(g.tile.stock,{food:70,water:70,wood:70});const before=g.travelQuote('1,0');g.tile.buildings.push(building('rack',9,13));const after=g.travelQuote('1,0');assert.ok(after.cost.food<before.cost.food);assert.equal(after.cost.water,before.cost.water);assert.deepEqual(g.travelQuote('-1,0').cost,{});
 const dest=g.s.tiles['-1,0'];dest.visited=true;const start=g.tile.stock.food;assert.equal(g.dispatch([0],dest.id,'wood'),null);assert.ok(start-g.tile.stock.food<4);g.tile.stock.wood=0;const food=g.tile.stock.food;g.tickRoutes(80);assert.ok(food-g.tile.stock.food<3);assert.ok(food-g.tile.stock.food>0);
});
test('exhausted side fences open a cardinal enclosure; a missing corner alone does not',()=>{
 const g=new Hearth(),t=g.tile;t.nodes=t.nodes.filter(n=>n.kind==='water');
 const pen=building('pen',5,5);t.buildings.push(pen);
 for(let x=4;x<=7;x++)for(let y=4;y<=7;y++)if(x===4||y===4||x===7||y===7)t.buildings.push(building(x===5&&y===4?'gate':'fence',x,y));
 assert.ok(g.enclosure(t,pen));
 // The interior (5..6,5..6) has no cardinal neighbor at corner (4,4).
 const corner=t.buildings.find(b=>b.x===4&&b.y===4);corner.durability=.001;g.tick(1);
 assert.equal(corner.durability,0);assert.equal(g.blocked(t,4,4),false);
 assert.equal(g.enclosure(t,pen),true,'A diagonal-only corner gap does not open a cardinal enclosure');
 // Side cell (4,5) connects interior (5,5) to exterior (3,5).
 const side=t.buildings.find(b=>b.x===4&&b.y===5);side.durability=.001;g.tick(1);
 assert.equal(side.durability,0);assert.equal(g.blocked(t,4,5),false);
 assert.equal(g.enclosure(t,pen),false,'A broken side must open the enclosure');
 g.assign([0],'build',side.id);steps(g,100);
 assert.ok(side.durability>0);assert.equal(g.blocked(t,4,5),true);
 assert.ok(g.enclosure(t,pen));assert.ok(valid(g.s));
});
test('repair cannot seal a worker inside an enclosure without a gate',()=>{
 const g=new Hearth(),t=g.tile;t.nodes=t.nodes.filter(n=>n.kind==='water');for(let x=4;x<=7;x++)for(let y=4;y<=7;y++)if(x===4||y===4||x===7||y===7)t.buildings.push(building('fence',x,y));const gap=t.buildings.find(b=>b.x===5&&b.y===4);gap.durability=0;Object.assign(g.s.people[1],{x:5,y:5});g.assign([0],'build',gap.id);steps(g,60);assert.equal(gap.durability,0);assert.ok(g.path(t,g.s.people[1],{x:9,y:9}));const wall=building('wall',12,12);t.buildings.push(wall);steps(g,10);assert.equal(wall.durability,100);
});
test('knapping practice improves tool work beyond the initial discovery',()=>{
 const a=new Hearth(),b=new Hearth(JSON.parse(a.serialize()));a.s.tech=b.s.tech=['knapping'];b.s.skills.knap=5;for(const g of [a,b]){g.assign([0],'wood');const n=g.target(g.s.people[0],g.tile);Object.assign(g.s.people[0],{x:n.x,y:n.y});g.tick(1);}assert.ok(b.s.people[0].work>a.s.people[0].work);
});
