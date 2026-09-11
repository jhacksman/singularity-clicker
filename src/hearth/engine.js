/* Platform-independent Stage 1 simulation. Seconds enter through tick(); no DOM or storage. */
(function(root){
'use strict';
const VERSION=1, SIZE=19, HOME={x:9,y:9}, START='-2,1';
const DIRS=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
const RESOURCE=['wood','food','water','stone','fiber','seed'];
const TECH={
 knapping:{name:'Useful edges',knowledge:8,cost:{stone:3},needs:[],text:'Shape flint. Gathering and cutting become more efficient.'},
 bindings:{name:'Twist & bind',knowledge:16,cost:{fiber:5},needs:['knapping'],text:'Bind handles, baskets, fences, and wooden frames.'},
 baskets:{name:'Carrying baskets',knowledge:30,cost:{fiber:8,wood:4},needs:['bindings'],text:'Carry larger loads; unlock additional stores.'},
 drying:{name:'Preserve the surplus',knowledge:42,cost:{wood:8,fiber:4},needs:['bindings'],text:'Build drying racks. Food keeps longer and expeditions cost less.'},
 woodland:{name:'Read the woodland',knowledge:65,cost:{},needs:['knapping'],text:'Set mature-only cutting and protect the next generation.'},
 routes:{name:'There and back',knowledge:80,cost:{food:10,fiber:6},needs:['baskets','drying'],text:'Provision recurring gathering parties to neighboring land.'},
 pottery:{name:'Earth into vessels',knowledge:100,cost:{wood:12,stone:6},needs:['drying'],text:'Fire vessels for better water reserves and food storage.'},
 cultivation:{name:'Keep the seed',knowledge:125,cost:{food:10,seed:3},needs:['pottery'],text:'Lay out fields; reserve seed and repeat their seasonal work.'},
 quarry:{name:'Work the stone face',knowledge:135,cost:{wood:10,stone:8},needs:['routes','knapping'],text:'Provision quarry parties for exposed mountain stone. Loose field stones remain available everywhere.'},
 sledges:{name:'Drag the load',knowledge:145,cost:{wood:18,fiber:8},needs:['baskets'],text:'Carry more through the pass; quarry routes bring heavier loads.'},
 settlement:{name:'A hearth that stays',knowledge:170,cost:{food:18,wood:14},needs:['routes','pottery'],text:'Leave a resident group as your traveling party explores.'},
 husbandry:{name:'A herd nearby',knowledge:200,cost:{food:20,fiber:10},needs:['cultivation'],text:'Enclose grazing land and keep a small herd.'},
 traction:{name:'Work together',knowledge:250,cost:{wood:20,fiber:12},needs:['husbandry','sledges'],text:'Train draft animals and fit a yoke. Hauling becomes easier.'},
 plow:{name:'The first furrow',knowledge:310,cost:{wood:24,stone:8,fiber:10},needs:['traction','woodland'],text:'Build a wooden plow, then work a prepared field.'}
};
const BUILD={
 road:{name:'Pass road',cost:{stone:22,wood:14,food:12},work:120,needs:['sledges'],size:1},
 shelter:{name:'Shelter',cost:{wood:10,fiber:6},work:32,needs:[],size:1},
 store:{name:'Supply store',cost:{wood:12,fiber:5},work:40,needs:['baskets'],size:1},
 rack:{name:'Drying rack',cost:{wood:8,fiber:3},work:24,needs:['drying'],size:1},
 fence:{name:'Wood fence',cost:{wood:2},work:10,needs:['bindings'],size:1},
 wall:{name:'Stone wall',cost:{stone:4},work:18,needs:['bindings'],size:1},
 gate:{name:'Gate',cost:{wood:3,fiber:1},work:14,needs:['bindings'],size:1},
 field:{name:'Seed patch',cost:{seed:2},work:24,needs:['cultivation'],size:1},
 pen:{name:'Herd shelter',cost:{wood:14,fiber:8,food:12},work:50,needs:['husbandry'],size:1},
 plow:{name:'Wooden plow',cost:{wood:18,fiber:8,stone:4},work:70,needs:['plow'],size:1}
};
const JOBS={wood:'Woodcutter',food:'Gatherer',water:'Water carrier',stone:'Stone worker',fiber:'Fiber gatherer',build:'Builder',farm:'Farmer',herd:'Herder',plow:'Plow team',idle:'Resting'};
const NAMES=['Aru','Nara','Tavi','Uma','Sela','Kori','Luma','Oru','Nima','Eri','Asha','Runi'];
const key=(q,r)=>q+','+r;
const distance=(a,b)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs((a.q+a.r)-(b.q+b.r)));
function hash(a,b,c=1){let n=Math.imul(a+117,374761393)^Math.imul(b+193,668265263)^Math.imul(c+41,1274126177);n=(n^(n>>>13))>>>0;return n/4294967296;}
function roundHex(q,r){let x=Math.round(q),z=Math.round(r),y=Math.round(-q-r);const dx=Math.abs(x-q),dy=Math.abs(y+q+r),dz=Math.abs(z-r);if(dx>dy&&dx>dz)x=-y-z;else if(dz>dy)z=-x-y;return{q:x,r:z};}
function freshTile(q,r){
 const mountain=q===1, fertile=q>=2, type=mountain?'mountain':fertile?'meadow':hash(q,r)<.24?'river':hash(q,r)<.43?'rocky':'woodland';
 const t={id:key(q,r),q,r,type,elevation:mountain?1:0,name:mountain?'High pass':fertile?'River grasslands':type==='river'?'Willow bend':type==='rocky'?'Stone shoulder':'Quiet woodland',visited:false,seen:false,stock:{wood:0,food:0,water:0,stone:0,fiber:0,seed:0},nodes:[],buildings:[],empty:0,shortage:0,herd:0,trained:0,seedBank:0,road:false,practice:0};
 for(let x=1;x<SIZE-1;x++)for(let y=1;y<SIZE-1;y++){
  if(Math.hypot(x-9,y-9)<3||x===9||y===9)continue;
  const n=hash(q*21+x,r*21+y),m=hash(x,y,q*11+r*7);
  let kind=null;if(mountain){if(n<.32)kind='stone';}
  else if(n<(fertile?.14:.24))kind='wood';else if(n<.31)kind='stone';else if(n<.39)kind='food';else if(n<.44)kind='fiber';
  if(!kind)continue;
  const age=.25+m*.75; let amount=kind==='wood'?6+age*22:kind==='stone'?mountain?150:12:kind==='food'?20:16;
  const quarry=mountain&&kind==='stone'&&m>.35;if(mountain&&kind==='stone'&&!quarry)amount=12;t.nodes.push({id:x+'-'+y,x,y,kind,amount,max:amount,age,quarry,protected:false,regrow:0});
 }
 t.nodes.push({id:'spring',x:3,y:9,kind:'water',amount:1e6,max:1e6,age:1,protected:false,regrow:0});
 return t;
}
function fresh(traditions=0){
 const tiles={};for(let q=-4;q<=4;q++)for(let r=-4;r<=4;r++)if(Math.abs(q+r)<=4)tiles[key(q,r)]=freshTile(q,r);
 const s={version:VERSION,time:0,location:START,tiles,people:[],tech:[],knowledge:0,skills:{hunt:0,knap:0,gather:0},policies:{mature:false},traditions,complete:false,plowed:0,roads:[],routes:[],events:[],nextId:1,arrivals:0,visits:[],stats:{wood:0,food:0,stone:0,buildings:0},practiceAt:-1000,migration:false};
 for(let i=0;i<4;i++)s.people.push(person(i,START));
 Object.assign(tiles[START].stock,{wood:36,food:38,water:36,stone:4,fiber:6,seed:4});tiles[START].visited=true;s.visits.push(START);reveal(s);return s;
}
function person(i,tile){return{id:i,name:NAMES[i%NAMES.length],tile,x:8+i%3,y:10+Math.floor(i/3),job:'idle',target:null,phase:'seek',work:0,load:0,loadKind:null,xp:0,blocked:'',route:null};}
function reveal(s){const here=s.tiles[s.location],range=here.elevation?2:1;for(const t of Object.values(s.tiles)){const d=distance(here,t);if(d>range)continue;if(d===2){const mid=roundHex((here.q+t.q)/2,(here.r+t.r)/2);if(s.tiles[key(mid.q,mid.r)]?.elevation)continue;}t.seen=true;}}
function valid(s){
 const number=(v,max=1e9)=>Number.isFinite(v)&&v>=0&&v<=max;
 if(!s||s.version!==VERSION||!s.tiles||!s.tiles[s.location]||!Array.isArray(s.people)||s.people.length<1||s.people.length>30||!number(s.time)||!number(s.knowledge)||!number(s.traditions,5)||!Array.isArray(s.tech)||s.tech.some(k=>!TECH[k]))return false;
 if(!s.skills||!['hunt','knap','gather'].every(k=>number(s.skills[k]))||!s.policies||typeof s.policies.mature!=='boolean'||typeof s.complete!=='boolean'||typeof s.migration!=='boolean'||!number(s.plowed)||!number(s.nextId)||!number(s.arrivals)||!number(s.practiceAt+1000)||!s.stats||!['wood','food','stone','buildings'].every(k=>number(s.stats[k])))return false;
 if(!Array.isArray(s.events)||!s.events.every(x=>typeof x==='string'&&x.length<500)||!Array.isArray(s.visits)||s.visits.some(x=>!s.tiles[x])||!Array.isArray(s.roads)||!Array.isArray(s.routes)||s.routes.length>30)return false;
 const ts=Object.values(s.tiles);if(ts.length!==61)return false;
 for(const t of ts){if(!t||t.id!==key(t.q,t.r)||!Number.isInteger(t.q)||!Number.isInteger(t.r)||Math.max(Math.abs(t.q),Math.abs(t.r),Math.abs(t.q+t.r))>4||!['mountain','meadow','river','rocky','woodland'].includes(t.type)||!t.stock||!RESOURCE.every(k=>number(t.stock[k]))||!Array.isArray(t.nodes)||t.nodes.length>400||!Array.isArray(t.buildings)||t.buildings.length>361||!number(t.empty)||!number(t.shortage)||!number(t.herd,30)||!number(t.trained,30))return false;
  if(t.nodes.some(n=>!n||!RESOURCE.includes(n.kind)||!number(n.x,18)||!number(n.y,18)||!number(n.amount,1e7)||!number(n.max,1e7)||!number(n.age,1)||!number(n.regrow)))return false;
  if(t.buildings.some(b=>!b||!BUILD[b.kind]||!number(b.x,18)||!number(b.y,18)||!number(b.work)||!number(b.growth)||!number(b.durability,100)||typeof b.done!=='boolean'||typeof b.paid!=='boolean'))return false;
 }
 const ids=new Set;for(const p of s.people){if(!p||ids.has(p.id)||!Number.isInteger(p.id)||!s.tiles[p.tile]||!JOBS[p.job]||!number(p.x,19)||!number(p.y,19)||!number(p.work)||!number(p.load)||!number(p.xp)||!['seek','work','home','deliver'].includes(p.phase))return false;ids.add(p.id);}
 for(const r of s.routes){if(!r||!s.tiles[r.from]||!s.tiles[r.to]||distance(s.tiles[r.from],s.tiles[r.to])!==1||!['wood','food','stone','fiber','water'].includes(r.kind)||!Array.isArray(r.people)||r.people.some(id=>!ids.has(id))||!number(r.progress)||typeof r.active!=='boolean')return false;}
 return true;
}
class Hearth{
 constructor(state){if(state&&!valid(state))throw Error('Not a compatible Hearth save.');this.state=state?structuredClone(state):fresh();}
 get s(){return this.state;}get tile(){return this.s.tiles[this.s.location];}has(id){return this.s.tech.includes(id);}
 message(v){if(this.s.events.at(-1)!==v)this.s.events.push(v);this.s.events=this.s.events.slice(-30);return v;}
 people(t=this.tile){return this.s.people.filter(p=>p.tile===t.id&&!p.route);}
 cap(t=this.tile){return 70+t.buildings.filter(b=>b.done&&b.kind==='store').length*65+(this.has('pottery')?35:0);}
 add(t,k,n){const actual=Math.max(0,Math.min(n,this.cap(t)-t.stock[k]));t.stock[k]+=actual;return actual;}
 pay(t,cost){if(Object.entries(cost).some(([k,v])=>t.stock[k]+1e-8<v))return false;for(const[k,v]of Object.entries(cost))t.stock[k]-=v;return true;}
 quote(cost,t=this.tile){return Object.entries(cost).map(([k,v])=>v+' '+k+(t.stock[k]+1e-8<v?' (need '+Math.ceil(v-t.stock[k])+' more)':'')).join(' · ')||'Observation only';}
 learn(id){const d=TECH[id];if(!d||this.has(id))return false;if(d.needs.some(k=>!this.has(k))||this.s.knowledge<d.knowledge||!this.pay(this.tile,d.cost))return false;this.s.tech.push(id);this.message(d.name+'. '+d.text);return true;}
 assign(ids,kind,target){if(!JOBS[kind])return false;if(['farm','herd','plow'].includes(kind)&&!this.has({farm:'cultivation',herd:'husbandry',plow:'plow'}[kind]))return false;
 for(const p of this.people().filter(p=>ids.includes(p.id))){if(p.load)this.add(this.tile,p.loadKind,p.load);Object.assign(p,{job:kind,target:target||null,phase:'seek',work:0,load:0,loadKind:null,blocked:''});}return true;}
 blocked(t,x,y){return t.buildings.some(b=>b.done&&['fence','wall'].includes(b.kind)&&b.x===x&&b.y===y);}
 path(t,from,to){const start={x:Math.round(from.x),y:Math.round(from.y)},end={x:Math.round(to.x),y:Math.round(to.y)};const id=p=>p.x+','+p.y,queue=[start],prev=new Map([[id(start),null]]);let found=null;
 while(queue.length){const a=queue.shift();if(a.x===end.x&&a.y===end.y){found=a;break;}for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const b={x:a.x+dx,y:a.y+dy};if(b.x<1||b.y<1||b.x>17||b.y>17||prev.has(id(b))||this.blocked(t,b.x,b.y))continue;prev.set(id(b),a);queue.push(b);}}
 if(!found)return null;const out=[];while(prev.get(id(found))){out.unshift(found);found=prev.get(id(found));}return out;
 }
 place(kind,x,y){const d=BUILD[kind],t=this.tile;x=Math.round(x);y=Math.round(y);if(!d||d.needs.some(k=>!this.has(k)))return 'Learn the required practice first.';
 if(x<1||y<1||x>17||y>17||Math.hypot(x-9,y-9)<2)return 'Leave room around the hearth.';
 if(t.type==='mountain'&&['field','shelter','pen'].includes(kind))return 'This rocky pass supports expeditions, not a lasting camp.';
 if(t.buildings.some(b=>b.x===x&&b.y===y)||t.nodes.some(n=>n.x===x&&n.y===y&&(n.kind==='water'||n.amount>0)))return 'Clear this ground before building.';
 if(['fence','wall'].includes(kind)){const trial={id:'test',kind,x,y,done:true};t.buildings.push(trial);const targets=[...this.people(t),...t.nodes.filter(n=>n.amount>0&&n.kind==='water')];const inaccessible=targets.some(p=>!this.path(t,p,HOME));t.buildings.pop();if(inaccessible)return 'This would close access. Leave a gate opening.';}
 const b={id:'b'+this.s.nextId++,kind,x,y,work:0,paid:false,done:false,growth:0,durability:100};t.buildings.push(b);return null;
 }
 remove(id){const b=this.tile.buildings.find(x=>x.id===id);if(!b)return false;if(b.paid)for(const[k,v]of Object.entries(BUILD[b.kind].cost))this.add(this.tile,k,Math.floor(v*(b.done?.65:1)));this.tile.buildings=this.tile.buildings.filter(x=>x.id!==id);return true;}
 movePlan(id,x,y){const b=this.tile.buildings.find(x=>x.id===id);if(!b||b.done)return 'Dismantle completed structures to rebuild elsewhere.';const err=this.place(b.kind,x,y);if(err)return err;const fresh=this.tile.buildings.pop();Object.assign(b,{x:fresh.x,y:fresh.y});return null;}
 ready(t=this.tile){if(t.type==='mountain')return 0;const built=k=>t.buildings.some(b=>b.kind===k&&b.done);const renewable=t.nodes.filter(n=>n.kind==='wood'&&n.age>.25&&n.amount>0).length;return Math.min(100,Math.round(10+(t.stock.food>10?10:0)+(t.stock.water>10?10:0)+(t.stock.wood>10?10:0)+(built('shelter')?15:0)+(built('store')?10:0)+(built('rack')?10:0)+(built('field')?15:0)+Math.min(10,renewable)));}
 enclosure(t,b){const q=[{x:b.x,y:b.y}],seen=new Set;while(q.length){const p=q.shift(),k=p.x+','+p.y;if(seen.has(k))continue;seen.add(k);if(p.x<=0||p.y<=0||p.x>=18||p.y>=18)return false;for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx,y:p.y+dy};if(!t.buildings.some(w=>w.done&&['fence','wall','gate'].includes(w.kind)&&w.x===n.x&&w.y===n.y))q.push(n);}}return seen.size>=4;}
 target(p,t){
 const d=(a)=>Math.hypot(a.x-p.x,a.y-p.y);
 if(p.job==='build')return t.buildings.filter(b=>!b.done||(b.kind==='fence'&&b.durability<60)).sort((a,b)=>(a.id===p.target?-1:b.id===p.target?1:d(a)-d(b)))[0];
 if(p.job==='farm')return t.buildings.filter(b=>b.kind==='field'&&b.done&&b.growth>=100).sort((a,b)=>d(a)-d(b))[0];
 if(p.job==='herd')return t.buildings.find(b=>b.kind==='pen'&&b.done&&this.enclosure(t,b));
 if(p.job==='plow')return t.buildings.find(b=>b.kind==='field'&&b.done&&!b.plowed&&t.trained>=1&&t.buildings.some(v=>v.kind==='plow'&&v.done));
 const anchor=t.nodes.find(n=>n.id===p.target);return t.nodes.filter(n=>n.kind===p.job&&!n.quarry&&n.amount>0&&!n.protected&&(!anchor||Math.hypot(n.x-anchor.x,n.y-anchor.y)<=5)&&(!(this.s.policies.mature&&p.job==='wood')||n.age>=.85)).sort((a,b)=>d(a)-d(b))[0];
 }
 walk(p,t,to,dt){if(Math.hypot(p.x-to.x,p.y-to.y)<.08){p.x=to.x;p.y=to.y;return true;}const route=this.path(t,p,to);if(!route){p.blocked='Needs an open path';return false;}const aim=route[0]||to,dx=aim.x-p.x,dy=aim.y-p.y,dist=Math.hypot(dx,dy),step=Math.min(dist,dt*(this.has('sledges')?1.65:1.35));if(dist){p.x+=dx/dist*step;p.y+=dy/dist*step;}return Math.hypot(p.x-to.x,p.y-to.y)<.08;}
 workPerson(p,t,dt){
 if(p.job==='idle'){p.blocked='';return;}
 if(p.phase==='home'||p.phase==='deliver'){if(this.walk(p,t,HOME,dt)){if(p.load){this.add(t,p.loadKind,p.load);if(this.s.stats[p.loadKind]!==undefined)this.s.stats[p.loadKind]+=p.load;}p.load=0;p.phase='seek';}return;}
 if((t.stock.food<=0||t.stock.water<=0)&&['build','herd','plow','stone'].includes(p.job)){p.blocked='Resting until supplies recover';this.walk(p,t,HOME,dt);return;}
 const n=this.target(p,t);if(!n){p.blocked=p.job==='farm'?'Waiting for the crop':p.job==='herd'?'Needs an enclosed herd shelter':p.job==='plow'?'Needs a draft team, plow, and field':'Work area complete';this.walk(p,t,HOME,dt);return;}
 if(RESOURCE.includes(p.job)&&t.stock[p.job]>=this.cap(t)-.01){p.blocked='Storage is full';this.walk(p,t,HOME,dt);return;}
 p.blocked='';let destination=n;
 if(this.blocked(t,n.x,n.y))destination=[{x:n.x+1,y:n.y},{x:n.x-1,y:n.y},{x:n.x,y:n.y+1},{x:n.x,y:n.y-1}].find(a=>this.path(t,p,a))||n;
 if(!this.walk(p,t,destination,dt))return;p.phase='work';
 if(p.job==='build'&&!n.paid&&Object.entries(BUILD[n.kind].cost).some(([k,v])=>t.stock[k]<v)){p.blocked='Waiting for '+this.quote(BUILD[n.kind].cost,t);return;}
 if(p.job==='farm'&&t.stock.seed<1){p.blocked='Keep one seed for the next planting';return;}
 if(p.job==='herd'&&t.herd>=2&&(!this.has('traction')||t.trained>=t.herd)){p.blocked='The herd is settled';return;}
 const speed=(1+(this.has('knapping')?.25:0)+Math.min(.35,p.xp/1600))*(1+this.s.traditions*.08);
 p.work+=dt*speed;p.xp+=dt;this.s.knowledge+=dt*.075*(1+this.s.traditions*.08);
 if(p.job==='build'){
  if(!n.paid){if(!this.pay(t,BUILD[n.kind].cost)){p.blocked='Waiting for '+this.quote(BUILD[n.kind].cost,t);return;}n.paid=true;}
  if(n.done){n.durability=Math.min(100,n.durability+dt*4);return;}n.work+=dt*speed;if(n.work>=BUILD[n.kind].work){n.done=true;if(['fence','wall'].includes(n.kind)&&[...this.people(t),...t.nodes.filter(v=>v.kind==='water')].some(v=>!this.path(t,v,HOME))){n.done=false;p.blocked='Leave a gate opening before finishing this fence';return;}this.s.stats.buildings++;if(n.kind==='field')n.growth=1;if(n.kind==='road')t.road=true;this.message(BUILD[n.kind].name+' completed at '+t.name+'.');p.phase='home';}return;
 }
 if(p.job==='herd'){if(p.work<20)return;p.work=0;if(t.herd<2&&this.pay(t,{food:6,water:3})){t.herd++;this.message('An animal settles into the enclosure.');}else if(this.has('traction')&&t.trained<t.herd&&this.pay(t,{food:4,water:2})){t.trained++;this.message('The draft team is ready.');}else p.blocked='The herd is settled';return;}
 if(p.job==='plow'){if(p.work<55)return;if(t.stock.wood<8||t.stock.food<10||t.stock.water<8){p.blocked='Prepare 8 wood, 10 food, and 8 water for the camp';return;}n.plowed=true;p.work=0;this.s.plowed++;this.s.complete=true;this.message('The first furrow. Tonight, the hearth stays.');return;}
 if(p.work<7)return;p.work=0;const capacity=(this.has('baskets')?8:5)+(this.has('traction')?3:0);
 if(p.job==='farm'){if(t.stock.seed<1){p.blocked='Keep one seed for the next planting';return;}t.stock.seed--;p.load=12;p.loadKind='food';this.add(t,'seed',3);n.growth=1;p.phase='home';return;}
 let take=Math.min(n.amount,capacity);if(n.kind==='wood'&&n.age<.85)take*=.65;n.amount=Math.max(0,n.amount-take);if(n.amount<.01)n.amount=0;p.load=take;p.loadKind=n.kind;p.phase='home';
 }
 tick(dt=1){if(!Number.isFinite(dt)||dt<=0||dt>10)throw Error('Tick must be between 0 and 10 seconds.');const s=this.s;const before=s.time;s.time+=dt;if(before<480&&s.time>=480)this.message('The herds have been moving northeast. Their tracks continue beyond these woods.');
 for(const t of Object.values(s.tiles)){
  if(!t.visited)continue;const residents=this.people(t);
  for(const n of t.nodes){if(n.kind==='wood'){
   if(n.amount>0){n.age=Math.min(1,n.age+dt/2200);n.amount=Math.min(28,n.amount+dt*.003);}
   else {n.regrow+=dt;const nearby=t.nodes.some(v=>v.kind==='wood'&&v.amount>0&&v.age>.6&&Math.hypot(n.x-v.x,n.y-v.y)<5);if(n.regrow>(nearby?600:2400)){n.amount=4;n.age=.12;n.regrow=0;}}
  }else if(['food','fiber'].includes(n.kind))n.amount=Math.min(n.max,n.amount+dt*(n.kind==='food'?.013:.007));}
  for(const b of t.buildings){if(b.done&&b.kind==='field'&&b.growth>0)b.growth=Math.min(100,b.growth+dt*(t.type==='meadow'?.20:.12));if(b.done&&b.kind==='fence')b.durability=Math.max(0,b.durability-dt*.006);}
  if(!residents.length)continue;
  const burn=.014*residents.length*(1+(t.type==='mountain'?.5:0));t.stock.wood=Math.max(0,t.stock.wood-burn*dt);t.stock.food=Math.max(0,t.stock.food-residents.length*.009*dt);t.stock.water=Math.max(0,t.stock.water-residents.length*.009*dt);
  t.empty=t.stock.wood<=0?t.empty+dt:0;t.shortage=t.stock.food<=0||t.stock.water<=0?t.shortage+dt:0;
  for(const p of residents)this.workPerson(p,t,dt);
  if(t.empty>100||t.shortage>160){if(t.id===s.location){if(!s.migration)this.message('The elders have spoken. It is time to move. We will carry the ember.');s.migration=true;}else{for(const p of residents){p.tile=s.location;p.x=9;p.y=10;p.job='idle';p.phase='seek';}this.message('The people at '+t.name+' have safely returned to your hearth.');}}
 }
 if(this.tile.stock.wood>0&&this.tile.stock.food>0&&this.tile.stock.water>0)s.migration=false;
 this.tickRoutes(dt);
 if(s.people.length<10&&s.time>(s.arrivals+1)*650&&this.ready()>40&&this.tile.stock.food>20){const id=s.people.length;s.people.push(person(id,s.location));s.arrivals++;this.message(NAMES[id]+' has joined your hearth.');}
 }
 practice(kind,quality){if(!['hunt','knap','gather'].includes(kind)||this.s.time-this.s.practiceAt<35)return false;quality=Math.max(.2,Math.min(1,Number(quality)||.2));this.s.practiceAt=this.s.time;this.s.skills[kind]++;this.s.knowledge+=1+quality*2;
 if(kind==='hunt'){const patch=this.tile.nodes.find(n=>n.kind==='food'&&n.amount>=3);if(patch){const take=Math.min(patch.amount,4+quality*6);patch.amount-=take;this.add(this.tile,'food',take);}}
 if(kind==='knap')this.add(this.tile,'stone',1+quality*2);if(kind==='gather'){this.add(this.tile,'fiber',2+quality*3);this.add(this.tile,'seed',1);}return true;}
 neighbors(t=this.tile){return DIRS.map(([q,r])=>this.s.tiles[key(t.q+q,t.r+r)]).filter(Boolean);}
 travelQuote(id,leave=0){const t=this.s.tiles[id],from=this.tile;if(!t||distance(from,t)!==1)return{ok:false,reason:'Choose a neighboring hex.'};const travelers=this.people().length-leave;if(travelers<1)return{ok:false,reason:'Keep at least one traveler.'};if(leave&&(!this.has('settlement')||this.ready()<50))return{ok:false,reason:'A resident hearth needs settlement knowledge and 50% readiness.'};
 const hard=t.type==='mountain'&&!t.visited;const factor=(this.has('sledges')?.7:1)*(this.has('traction')?.7:1)*((from.road||t.road)? .65 : 1);const cost=hard?{food:Math.ceil(12*travelers*factor),water:Math.ceil(8*travelers*factor),wood:Math.ceil(6*travelers*factor)}:{};
 const carrying=travelers*(this.has('sledges')?36:this.has('baskets')?25:18);const total=Object.values(cost).reduce((a,b)=>a+b,0);return{ok:Object.entries(cost).every(([k,v])=>from.stock[k]>=v)&&total<=carrying,cost,carrying,travelers,hard,reason:total>carrying?'Improve carrying equipment before this crossing.':Object.entries(cost).some(([k,v])=>from.stock[k]<v)?'Gather the expedition provisions.':'Ready to move.'};
 }
 migrate(id,leave=0){leave=Math.max(0,Math.floor(leave)||0);const quote=this.travelQuote(id,leave);if(!quote.ok)return quote.reason;const from=this.tile,t=this.s.tiles[id];this.pay(from,quote.cost);let capacity=quote.carrying;const carry={};for(const k of ['wood','food','water','seed','fiber','stone']){const n=Math.min(from.stock[k]*(leave?.5:1),capacity/(k==='wood'||k==='food'?3:1));carry[k]=n;from.stock[k]-=n;capacity-=n;}
 const movers=this.people().slice(leave);for(const p of movers){if(p.load)this.add(from,p.loadKind,p.load);Object.assign(p,{tile:id,x:9,y:10,job:'idle',phase:'seek',target:null,load:0,work:0,blocked:''});}
 if(!t.visited){this.s.knowledge+=3;this.s.visits.push(id);}t.visited=true;for(const[k,v]of Object.entries(carry))this.add(t,k,v);
 // Free emergency starter fuel prevents a travel cost from becoming a survival deadlock.
 if(t.stock.wood<4)t.stock.wood=4;this.s.location=id;this.s.migration=false;t.empty=0;t.shortage=0;reveal(this.s);this.message(t.type==='meadow'?'The pass opens onto grass and running water. Choose a place to begin.':'The ember has reached '+t.name+'.');return null;
 }
 road(){if(!this.has('sledges')||this.tile.road||this.tile.buildings.some(b=>b.kind==='road'))return false;for(let y=12;y<18;y++)if(!this.place('road',9,y)){this.message('Road outline placed. Assign builders to clear and improve the route.');return true;}return false;}
 dispatch(ids,to,kind){if(!this.has('routes')||!['wood','food','stone','fiber','water'].includes(kind)||!this.neighbors().some(t=>t.id===to&&t.visited))return 'Visit this adjacent tile and learn gathering routes first.';if(kind==='stone'&&this.s.tiles[to].type==='mountain'&&!this.has('quarry'))return 'Learn to work the stone face before provisioning a quarry party.';const ps=this.people().filter(p=>ids.includes(p.id));if(!ps.length||ps.length>=this.people().length)return 'Keep at least one person at this hearth.';if(!this.pay(this.tile,{food:ps.length*4,water:ps.length*3}))return 'Pack 4 food and 3 water per worker.';const route={id:'r'+this.s.nextId++,from:this.s.location,to,kind,people:ps.map(p=>p.id),progress:0,active:true,waiting:''};for(const p of ps){if(p.load)this.add(this.tile,p.loadKind,p.load);p.load=0;p.route=route.id;}this.s.routes.push(route);return null;}
 recall(id){const r=this.s.routes.find(x=>x.id===id);if(!r)return;for(const p of this.s.people.filter(p=>p.route===id)){p.route=null;p.tile=this.s.location;p.job='idle';p.phase='seek';p.x=9;p.y=10;}this.s.routes=this.s.routes.filter(x=>x.id!==id);}
 tickRoutes(dt){for(const r of this.s.routes){const from=this.s.tiles[r.from],to=this.s.tiles[r.to];r.progress+=dt;const duration=(from.road||to.road?50:80)*(this.has('traction')?.7:1);if(r.progress<duration)continue;r.progress=0;const nodes=to.nodes.filter(n=>n.kind===r.kind&&(!n.quarry||this.has('quarry'))&&n.amount>0&&!n.protected&&(!(r.kind==='wood'&&this.s.policies.mature)||n.age>=.85));let load=r.people.length*(this.has('sledges')?18:10);let taken=0;for(const n of nodes){const amount=Math.min(n.amount,load,Math.max(0,this.cap(from)-from.stock[r.kind]-taken));n.amount-=amount;load-=amount;taken+=amount;}this.add(from,r.kind,taken);this.s.knowledge+=taken*.035;
 if(!taken||!this.pay(from,{food:r.people.length*3,water:r.people.length*2})){r.active=false;r.waiting=!taken?'Destination resting or stores full':'Provisions exhausted';}}
 for(const r of [...this.s.routes])if(!r.active){this.message('A gathering party returns safely. '+r.waiting+'.');this.recall(r.id);}
 }
 prestige(){if(!this.s.complete)return null;const archived=this.serialize(),t=Math.min(5,this.s.traditions+1);this.state=fresh(t);this.message('A familiar ember. The tribe carries '+t+' inherited tradition'+(t===1?'':'s')+'.');return archived;}
 serialize(){return JSON.stringify(this.state);}
}
const API={Hearth,TECH,BUILD,JOBS,RESOURCE,SIZE,HOME,START,distance,key,valid};if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HearthGame=API;
})(typeof globalThis!=='undefined'?globalThis:this);
