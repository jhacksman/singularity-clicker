/* Finite, deterministic RTS economy. No DOM, clocks, network or hidden production. */
(function(root){
'use strict';
const W=36,H=24,KEY='singularity-clicker.hearth-rts.v1';
const COST={outpost:{wood:60,stone:20},workshop:{wood:40,stone:30},worker:{food:25},knapping:{wood:4,stone:8}};
const WORK={outpost:24,workshop:32};
const NAMES=['Aru','Nara','Tavi','Uma','Sela','Kori','Luma','Oru'];
const RESOURCES=['wood','stone','food'],empty=()=>({wood:0,stone:0,food:0});
const isStore=b=>b.done&&['hearth','outpost'].includes(b.kind);
const storeName=b=>b.kind==='hearth'?'Hearth store':'Outpost '+b.id.slice(1)+' store';
const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
function unit(i,x,y){return{id:'u'+i,name:NAMES[i],x,y,order:{kind:'idle'},phase:'idle',cargo:0,resource:null,work:0,path:[],reason:'Ready for orders',next:null};}
function fresh(){
 const deposits=[['wood',5,6,48],['wood',10,5,48],['stone',12,10,60],['food',5,18,75],['wood',26,6,180],['wood',30,9,120],['stone',29,15,150],['food',24,19,150]].map(([kind,x,y,amount],i)=>({id:'d'+i,kind,x,y,amount,initial:amount}));
 const s={version:3,tools:false,knapping:null,time:0,stock:{wood:20,stone:10,food:0},deposits,buildings:[{id:'b0',kind:'hearth',x:7,y:11,done:true,work:0,cost:{}}],units:[unit(0,6,14),unit(1,7,14),unit(2,8,14),unit(3,9,14)],seen:[],nextId:1,spent:{wood:0,stone:0,food:0},delivered:{wood:0,stone:0,food:0},depleted:0,complete:false};return s;
}
function valid(s){
 const n=v=>Number.isFinite(v)&&v>=0&&v<1e7,point=p=>p&&n(p.x)&&n(p.y)&&p.x<W&&p.y<H;
 if(!s||![1,2,3].includes(s.version)||!n(s.time)||!n(s.nextId)||!n(s.depleted)||typeof s.complete!=='boolean')return false;
 if(!['stock','spent','delivered'].every(k=>s[k]&&['wood','stone','food'].every(r=>n(s[k][r]))))return false;
 if(!Array.isArray(s.deposits)||s.deposits.length!==8||!Array.isArray(s.units)||s.units.length<1||s.units.length>8||!Array.isArray(s.buildings)||s.buildings.length>30||!s.buildings.some(b=>b.kind==='hearth'&&b.done))return false;
 if(!Array.isArray(s.seen)||s.seen.length>W*H||s.seen.some(i=>!Number.isInteger(i)||i<0||i>=W*H))return false;
 const ids=new Set();for(const o of [...s.deposits,...s.units,...s.buildings]){if(!point(o)||typeof o.id!=='string'||ids.has(o.id))return false;ids.add(o.id);}
 if(s.deposits.some(d=>!['wood','stone','food'].includes(d.kind)||!n(d.amount)||!n(d.initial)||d.amount>d.initial))return false;
 if(s.buildings.some(b=>!['hearth','outpost','workshop'].includes(b.kind)||typeof b.done!=='boolean'||!n(b.work)||!b.cost||Object.entries(b.cost).some(([k,v])=>!['wood','stone','food'].includes(k)||!n(v))))return false;
 if(s.version>=2&&(typeof s.tools!=='boolean'||(s.knapping!==null&&(!s.knapping||!n(s.knapping.work)||s.knapping.work>12||typeof s.knapping.workshop!=='string'||!s.buildings.some(b=>b.id===s.knapping.workshop&&b.kind==='workshop'&&b.done)||typeof s.knapping.done!=='boolean'||s.knapping.done!==s.tools||s.knapping.done&&s.knapping.work!==12))))return false;
 if(s.version>=2&&s.tools&&!s.knapping)return false;
 const order=o=>o&&['idle','move','gather','build',...(s.version>=2?['craft']:[]),...(s.version===3?['transfer']:[])].includes(o.kind)&&(o.kind==='idle'||o.kind==='move'&&point(o)||['gather','build','craft','transfer'].includes(o.kind)&&typeof o.target==='string');
 if(!s.units.every(u=>typeof u.name==='string'&&u.name.length<30&&n(u.cargo)&&u.cargo<=5&&n(u.work)&&order(u.order)&&(!u.next||order(u.next))&&['idle','walk','extract','return','construct',...(s.version>=2?['craft']:[]),...(s.version===3?['pickup','transfer']:[])].includes(u.phase)&&(!u.resource||RESOURCES.includes(u.resource))&&(!u.cargo||!!u.resource)&&Array.isArray(u.path)&&u.path.length<W*H&&u.path.every(point)&&typeof u.reason==='string'&&u.reason.length<200)))return false;
 if(s.version<3)return true;
 const a=s.storage,map=v=>v&&RESOURCES.every(r=>n(v[r])),storeIds=s.buildings.filter(isStore).map(b=>b.id);
 if(!a||a.version!==1||!a.stores||!map(a.transferred)||!Number.isInteger(a.nextId)||a.nextId<1||!Array.isArray(a.transfers)||a.transfers.length>8||!a.reservations||!Array.isArray(a.payments)||a.payments.length>40)return false;
 if(Object.keys(a.stores).length!==storeIds.length||storeIds.some(id=>!map(a.stores[id]))||RESOURCES.some(r=>storeIds.reduce((sum,id)=>sum+a.stores[id][r],0)!==s.stock[r]))return false;
 const source=v=>v&&storeIds.includes(v.storeId)&&RESOURCES.includes(v.resource)&&n(v.amount)&&v.amount>0;
 if(a.payments.some(p=>!p||typeof p.kind!=='string'||typeof p.refunded!=='boolean'||!Array.isArray(p.sources)||p.sources.some(v=>!source(v))))return false;
 if(Object.entries(a.reservations).some(([id,v])=>!s.buildings.some(b=>b.id===id&&!b.done)&&!(id==='knapping'&&s.knapping&&!s.knapping.done)||!v||!Array.isArray(v.sources)||v.sources.some(p=>!source(p))))return false;
 const obligations=s.buildings.filter(b=>!b.done).map(b=>({id:b.id,cost:b.cost}));if(s.knapping&&!s.knapping.done)obligations.push({id:'knapping',cost:COST.knapping});
 if(obligations.some(o=>!a.reservations[o.id]||RESOURCES.some(r=>a.reservations[o.id].sources.filter(p=>p.resource===r).reduce((sum,p)=>sum+p.amount,0)!==(o.cost[r]||0)))||RESOURCES.some(r=>obligations.reduce((sum,o)=>sum+(o.cost[r]||0),0)>s.spent[r]))return false;
 const jobs=new Set(),held=Object.fromEntries(storeIds.map(id=>[id,empty()]));
 for(const j of a.transfers){
  if(!j||typeof j.id!=='string'||!/^t[1-9]\d*$/.test(j.id)||Number(j.id.slice(1))>=a.nextId||jobs.has(j.id)||typeof j.requested!=='string'||j.requested.length>100||!storeIds.includes(j.from)||!storeIds.includes(j.to)||j.from===j.to||!RESOURCES.includes(j.resource)||!['amount','remaining','delivered','recovered','cancelled'].every(k=>Number.isInteger(j[k])&&n(j[k]))||j.amount<1||j.amount>40||!Array.isArray(j.workers)||!j.workers.length||j.workers.length>8||new Set(j.workers).size!==j.workers.length||j.workers.some(id=>!s.units.some(u=>u.id===id))||!j.pending||Object.keys(j.pending).length!==j.workers.length||j.workers.some(id=>!Number.isInteger(j.pending[id])||j.pending[id]<0||j.pending[id]>5)||j.remaining!==j.workers.reduce((sum,id)=>sum+j.pending[id],0))return false;
  jobs.add(j.id);held[j.from][j.resource]+=j.remaining;
  const cargo=s.units.filter(u=>u.transfer===j.id).reduce((sum,u)=>sum+u.cargo,0);
  if(j.amount>5*j.workers.length||j.amount!==j.remaining+j.delivered+j.recovered+j.cancelled+cargo||j.workers.some(id=>j.pending[id]&&!s.units.some(u=>u.id===id&&(u.order.kind==='transfer'&&u.order.target===j.id||u.next&&u.next.kind==='transfer'&&u.next.target===j.id))))return false;
 }
 if(storeIds.some(id=>RESOURCES.some(r=>held[id][r]>a.stores[id][r])))return false;
 return s.units.every(u=>a.transfers.filter(j=>j.pending[u.id]>0||u.transfer===j.id).length<=1&&(!u.dropoff||storeIds.includes(u.dropoff))&&(!u.transfer||u.cargo>0&&['return','transfer','idle'].includes(u.phase)&&(u.phase!=='idle'||u.path.length===0)&&a.transfers.some(j=>j.id===u.transfer&&j.workers.includes(u.id)&&j.resource===u.resource&&j.pending[u.id]===0))&&[u.order,u.next].filter(Boolean).every(o=>o.kind!=='transfer'||a.transfers.some(j=>j.id===o.target&&j.workers.includes(u.id)))&&(u.phase!=='pickup'||u.order.kind==='transfer'&&u.cargo===0)&&(u.phase!=='transfer'||!!u.transfer));
}
class Camp{
 constructor(state){if(state&&!valid(state))throw Error('Not a compatible RTS Hearth save.');this.s=state?structuredClone(state):fresh();if(this.s.version===1){this.s.tools=false;this.s.knapping=null;}if(this.s.version<3||!this.s.storage)this.migrateStorage();this.s.version=3;this.reveal();if(!valid(this.s))throw Error('Not a compatible RTS Hearth save.');}
 migrateStorage(){
  const home=this.s.buildings.find(b=>b.kind==='hearth'&&b.done),stores=Object.fromEntries(this.s.buildings.filter(isStore).map(b=>[b.id,empty()]));stores[home.id]={...this.s.stock};
  const reservations={},sources=cost=>Object.entries(cost).filter(([,amount])=>amount>0).map(([resource,amount])=>({storeId:home.id,resource,amount}));
  for(const b of this.s.buildings.filter(b=>!b.done))reservations[b.id]={sources:sources(b.cost),legacy:true};
  if(this.s.knapping&&!this.s.knapping.done)reservations.knapping={sources:sources(COST.knapping),legacy:true};
  this.s.storage={version:1,stores,transfers:[],nextId:1,transferred:empty(),reservations,payments:[]};
 }
 syncStores(){for(const b of this.s.buildings.filter(isStore))if(!this.s.storage.stores[b.id])this.s.storage.stores[b.id]=empty();}
 syncStock(){for(const r of RESOURCES)this.s.stock[r]=Object.values(this.s.storage.stores).reduce((sum,stock)=>sum+stock[r],0);}
 stores(){
  return this.s.buildings.filter(isStore).map(b=>{const stock={...this.s.storage.stores[b.id]},reserved=empty(),incoming=empty();
   for(const j of this.s.storage.transfers)if(j.from===b.id)reserved[j.resource]+=j.remaining;
   for(const u of this.s.units)if(u.cargo&&u.dropoff===b.id)incoming[u.resource]+=u.cargo;
   return{id:b.id,name:storeName(b),kind:b.kind,x:b.x,y:b.y,stock,reserved,available:Object.fromEntries(RESOURCES.map(r=>[r,stock[r]-reserved[r]])),incoming};
  });
 }
 store(id){return this.stores().find(b=>b.id===id)||null;}
 economy(){const stores=this.stores(),available=empty(),reserved=empty(),inTransit=empty(),constructionReserved=empty();
  for(const b of stores)for(const r of RESOURCES){available[r]+=b.available[r];reserved[r]+=b.reserved[r];}
  for(const u of this.s.units)if(u.cargo)inTransit[u.resource]+=u.cargo;
  for(const v of Object.values(this.s.storage.reservations))for(const p of v.sources)constructionReserved[p.resource]+=p.amount;
  return{stored:{...this.s.stock},available,reserved,inTransit,constructionReserved,transferred:{...this.s.storage.transferred},produced:{...this.s.delivered},stores};
 }
 storageSummary(){return this.economy();}
 nearestStore(point){
  const z=point.kind==='hearth'?3:2,legal=p=>!this.blocked(p.x,p.y)&&!(p.x>=point.x&&p.x<point.x+z&&p.y>=point.y&&p.y<point.y+z),key=p=>p.y*W+p.x;
  const queue=this.around({...point,kind:point.kind||'workshop'}).filter(legal).map(p=>({...p,d:0})),seen=new Set(queue.map(key)),stores=this.s.buildings.filter(isStore).sort((a,b)=>a.id.localeCompare(b.id)),goals=stores.map(b=>({b,keys:new Set(this.around(b).filter(legal).map(key))}));
  let best=null,bestDistance=Infinity;
  for(let i=0;i<queue.length;i++){const p=queue[i];if(p.d>bestDistance)break;for(const g of goals)if(g.keys.has(key(p))&&(p.d<bestDistance||!best||g.b.id.localeCompare(best.id)<0)){best=g.b;bestDistance=p.d;}if(bestDistance!==Infinity)continue;
   for(const[dx,dy]of [[1,0],[0,1],[-1,0],[0,-1]]){const q={x:p.x+dx,y:p.y+dy,d:p.d+1};if(!seen.has(key(q))&&legal(q)){seen.add(key(q));queue.push(q);}}
  }return best;
 }
 funding(kind,x,y){
  const cost=COST[kind]||{},local=kind!=='outpost'&&kind!=='workshop'||this.s.complete;
  const b=kind==='worker'?this.s.buildings.find(b=>b.kind==='hearth'&&b.done):local?this.nearestStore({x,y,kind:kind==='knapping'?'workshop':kind}):null;
  const available=local?(b?this.store(b.id).available:empty()):this.economy().available;
  const missing=Object.fromEntries(RESOURCES.map(r=>[r,Math.max(0,(cost[r]||0)-available[r])]));
  return{mode:local?'local':'opening-pool',storeId:b?.id||null,name:local?(b?storeName(b):'No reachable store'):'Opening camp stores',cost:{...cost},available,missing,error:local&&!b?'No reachable supplying store':null};
 }
 knappingFunding(id){const b=this.s.buildings.find(b=>b.id===id&&b.kind==='workshop'&&b.done);return b?this.funding('knapping',b.x,b.y):{storeId:null,name:'No workshop',cost:{...COST.knapping},available:empty(),missing:{...empty(),...COST.knapping},error:'Finish a workshop first'};}
 shortage(q){return q.error||'Need '+Object.entries(q.missing).filter(([,n])=>n>0).map(([r,n])=>n+' '+r).join(' + ')+' at '+q.name;}
 activeTransfer(ids,from,to,resource){const key=[...new Set(ids)].sort().join(',');return this.s.storage.transfers.find(j=>j.from===from&&j.to===to&&j.resource===resource&&j.requested===key&&(j.remaining>0||this.s.units.some(u=>u.transfer===j.id)));}
 transferTargets(from,to){const source=this.s.buildings.find(b=>b.id===from&&isStore(b)),destination=this.s.buildings.find(b=>b.id===to&&isStore(b));return source&&destination?this.around(source).filter(p=>!this.blocked(p.x,p.y)&&this.path(p,this.around(destination))):[];}
 quoteTransfer(ids,from,to,resource){
  if(!Array.isArray(ids)||ids.some(id=>!this.s.units.some(u=>u.id===id)))return{from,to,resource,amount:0,workers:[],error:'Select existing villagers to carry the load'};
  const duplicate=this.activeTransfer(ids,from,to,resource);if(duplicate)return{from,to,resource,amount:duplicate.amount,workers:[...duplicate.workers],id:duplicate.id,error:null};
  const source=this.store(from),destination=this.store(to),workers=this.s.units.filter(u=>ids.includes(u.id));
  const quote={from,to,resource,amount:0,workers:[],error:null};
  if(!source||!destination||from===to)return{...quote,error:'Choose two different completed stores'};
  if(!RESOURCES.includes(resource))return{...quote,error:'Choose wood, stone or food'};
  if(!workers.length)return{...quote,error:'Select villagers to carry the load'};
  if(workers.some(u=>u.order.kind==='transfer'||u.next&&u.next.kind==='transfer'||u.transfer))return{...quote,error:'Stop the current transfer before assigning another'};
  const amount=Math.min(Math.floor(source.available[resource]),workers.length*5);
  if(!amount)return{...quote,error:'No available '+resource+' at '+source.name};
  const assigned=workers.slice(0,Math.ceil(amount/5)),targets=this.transferTargets(from,to);
  if(!targets.length||assigned.some(u=>!this.path(u,targets)))return{...quote,error:'The transfer needs a reachable path between both stores'};
  return{...quote,amount,workers:assigned.map(u=>u.id)};
 }
 transfer(ids,from,to,resource){
  const q=this.quoteTransfer(ids,from,to,resource);if(q.error)return{error:q.error};if(q.id)return{id:q.id,assigned:q.workers.length,amount:q.amount};
  const job={id:'t'+this.s.storage.nextId++,from,to,resource,amount:q.amount,remaining:q.amount,delivered:0,recovered:0,cancelled:0,workers:q.workers,requested:[...new Set(ids)].sort().join(','),pending:{}};
  let left=q.amount;for(const id of job.workers){job.pending[id]=Math.min(left,5);left-=job.pending[id];}this.s.storage.transfers.push(job);
  this.command(job.workers,{kind:'transfer',target:job.id});return{id:job.id,assigned:job.workers.length,amount:job.amount};
 }
 releaseTransfer(u){for(const o of [u.order,u.next])if(o&&o.kind==='transfer'){const j=this.s.storage.transfers.find(j=>j.id===o.target);if(j&&j.pending[u.id]){const n=j.pending[u.id];j.pending[u.id]=0;j.remaining-=n;j.cancelled+=n;}}}
 transferHome(u){const j=this.s.storage.transfers.find(j=>j.id===u.transfer),b=j&&this.s.buildings.find(b=>b.id===j.to&&isStore(b));if(!b||!this.route(u,this.around(b))){u.phase='idle';u.reason='Holding '+u.cargo+' '+u.resource+' — transfer path blocked';return false;}u.dropoff=b.id;u.phase='transfer';u.reason='Carrying '+u.cargo+' '+u.resource+' to '+storeName(b);return true;}
 pruneTransfers(){this.s.storage.transfers=this.s.storage.transfers.filter(j=>j.remaining||this.s.units.some(u=>u.transfer===j.id||[u.order,u.next].some(o=>o&&o.kind==='transfer'&&o.target===j.id)));}
 receive(u){
  const adjacent=b=>this.around(b).some(p=>Math.abs(p.x-u.x)<.001&&Math.abs(p.y-u.y)<.001);
  const b=u.dropoff?this.s.buildings.find(b=>b.id===u.dropoff&&isStore(b)&&adjacent(b)):this.s.buildings.find(b=>isStore(b)&&adjacent(b));
  if(!b){if(u.phase==='transfer')this.transferHome(u);else this.home(u);return;}
  this.syncStores();this.s.storage.stores[b.id][u.resource]+=u.cargo;this.syncStock();
  if(u.transfer){const j=this.s.storage.transfers.find(j=>j.id===u.transfer);if(b.id===j.to){j.delivered+=u.cargo;this.s.storage.transferred[u.resource]+=u.cargo;}else j.recovered+=u.cargo;delete u.transfer;}else this.s.delivered[u.resource]+=u.cargo;
  u.cargo=0;u.resource=null;delete u.dropoff;if(u.next){u.order=u.next;u.next=null;}else if(u.order.kind==='transfer')u.order={kind:'idle'};this.start(u);this.pruneTransfers();
 }
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
 home(u){const choices=this.s.buildings.filter(isStore).map(b=>({b,path:this.path(u,this.freeTargets(u,this.around(b)))})).filter(v=>v.path).sort((a,b)=>a.path.length-b.path.length);if(!choices.length){u.phase='idle';u.reason='Drop-off blocked or crowded — clear space';u.path=[];return false;}u.dropoff=choices[0].b.id;u.path=choices[0].path;u.phase='return';u.reason='Returning '+u.cargo+' '+u.resource+' to '+storeName(choices[0].b);return true;}
 start(u){u.work=0;u.path=[];const o=u.order;if(o.kind==='idle'){u.phase='idle';u.reason='Ready for orders';return;}
 if(o.kind==='move'){if(this.route(u,[o])){u.phase='walk';u.reason='Moving';}return;}
 if(o.kind==='transfer'){
  const job=this.s.storage.transfers.find(j=>j.id===o.target),source=job&&this.s.buildings.find(b=>b.id===job.from&&isStore(b));
  if(!job||!job.pending[u.id]||!source){u.order={kind:'idle'};u.phase='idle';u.reason='Transfer complete';return;}
  if(this.route(u,this.transferTargets(job.from,job.to))){u.phase='pickup';u.reason='Collect '+job.pending[u.id]+' '+job.resource+' from '+storeName(source);}return;
 }
 const target=(o.kind==='gather'?this.s.deposits:this.s.buildings).find(v=>v.id===o.target);
 if(o.kind==='craft'&&(!this.s.knapping||this.s.knapping.workshop!==o.target||this.s.knapping.done)){u.phase='idle';u.reason=this.s.tools?'Toolset complete':'No active knapping project';return;}
 if(!target||o.kind==='gather'&&target.amount===0||o.kind==='build'&&target.done){u.phase='idle';u.reason=o.kind==='gather'?'Deposit exhausted — choose another':'Construction complete';return;}
 if(this.route(u,this.around(target))){u.phase=o.kind==='gather'?'extract':o.kind==='craft'?'craft':'construct';u.reason=o.kind==='gather'?'Gathering '+target.kind:o.kind==='craft'?'Knapping tools':'Building '+target.kind;}
 }
 accepts(u,o){
  if(!o||!['idle','move','gather','build','craft','transfer'].includes(o.kind))return false;if(o.kind==='idle')return true;
  if(o.kind==='move')return Number.isInteger(o.x)&&Number.isInteger(o.y)&&!!this.path(u,[o]);
  if(o.kind==='transfer'){const j=this.s.storage.transfers.find(j=>j.id===o.target&&j.pending[u.id]>0);return !!j&&!!this.path(u,this.transferTargets(j.from,j.to));}
  const target=(o.kind==='gather'?this.s.deposits:this.s.buildings).find(v=>v.id===o.target);
  if(!target||o.kind==='gather'&&!target.amount||o.kind==='build'&&target.done||o.kind==='craft'&&(!this.s.knapping||this.s.knapping.done||this.s.knapping.workshop!==o.target))return false;
  return !!this.path(u,this.around(target));
 }
 command(ids,order){if(!Array.isArray(ids)||ids.some(id=>!this.s.units.some(u=>u.id===id)))return 0;const workers=this.s.units.filter(u=>ids.includes(u.id)),changing=workers.filter(u=>!(JSON.stringify(u.next||u.order)===JSON.stringify(order)&&u.phase!=='idle'));if(changing.some(u=>!this.accepts(u,order)))return 0;
  let count=0;for(const u of changing){count++;this.releaseTransfer(u);if(u.cargo){u.next=structuredClone(order);this.home(u);}else{u.order=structuredClone(order);u.next=null;this.start(u);}}this.pruneTransfers();return count;
 }
 canPay(cost,storeId=null){const available=storeId?this.store(storeId)?.available:this.economy().available;return !!available&&Object.entries(cost).every(([r,n])=>available[r]>=n);}
 pay(cost,storeId=null,kind='expense',target=null){
  if(!this.canPay(cost,storeId))return false;const sources=[],stores=this.stores().filter(b=>!storeId||b.id===storeId);
  for(const[r,total]of Object.entries(cost)){let left=total;for(const b of stores){const amount=Math.min(left,b.available[r]);if(!amount)continue;this.s.storage.stores[b.id][r]-=amount;sources.push({storeId:b.id,resource:r,amount});left-=amount;}this.s.spent[r]+=total;}this.syncStock();
  this.s.storage.payments.push({kind,target,sources,refunded:false});return{sources};
 }
 placement(kind,x,y){if(!WORK[kind])return 'Unknown structure';if(this.s.buildings.length>=30)return 'Camp structure limit reached';if(!this.visible(x,y))return 'Scout this ground first';for(let dx=0;dx<2;dx++)for(let dy=0;dy<2;dy++)if(this.blocked(x+dx,y+dy)||this.s.units.some(u=>Math.abs(u.x-x-dx)<.65&&Math.abs(u.y-y-dy)<.65))return 'Choose clear ground';const q=this.funding(kind,x,y);if(q.error||!this.canPay(COST[kind],q.storeId))return this.shortage(q);return null;}
 build(kind,x,y,ids){const error=this.placement(kind,x,y);if(error)return {error};const funding=this.funding(kind,x,y),b={id:'b'+this.s.nextId,kind,x,y,done:false,work:0,cost:{...COST[kind]}};this.s.buildings.push(b);
 // Preserve access to every worker and deposit; no irreversible choke-point seals.
 const home=this.s.buildings.find(v=>v.kind==='hearth');const targets=[...this.s.units,...this.s.deposits.filter(d=>d.amount>0).flatMap(d=>this.around(d).filter(p=>!this.blocked(p.x,p.y)).slice(0,1))];
 if(targets.some(p=>!this.path(p,this.around(home)))||!this.around(b).some(p=>!this.blocked(p.x,p.y)&&this.path(p,this.around(home)))||this.s.buildings.filter(isStore).some(store=>!this.around(store).some(p=>!this.blocked(p.x,p.y)&&this.path(p,this.around(home))))){this.s.buildings.pop();return {error:'Leave a route through the camp and to every store'};}
 this.s.nextId++;this.s.storage.reservations[b.id]=this.pay(b.cost,funding.storeId,'construction',b.id);for(const u of this.s.units)if(u.path.length){if(u.transfer&&u.phase==='transfer')this.transferHome(u);else if(u.cargo)this.home(u);else this.start(u);}this.command(ids,{kind:'build',target:b.id});return {id:b.id};}
 cancel(id){const b=this.s.buildings.find(v=>v.id===id&&!v.done);if(!b)return false;const reservation=this.s.storage.reservations[id];
  for(const p of reservation.sources){this.s.storage.stores[p.storeId][p.resource]+=p.amount;this.s.spent[p.resource]-=p.amount;}this.syncStock();
  delete this.s.storage.reservations[id];this.s.storage.payments=this.s.storage.payments.filter(p=>!(p.kind==='construction'&&p.target===id));
  this.s.buildings=this.s.buildings.filter(v=>v.id!==id);for(const u of this.s.units){if(u.next&&u.next.target===id)u.next={kind:'idle'};if(u.order.target===id){u.order={kind:'idle'};if(u.cargo)this.home(u);else this.start(u);}}return true;
 }
 beginKnapping(workshop,ids){const b=this.s.buildings.find(b=>b.id===workshop&&b.kind==='workshop'&&b.done);if(!b)return 'Finish a workshop first';if(!Array.isArray(ids)||!ids.length||ids.some(id=>!this.s.units.some(u=>u.id===id)))return 'Select villagers to craft the tools';if(ids.some(id=>!this.path(this.s.units.find(u=>u.id===id),this.around(b))))return 'Selected villagers need a reachable path to the workshop';if(this.s.tools)return 'Useful edges already crafted';if(this.s.knapping&&this.s.knapping.workshop!==workshop)return 'Resume the project at its original workshop';if(!this.s.knapping){const q=this.knappingFunding(workshop);if(q.error||!this.canPay(COST.knapping,q.storeId))return this.shortage(q);this.s.storage.reservations.knapping=this.pay(COST.knapping,q.storeId,'knapping',workshop);this.s.knapping={workshop,work:0,done:false};}this.command(ids,{kind:'craft',target:workshop});return null;}
 train(){if(this.s.units.length>=8)return 'All eight villagers have joined';const home=this.s.buildings.find(b=>b.kind==='hearth'),spot=this.around(home).find(p=>!this.blocked(p.x,p.y)&&!this.s.units.some(u=>Math.hypot(u.x-p.x,u.y-p.y)<.8)&&this.s.units.some(u=>this.path(u,[p])));if(!spot)return 'Clear reachable space beside the hearth first';if(!this.pay(COST.worker,home.id,'recruitment'))return this.shortage(this.funding('worker',home.x,home.y));const i=this.s.units.length;this.s.units.push(unit(i,spot.x,spot.y));return null;}
 tick(dt=.1){if(!Number.isFinite(dt)||dt<=0||dt>1)throw Error('Tick must be in (0,1]');this.s.time+=dt;
 for(const u of this.s.units){if(u.phase==='idle')continue;if(u.path.length){const p=u.path[0],dx=p.x-u.x,dy=p.y-u.y,d=Math.hypot(dx,dy),step=Math.min(d,dt*3);if(d){u.x+=dx/d*step;u.y+=dy/d*step;}if(d<=step+.00001)u.path.shift();continue;}
 if(u.phase==='walk'){u.order={kind:'idle'};this.start(u);continue;}
 if(u.phase==='return'||u.phase==='transfer'){this.receive(u);continue;}
 if(u.phase==='pickup'){
  const j=this.s.storage.transfers.find(j=>j.id===u.order.target),amount=j&&j.pending[u.id];
  if(!amount){u.order={kind:'idle'};this.start(u);this.pruneTransfers();continue;}
  const source=this.s.buildings.find(b=>b.id===j.from&&isStore(b));
  if(!source||!this.around(source).some(p=>Math.abs(p.x-u.x)<.001&&Math.abs(p.y-u.y)<.001)){this.start(u);continue;}
  this.s.storage.stores[j.from][j.resource]-=amount;this.syncStock();j.pending[u.id]=0;j.remaining-=amount;u.cargo=amount;u.resource=j.resource;u.transfer=j.id;this.transferHome(u);continue;
 }
 if(u.phase==='extract'){const d=this.s.deposits.find(d=>d.id===u.order.target);if(!d||!d.amount){if(u.cargo)this.home(u);else{u.phase='idle';u.reason='Deposit exhausted — choose another';}continue;}u.work+=dt;const interval=this.s.tools?.45:.6;if(u.work+.00001>=interval){u.work-=interval;d.amount--;u.cargo++;u.resource=d.kind;if(d.amount===0)this.s.depleted++;if(u.cargo>=5||d.amount===0)this.home(u);}continue;}
 if(u.phase==='craft'){const project=this.s.knapping;if(!project||project.done||project.workshop!==u.order.target){u.order={kind:'idle'};this.start(u);continue;}project.work=Math.min(12,project.work+dt);if(project.work+.00001>=12){project.work=12;project.done=true;this.s.tools=true;delete this.s.storage.reservations.knapping;for(const artisan of this.s.units)if(artisan.order.kind==='craft'){artisan.order={kind:'idle'};this.start(artisan);artisan.reason='Useful edges crafted';}}continue;}
 if(u.phase==='construct'){const b=this.s.buildings.find(b=>b.id===u.order.target);if(!b||b.done){u.order={kind:'idle'};this.start(u);continue;}b.work+=dt;if(b.work+.00001>=WORK[b.kind]){b.work=WORK[b.kind];b.done=true;delete this.s.storage.reservations[b.id];this.syncStores();u.order={kind:'idle'};this.start(u);}}
 }
 this.reveal();this.s.complete=this.s.depleted>0&&this.s.buildings.some(b=>b.kind==='outpost'&&b.done&&b.x>20)&&this.s.buildings.some(b=>b.kind==='workshop'&&b.done);
 }
 serialize(){return JSON.stringify(this.s);}
}
const API={Camp,W,H,KEY,COST,WORK,valid};if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HearthRTS=API;
})(globalThis);
