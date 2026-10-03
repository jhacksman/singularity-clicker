/* Finite, deterministic RTS economy. No DOM, clocks, network or hidden production. */
(function(root){
'use strict';
const W=36,H=24,KEY='singularity-clicker.hearth-rts.v1';
const COST={outpost:{wood:60,stone:20},workshop:{wood:40,stone:30},worker:{food:25},knapping:{wood:4,stone:8}};
const WORK={outpost:24,workshop:32};
const NAMES=['Aru','Nara','Tavi','Uma','Sela','Kori','Luma','Oru'];
const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
function unit(i,x,y){return{id:'u'+i,name:NAMES[i],x,y,order:{kind:'idle'},phase:'idle',cargo:0,resource:null,work:0,path:[],reason:'Ready for orders',next:null};}
function fresh(){
 const deposits=[['wood',5,6,48],['wood',10,5,48],['stone',12,10,60],['food',5,18,75],['wood',26,6,180],['wood',30,9,120],['stone',29,15,150],['food',24,19,150]].map(([kind,x,y,amount],i)=>({id:'d'+i,kind,x,y,amount,initial:amount}));
 const s={version:2,tools:false,knapping:null,time:0,stock:{wood:20,stone:10,food:0},deposits,buildings:[{id:'b0',kind:'hearth',x:7,y:11,done:true,work:0,cost:{}}],units:[unit(0,6,14),unit(1,7,14),unit(2,8,14),unit(3,9,14)],seen:[],nextId:1,spent:{wood:0,stone:0,food:0},delivered:{wood:0,stone:0,food:0},depleted:0,complete:false};return s;
}
function valid(s){
 const n=v=>Number.isFinite(v)&&v>=0&&v<1e7,point=p=>p&&n(p.x)&&n(p.y)&&p.x<W&&p.y<H;
 if(!s||![1,2].includes(s.version)||!n(s.time)||!n(s.nextId)||!n(s.depleted)||typeof s.complete!=='boolean')return false;
 if(!['stock','spent','delivered'].every(k=>s[k]&&['wood','stone','food'].every(r=>n(s[k][r]))))return false;
 if(!Array.isArray(s.deposits)||s.deposits.length!==8||!Array.isArray(s.units)||s.units.length<1||s.units.length>8||!Array.isArray(s.buildings)||s.buildings.length>30||!s.buildings.some(b=>b.kind==='hearth'&&b.done))return false;
 if(!Array.isArray(s.seen)||s.seen.length>W*H||s.seen.some(i=>!Number.isInteger(i)||i<0||i>=W*H))return false;
 const ids=new Set();for(const o of [...s.deposits,...s.units,...s.buildings]){if(!point(o)||typeof o.id!=='string'||ids.has(o.id))return false;ids.add(o.id);}
 if(s.deposits.some(d=>!['wood','stone','food'].includes(d.kind)||!n(d.amount)||!n(d.initial)||d.amount>d.initial))return false;
 if(s.buildings.some(b=>!['hearth','outpost','workshop'].includes(b.kind)||typeof b.done!=='boolean'||!n(b.work)||!b.cost||Object.entries(b.cost).some(([k,v])=>!['wood','stone','food'].includes(k)||!n(v))))return false;
 if(s.version===2&&(typeof s.tools!=='boolean'||(s.knapping!==null&&(!s.knapping||!n(s.knapping.work)||s.knapping.work>12||typeof s.knapping.workshop!=='string'||!s.buildings.some(b=>b.id===s.knapping.workshop&&b.kind==='workshop'&&b.done)||typeof s.knapping.done!=='boolean'||s.knapping.done!==s.tools||s.knapping.done&&s.knapping.work!==12))))return false;
 if(s.version===2&&s.tools&&!s.knapping)return false;
 const order=o=>o&&['idle','move','gather','build',...(s.version===2?['craft']:[])].includes(o.kind)&&(o.kind==='idle'||o.kind==='move'&&point(o)||['gather','build','craft'].includes(o.kind)&&typeof o.target==='string');
 return s.units.every(u=>typeof u.name==='string'&&u.name.length<30&&n(u.cargo)&&u.cargo<=5&&n(u.work)&&order(u.order)&&(!u.next||order(u.next))&&['idle','walk','extract','return','construct',...(s.version===2?['craft']:[])].includes(u.phase)&&(!u.resource||['wood','stone','food'].includes(u.resource))&&(!u.cargo||!!u.resource)&&Array.isArray(u.path)&&u.path.length<W*H&&u.path.every(point)&&typeof u.reason==='string'&&u.reason.length<200);
}
class Camp{
 constructor(state){if(state&&!valid(state))throw Error('Not a compatible RTS Hearth save.');this.s=state?structuredClone(state):fresh();if(this.s.version===1){this.s.version=2;this.s.tools=false;this.s.knapping=null;}this.reveal();}
 water(x,y){return (x===18||x===19)&&!(y>=11&&y<=14);}
 size(b){return b.kind==='hearth'?3:2;}
 blocked(x,y){return x<0||y<0||x>=W||y>=H||this.water(x,y)||this.s.deposits.some(d=>d.amount>0&&d.x===x&&d.y===y)||this.s.buildings.some(b=>x>=b.x&&x<b.x+this.size(b)&&y>=b.y&&y<b.y+this.size(b));}
 visible(x,y){return this.s.seen.includes(Math.floor(y)*W+Math.floor(x));}
 reveal(){const seen=new Set(this.s.seen);for(const a of [...this.s.units,...this.s.buildings.filter(b=>b.done)])for(let x=Math.max(0,Math.floor(a.x)-8);x<Math.min(W,Math.floor(a.x)+9);x++)for(let y=Math.max(0,Math.floor(a.y)-8);y<Math.min(H,Math.floor(a.y)+9);y++)if(Math.hypot(x-a.x,y-a.y)<=8)seen.add(y*W+x);this.s.seen=[...seen].sort((a,b)=>a-b);}
 path(from,targets){const start={x:Math.round(from.x),y:Math.round(from.y)},key=p=>p.y*W+p.x,goals=new Set(targets.filter(p=>!this.blocked(p.x,p.y)).map(key)),queue=[start],prev=new Map([[key(start),null]]);let end;
 for(let i=0;i<queue.length;i++){const p=queue[i];if(goals.has(key(p))){end=p;break;}for(const[dx,dy]of [[1,0],[0,1],[-1,0],[0,-1]]){const q={x:p.x+dx,y:p.y+dy};if(!prev.has(key(q))&&!this.blocked(q.x,q.y)){prev.set(key(q),p);queue.push(q);}}}
 if(!end)return null;const result=[];while(prev.get(key(end))){result.unshift(end);end=prev.get(key(end));}return result;
 }
 around(o){const z=o.kind==='hearth'?3:['outpost','workshop'].includes(o.kind)?2:1,out=[];for(let i=0;i<z;i++)out.push({x:o.x-1,y:o.y+i},{x:o.x+z,y:o.y+i},{x:o.x+i,y:o.y-1},{x:o.x+i,y:o.y+z});return out;}
 freeTargets(u,targets){return targets.filter(p=>!this.s.units.some(v=>v!==u&&((v.path.length&&v.path.at(-1).x===p.x&&v.path.at(-1).y===p.y)||Math.hypot(v.x-p.x,v.y-p.y)<.4)));}
 route(u,targets){const free=this.freeTargets(u,targets);const path=this.path(u,free.length?free:targets);if(!path){u.phase='idle';u.reason='Blocked — choose a reachable target';u.path=[];return false;}u.path=path;return true;}
 home(u){const choices=this.s.buildings.filter(b=>b.done&&['hearth','outpost'].includes(b.kind)).map(b=>({b,path:this.path(u,this.freeTargets(u,this.around(b)))})).filter(v=>v.path).sort((a,b)=>a.path.length-b.path.length);if(!choices.length){u.phase='idle';u.reason='Drop-off blocked or crowded — clear space';u.path=[];return false;}u.path=choices[0].path;u.phase='return';u.reason='Returning '+u.cargo+' '+u.resource;return true;}
 start(u){u.work=0;u.path=[];const o=u.order;if(o.kind==='idle'){u.phase='idle';u.reason='Ready for orders';return;}
 if(o.kind==='move'){if(this.route(u,[o])){u.phase='walk';u.reason='Moving';}return;}
 const target=(o.kind==='gather'?this.s.deposits:this.s.buildings).find(v=>v.id===o.target);
 if(o.kind==='craft'&&(!this.s.knapping||this.s.knapping.workshop!==o.target||this.s.knapping.done)){u.phase='idle';u.reason=this.s.tools?'Toolset complete':'No active knapping project';return;}
 if(!target||o.kind==='gather'&&target.amount===0||o.kind==='build'&&target.done){u.phase='idle';u.reason=o.kind==='gather'?'Deposit exhausted — choose another':'Construction complete';return;}
 if(this.route(u,this.around(target))){u.phase=o.kind==='gather'?'extract':o.kind==='craft'?'craft':'construct';u.reason=o.kind==='gather'?'Gathering '+target.kind:o.kind==='craft'?'Knapping tools':'Building '+target.kind;}
 }
 command(ids,order){let count=0;for(const u of this.s.units.filter(u=>ids.includes(u.id))){if(JSON.stringify(u.order)===JSON.stringify(order)&&u.phase!=='idle')continue;count++;if(u.cargo){u.next=structuredClone(order);this.home(u);}else{u.order=structuredClone(order);u.next=null;this.start(u);}}return count;}
 canPay(cost){return Object.entries(cost).every(([r,n])=>this.s.stock[r]>=n);}
 pay(cost){if(!this.canPay(cost))return false;for(const[r,n]of Object.entries(cost)){this.s.stock[r]-=n;this.s.spent[r]+=n;}return true;}
 placement(kind,x,y){if(!WORK[kind])return 'Unknown structure';if(this.s.buildings.length>=30)return 'Camp structure limit reached';if(!this.visible(x,y))return 'Scout this ground first';for(let dx=0;dx<2;dx++)for(let dy=0;dy<2;dy++)if(this.blocked(x+dx,y+dy)||this.s.units.some(u=>Math.abs(u.x-x-dx)<.65&&Math.abs(u.y-y-dy)<.65))return 'Choose clear ground';if(!this.canPay(COST[kind]))return 'Need '+Object.entries(COST[kind]).map(([r,n])=>n+' '+r).join(' + ');return null;}
 build(kind,x,y,ids){const error=this.placement(kind,x,y);if(error)return {error};const b={id:'b'+this.s.nextId++,kind,x,y,done:false,work:0,cost:{...COST[kind]}};this.s.buildings.push(b);
 // Preserve access to every worker and deposit; no irreversible choke-point seals.
 const home=this.s.buildings.find(v=>v.kind==='hearth');const targets=[...this.s.units,...this.s.deposits.filter(d=>d.amount>0).flatMap(d=>this.around(d).filter(p=>!this.blocked(p.x,p.y)).slice(0,1))];
 if(targets.some(p=>!this.path(p,this.around(home)))){this.s.buildings.pop();return {error:'Leave a route through the camp'};}
 this.pay(b.cost);for(const u of this.s.units)if(u.path.length){if(u.cargo)this.home(u);else this.start(u);}this.command(ids,{kind:'build',target:b.id});return {id:b.id};}
 cancel(id){const b=this.s.buildings.find(v=>v.id===id&&!v.done);if(!b)return false;for(const[r,n]of Object.entries(b.cost)){this.s.stock[r]+=n;this.s.spent[r]-=n;}this.s.buildings=this.s.buildings.filter(v=>v.id!==id);for(const u of this.s.units)if(u.order.target===id){u.order={kind:'idle'};this.start(u);}return true;}
 beginKnapping(workshop,ids){const b=this.s.buildings.find(b=>b.id===workshop&&b.kind==='workshop'&&b.done);if(!b)return 'Finish a workshop first';if(!this.s.units.some(u=>ids.includes(u.id)))return 'Select villagers to craft the tools';if(this.s.tools)return 'Useful edges already crafted';if(this.s.knapping&&this.s.knapping.workshop!==workshop)return 'Resume the project at its original workshop';if(!this.s.knapping){if(!this.pay(COST.knapping))return 'Need 4 wood and 8 stone';this.s.knapping={workshop,work:0,done:false};}this.command(ids,{kind:'craft',target:workshop});return null;}
 train(){if(this.s.units.length>=8)return 'All eight villagers have joined';const home=this.s.buildings.find(b=>b.kind==='hearth'),spot=this.around(home).find(p=>!this.blocked(p.x,p.y)&&!this.s.units.some(u=>Math.hypot(u.x-p.x,u.y-p.y)<.8));if(!spot)return 'Clear space beside the hearth first';if(!this.pay(COST.worker))return 'Need 25 food';const i=this.s.units.length;this.s.units.push(unit(i,spot.x,spot.y));return null;}
 tick(dt=.1){if(!Number.isFinite(dt)||dt<=0||dt>1)throw Error('Tick must be in (0,1]');this.s.time+=dt;
 for(const u of this.s.units){if(u.phase==='idle')continue;if(u.path.length){const p=u.path[0],dx=p.x-u.x,dy=p.y-u.y,d=Math.hypot(dx,dy),step=Math.min(d,dt*3);if(d){u.x+=dx/d*step;u.y+=dy/d*step;}if(d<=step+.00001)u.path.shift();continue;}
 if(u.phase==='walk'){u.order={kind:'idle'};this.start(u);continue;}
 if(u.phase==='return'){this.s.stock[u.resource]+=u.cargo;this.s.delivered[u.resource]+=u.cargo;u.cargo=0;u.resource=null;if(u.next){u.order=u.next;u.next=null;}this.start(u);continue;}
 if(u.phase==='extract'){const d=this.s.deposits.find(d=>d.id===u.order.target);if(!d||!d.amount){if(u.cargo)this.home(u);else{u.phase='idle';u.reason='Deposit exhausted — choose another';}continue;}u.work+=dt;const interval=this.s.tools?.45:.6;if(u.work+.00001>=interval){u.work-=interval;d.amount--;u.cargo++;u.resource=d.kind;if(d.amount===0)this.s.depleted++;if(u.cargo>=5||d.amount===0)this.home(u);}continue;}
 if(u.phase==='craft'){const project=this.s.knapping;if(!project||project.done||project.workshop!==u.order.target){u.order={kind:'idle'};this.start(u);continue;}project.work=Math.min(12,project.work+dt);if(project.work+.00001>=12){project.work=12;project.done=true;this.s.tools=true;for(const artisan of this.s.units)if(artisan.order.kind==='craft'){artisan.order={kind:'idle'};this.start(artisan);artisan.reason='Useful edges crafted';}}continue;}
 if(u.phase==='construct'){const b=this.s.buildings.find(b=>b.id===u.order.target);if(!b||b.done){u.order={kind:'idle'};this.start(u);continue;}b.work+=dt;if(b.work+.00001>=WORK[b.kind]){b.work=WORK[b.kind];b.done=true;u.order={kind:'idle'};this.start(u);}}
 }
 this.reveal();this.s.complete=this.s.depleted>0&&this.s.buildings.some(b=>b.kind==='outpost'&&b.done&&b.x>20)&&this.s.buildings.some(b=>b.kind==='workshop'&&b.done);
 }
 serialize(){return JSON.stringify(this.s);}
}
const API={Camp,W,H,KEY,COST,WORK,valid};if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HearthRTS=API;
})(globalThis);
