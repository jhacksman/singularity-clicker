// Deterministic diagnostic policy using only public game commands; never edits state.
// This is a planning probe, not evidence of human pacing or enjoyment.
const {Hearth,TECH,BUILD}=require('../../src/hearth/engine.js');
const g=new Hearth();
const milestones=[];
function place(kind){
 if(g.tile.buildings.some(b=>b.kind===kind))return;
 for(const [x,y] of [[9,13],[9,14],[9,15],[9,16],[9,17],[13,9],[14,9],[15,9]])if(!g.place(kind,x,y))return;
}
for(let second=0;second<7200;second++){
 for(const id of Object.keys(TECH))if(g.learn(id))milestones.push({time:g.s.time,learned:id});
 for(const kind of ['shelter','store','rack','field','plow'])if(BUILD[kind].needs.every(k=>g.has(k)))place(kind);
 const next=Object.entries(TECH).find(([id,d])=>!g.has(id)&&d.needs.every(k=>g.has(k)));
 const unfinished=g.tile.buildings.find(b=>!b.done);
 const demand={wood:30,food:30,water:30,stone:3,fiber:6,seed:3};
 for(const cost of [next?.[1].cost,unfinished&&BUILD[unfinished.kind].cost])for(const [k,v] of Object.entries(cost||{}))demand[k]=Math.max(demand[k],v+2);
 if(g.tile.stock.seed<demand.seed)g.practice('gather',.5);
 const supplies=['wood','food','water'];
 const ps=g.people();
 for(let i=0;i<ps.length;i++){
  let job;
  if(i<3)job=supplies[i];
  else if(unfinished&&Object.entries(BUILD[unfinished.kind].cost).every(([k,v])=>g.tile.stock[k]>=v))job='build';
  else job=['fiber','stone','wood','food','water'].sort((a,b)=>(demand[b]-g.tile.stock[b])-(demand[a]-g.tile.stock[a]))[0];
  g.assign([ps[i].id],job);
 }
 g.tick(1);
 if(second%600===599)console.log(JSON.stringify({time:g.s.time,people:g.people().length,knowledge:g.s.knowledge,tech:g.s.tech,stock:g.tile.stock,buildings:g.tile.buildings.map(b=>({kind:b.kind,done:b.done})),blocked:g.people().map(p=>({job:p.job,reason:p.blocked})),migration:g.s.migration}));
}
let enclosures=0;
for(let x=1;x<=14;x++)for(let y=1;y<=14;y++){
 const perimeter=[];for(let dx=0;dx<4;dx++)for(let dy=0;dy<4;dy++)if(dx===0||dy===0||dx===3||dy===3)perimeter.push({x:x+dx,y:y+dy});
 if(perimeter.every(p=>Math.hypot(p.x-9,p.y-9)>=2&&!g.tile.buildings.some(b=>b.x===p.x&&b.y===p.y)&&!g.tile.nodes.some(n=>n.x===p.x&&n.y===p.y&&(n.kind==='water'||n.amount>0))))enclosures++;
}
console.log(JSON.stringify({milestones,emptyFourByFourEnclosureFootprints:enclosures,complete:g.s.complete}));
