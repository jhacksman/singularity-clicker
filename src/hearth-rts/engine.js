/* Finite, deterministic RTS economy. No DOM, clocks, network or hidden production. */
(function(root){
'use strict';
const W=36,H=24,KEY='singularity-clicker.hearth-rts.v1';
const COST={outpost:{wood:60,stone:20},workshop:{wood:40,stone:30},worker:{food:25},knapping:{wood:4,stone:8}};
const WORK={outpost:24,workshop:32};
const NAMES=['Aru','Nara','Tavi','Uma','Sela','Kori','Luma','Oru'];
const RESOURCES=['wood','stone','food'],empty=()=>({wood:0,stone:0,food:0});
const CONSTRUCTION_PROFILE='accepted-opening.physical-construction.v1';
const physicalSite=(s,id)=>s.version===6&&s.construction?.sites?.find(c=>c.buildingId===id)||null;
const isStore=b=>b.done&&!b.retiring&&['hearth','outpost'].includes(b.kind);
const storeName=b=>b.kind==='hearth'?'Hearth store':'Outpost '+b.id.slice(1)+' store';
const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
function unit(i,x,y){return{id:'u'+i,name:NAMES[i],x,y,order:{kind:'idle'},phase:'idle',cargo:0,resource:null,work:0,path:[],reason:'Ready for orders',next:null};}
function fresh(){
 const deposits=[['wood',5,6,48],['wood',10,5,48],['stone',12,10,60],['food',5,18,75],['wood',26,6,180],['wood',30,9,120],['stone',29,15,150],['food',24,19,150]].map(([kind,x,y,amount],i)=>({id:'d'+i,kind,x,y,amount,initial:amount}));
 const s={version:4,tools:false,knapping:null,time:0,stock:{wood:20,stone:10,food:0},deposits,buildings:[{id:'b0',kind:'hearth',x:7,y:11,done:true,work:0,cost:{}}],units:[unit(0,6,14),unit(1,7,14),unit(2,8,14),unit(3,9,14)],seen:[],nextId:1,spent:{wood:0,stone:0,food:0},delivered:{wood:0,stone:0,food:0},depleted:0,complete:false};return s;
}
function validCarryMove(s,u){
 const clear=p=>Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.y>=0&&p.x<W&&p.y<H&&!((p.x===18||p.x===19)&&!(p.y>=11&&p.y<=14))&&!s.deposits.some(d=>d.amount>0&&d.x===p.x&&d.y===p.y)&&!s.buildings.some(b=>p.x>=b.x&&p.x<b.x+(b.kind==='hearth'?3:2)&&p.y>=b.y&&p.y<b.y+(b.kind==='hearth'?3:2));
 if(![4,5,6].includes(s.version)||u.cargo<=0||u.order.kind!=='move'||u.next!==null||u.dropoff!==undefined||!clear(u.order))return false;
 if(!u.path.length)return u.x===u.order.x&&u.y===u.order.y;
 const first=u.path[0],last=u.path.at(-1);return clear(first)&&dist({x:Math.round(u.x),y:Math.round(u.y)},first)<=1&&last.x===u.order.x&&last.y===u.order.y&&u.path.every((p,i)=>clear(p)&&(!i||dist(u.path[i-1],p)===1));
}
function valid(s){
 if(s&&s.version<6&&(s.construction!==undefined||Array.isArray(s.buildings)&&s.buildings.some(b=>b?.supplyProfile!==undefined)||Array.isArray(s.units)&&s.units.some(u=>u?.supply!==undefined||u?.supplyPickup!==undefined)))return valid(withoutConstructionAuthority(s));
 if(s&&s.version<5&&(s.reclaim!==undefined||Array.isArray(s.buildings)&&s.buildings.some(b=>b?.retiring!==undefined)||Array.isArray(s.units)&&s.units.some(u=>u?.reclaim!==undefined)))return valid(withoutReclaimAuthority(s));
 const n=v=>Number.isFinite(v)&&v>=0&&v<1e7,point=p=>p&&n(p.x)&&n(p.y)&&p.x<W&&p.y<H;
 if(!s||![1,2,3,4,5,6].includes(s.version)||!n(s.time)||!n(s.nextId)||!n(s.depleted)||typeof s.complete!=='boolean')return false;
 if(s.version===6&&(!s.construction||s.construction.profile!==CONSTRUCTION_PROFILE||!Array.isArray(s.construction.sites)||s.construction.sites.length>29||s.construction.sites.some(c=>!c||typeof c.buildingId!=='string')))return false;
 if(!['stock','spent','delivered'].every(k=>s[k]&&['wood','stone','food'].every(r=>n(s[k][r]))))return false;
 if(!Array.isArray(s.deposits)||s.deposits.length!==8||!Array.isArray(s.units)||s.units.length<1||s.units.length>8||!Array.isArray(s.buildings)||s.buildings.length>30||!s.buildings.some(b=>b.kind==='hearth'&&b.done))return false;
 if(!Array.isArray(s.seen)||s.seen.length>W*H||s.seen.some(i=>!Number.isInteger(i)||i<0||i>=W*H))return false;
 const ids=new Set();for(const o of [...s.deposits,...s.units,...s.buildings]){if(!point(o)||typeof o.id!=='string'||ids.has(o.id))return false;ids.add(o.id);}
 if(s.deposits.some(d=>!['wood','stone','food'].includes(d.kind)||!n(d.amount)||!n(d.initial)||d.amount>d.initial))return false;
 if(s.buildings.some(b=>!['hearth','outpost','workshop'].includes(b.kind)||typeof b.done!=='boolean'||!n(b.work)||!b.cost||Object.entries(b.cost).some(([k,v])=>!['wood','stone','food'].includes(k)||!n(v))))return false;
 if(s.version>=2&&(typeof s.tools!=='boolean'||(s.knapping!==null&&(!s.knapping||!n(s.knapping.work)||s.knapping.work>12||typeof s.knapping.workshop!=='string'||!s.buildings.some(b=>b.id===s.knapping.workshop&&b.kind==='workshop'&&b.done)||typeof s.knapping.done!=='boolean'||s.knapping.done!==s.tools||s.knapping.done&&s.knapping.work!==12))))return false;
 if(s.version>=2&&s.tools&&!s.knapping)return false;
 const order=o=>o&&['idle','move','gather','build',...(s.version>=2?['craft']:[]),...(s.version>=3?['transfer']:[]),...(s.version>=5?['reclaim']:[])].includes(o.kind)&&(o.kind==='idle'||o.kind==='move'&&point(o)||['gather','build','craft','transfer','reclaim'].includes(o.kind)&&typeof o.target==='string');
 if(!s.units.every(u=>typeof u.name==='string'&&u.name.length<30&&n(u.cargo)&&u.cargo<=5&&n(u.work)&&order(u.order)&&(!u.next||order(u.next))&&['idle','walk','extract','return','construct',...(s.version>=2?['craft']:[]),...(s.version>=3?['pickup','transfer']:[]),...(s.version>=4?['carryMove']:[]),...(s.version>=5?['reclaimPickup']:[]),...(s.version===6?['supplyPickup','supplyDeliver','siteRecovery']:[])].includes(u.phase)&&(!u.resource||RESOURCES.includes(u.resource))&&(!u.cargo||!!u.resource)&&Array.isArray(u.path)&&u.path.length<W*H&&u.path.every(point)&&typeof u.reason==='string'&&u.reason.length<200))return false;
 if(s.version<3)return true;
 const a=s.storage,map=v=>v&&RESOURCES.every(r=>n(v[r])),storeIds=s.buildings.filter(isStore).map(b=>b.id);
 if(!a||a.version!==1||!a.stores||!map(a.transferred)||!Number.isInteger(a.nextId)||a.nextId<1||!Array.isArray(a.transfers)||a.transfers.length>8||!a.reservations||!Array.isArray(a.payments)||a.payments.length>40)return false;
 if(Object.keys(a.stores).length!==storeIds.length||storeIds.some(id=>!map(a.stores[id]))||RESOURCES.some(r=>storeIds.reduce((sum,id)=>sum+a.stores[id][r],0)!==s.stock[r]))return false;
 const source=v=>v&&storeIds.includes(v.storeId)&&RESOURCES.includes(v.resource)&&n(v.amount)&&v.amount>0;
 if(a.payments.some(p=>!p||typeof p.kind!=='string'||typeof p.refunded!=='boolean'||!Array.isArray(p.sources)||p.sources.some(v=>!source(v))))return false;
 if(Object.entries(a.reservations).some(([id,v])=>!s.buildings.some(b=>b.id===id&&!b.done)&&!(id==='knapping'&&s.knapping&&!s.knapping.done)||!v||!Array.isArray(v.sources)||v.sources.some(p=>!source(p))))return false;
 const obligations=s.buildings.filter(b=>!b.done&&!physicalSite(s,b.id)).map(b=>({id:b.id,cost:b.cost}));if(s.knapping&&!s.knapping.done)obligations.push({id:'knapping',cost:COST.knapping});
 if(obligations.some(o=>!a.reservations[o.id]||RESOURCES.some(r=>a.reservations[o.id].sources.filter(p=>p.resource===r).reduce((sum,p)=>sum+p.amount,0)!==(o.cost[r]||0)))||RESOURCES.some(r=>obligations.reduce((sum,o)=>sum+(o.cost[r]||0),0)>s.spent[r]))return false;
 const jobs=new Set(),held=Object.fromEntries(storeIds.map(id=>[id,empty()]));
 for(const j of a.transfers){
  if(!j||typeof j.id!=='string'||!/^t[1-9]\d*$/.test(j.id)||Number(j.id.slice(1))>=a.nextId||jobs.has(j.id)||typeof j.requested!=='string'||j.requested.length>100||!storeIds.includes(j.from)||!storeIds.includes(j.to)||j.from===j.to||!RESOURCES.includes(j.resource)||!['amount','remaining','delivered','recovered','cancelled'].every(k=>Number.isInteger(j[k])&&n(j[k]))||j.amount<1||j.amount>40||!Array.isArray(j.workers)||!j.workers.length||j.workers.length>8||new Set(j.workers).size!==j.workers.length||j.workers.some(id=>!s.units.some(u=>u.id===id))||!j.pending||Object.keys(j.pending).length!==j.workers.length||j.workers.some(id=>!Number.isInteger(j.pending[id])||j.pending[id]<0||j.pending[id]>5)||j.remaining!==j.workers.reduce((sum,id)=>sum+j.pending[id],0))return false;
  jobs.add(j.id);held[j.from][j.resource]+=j.remaining;
  const cargo=s.units.filter(u=>u.transfer===j.id).reduce((sum,u)=>sum+u.cargo,0);
  if(j.amount>5*j.workers.length||j.amount!==j.remaining+j.delivered+j.recovered+j.cancelled+cargo||j.workers.some(id=>j.pending[id]&&!s.units.some(u=>u.id===id&&(u.order.kind==='transfer'&&u.order.target===j.id||u.next&&u.next.kind==='transfer'&&u.next.target===j.id))))return false;
 }
 if(storeIds.some(id=>RESOURCES.some(r=>held[id][r]>a.stores[id][r])))return false;
 return s.units.every(u=>a.transfers.filter(j=>j.pending[u.id]>0||u.transfer===j.id).length<=1&&(!u.dropoff||storeIds.includes(u.dropoff))&&(!u.transfer||u.cargo>0&&['return','transfer','idle',...(s.version>=4?['carryMove']:[])].includes(u.phase)&&(u.phase!=='idle'||u.path.length===0)&&a.transfers.some(j=>j.id===u.transfer&&j.workers.includes(u.id)&&j.resource===u.resource&&j.pending[u.id]===0))&&[u.order,u.next].filter(Boolean).every(o=>o.kind!=='transfer'||a.transfers.some(j=>j.id===o.target&&j.workers.includes(u.id)))&&(u.phase!=='pickup'||u.order.kind==='transfer'&&u.cargo===0)&&(u.phase!=='transfer'||!!u.transfer)&&(u.phase!=='carryMove'||validCarryMove(s,u)))&&(s.version!==6||validConstruction(s))&&(s.version<5||validReclaim(s));
}
const RECLAIM_PROFILE='accepted-opening.outpost-reclaim.v1',LIMIT=10000000;
const canonicalDeposits=[['wood',5,6,48],['wood',10,5,48],['stone',12,10,60],['food',5,18,75],['wood',26,6,180],['wood',30,9,120],['stone',29,15,150],['food',24,19,150]];
const integer=v=>Number.isInteger(v)&&v>=0&&v<LIMIT;
const vector=v=>v&&RESOURCES.every(r=>integer(v[r]))&&Object.keys(v).every(r=>RESOURCES.includes(r));
const sameCost=(a,b)=>a&&Object.keys(a).every(r=>RESOURCES.includes(r))&&RESOURCES.every(r=>integer(a[r]||0)&&(a[r]||0)===(b[r]||0));
function withoutReclaimAuthority(s){const copy=structuredClone(s);delete copy.reclaim;if(Array.isArray(copy.buildings))for(const b of copy.buildings)if(b&&typeof b==='object')delete b.retiring;if(Array.isArray(copy.units))for(const u of copy.units)if(u&&typeof u==='object')delete u.reclaim;return copy;}
function withoutConstructionAuthority(s){const copy=structuredClone(s);delete copy.construction;if(Array.isArray(copy.buildings))for(const b of copy.buildings)if(b&&typeof b==='object')delete b.supplyProfile;if(Array.isArray(copy.units))for(const u of copy.units)if(u&&typeof u==='object'){delete u.supply;delete u.supplyPickup;}return copy;}
const originKey=p=>[p.storeId,p.kind,p.x,p.y,p.resource].join(':');
function validOrigin(s,p){return p&&typeof p.storeId==='string'&&/^b(?:0|[1-9]\d*)$/.test(p.storeId)&&Number(p.storeId.slice(1))<s.nextId&&['hearth','outpost'].includes(p.kind)&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.x<W&&p.y>=0&&p.y<H&&RESOURCES.includes(p.resource)&&integer(p.amount)&&p.amount>0;}
function validConstruction(s){
 const ledger=s.construction,ids=new Set(),reserved=new Map(Object.keys(s.storage.stores).map(id=>[id,empty()]));
 // Current allocations require exact live identities. Historical origins remain snapshots.
 const liveStore=id=>typeof id==='string'&&Object.hasOwn(s.storage.stores,id)&&s.buildings.some(b=>b.id===id&&isStore(b));
 for(const b of s.buildings)if(b.supplyProfile!==undefined&&(b.supplyProfile!==CONSTRUCTION_PROFILE||b.kind==='hearth'||!b.done&&!physicalSite(s,b.id)))return false;
 for(const c of ledger.sites){
  const b=s.buildings.find(b=>b.id===c.buildingId);
  if(!b||b.done||b.retiring||b.supplyProfile!==CONSTRUCTION_PROFILE||ids.has(b.id)||!['active','cancelling'].includes(c.state)||!vector(c.staged)||!vector(c.released)||!vector(c.returned)||!Array.isArray(c.sources)||c.sources.length>90||!Array.isArray(c.origins)||c.origins.length>90||b.work>=WORK[b.kind]||s.storage.reservations[b.id]||s.storage.payments.some(p=>p.kind==='construction'&&p.target===b.id))return false;
  ids.add(b.id);const keys=new Set(),origins=new Set();
  for(const p of c.sources){if(!p||!liveStore(p.storeId)||!RESOURCES.includes(p.resource)||!integer(p.amount)||!p.amount||keys.has(p.storeId+':'+p.resource))return false;keys.add(p.storeId+':'+p.resource);reserved.get(p.storeId)[p.resource]+=p.amount;}
  for(const p of c.origins){if(!validOrigin(s,p)||origins.has(originKey(p)))return false;origins.add(originKey(p));}
  const cargo=r=>s.units.filter(u=>u.supply?.siteId===b.id&&u.resource===r).reduce((n,u)=>n+u.cargo,0);
  if(RESOURCES.some(r=>c.sources.filter(p=>p.resource===r).reduce((n,p)=>n+p.amount,0)+c.staged[r]+cargo(r)+c.released[r]+c.returned[r]!== (COST[b.kind][r]||0)))return false;
  if(RESOURCES.some(r=>c.origins.filter(p=>p.resource===r).reduce((n,p)=>n+p.amount,0)!==c.staged[r]))return false;
  if(c.state==='active'&&(RESOURCES.some(r=>c.released[r]||c.returned[r])||b.work>0&&!sameCost(c.staged,b.cost))||c.state==='cancelling'&&c.sources.length)return false;
 }
 for(const j of s.storage.transfers)reserved.get(j.from)[j.resource]+=j.remaining;
 if([...reserved].some(([id,v])=>RESOURCES.some(r=>v[r]>s.storage.stores[id][r])))return false;
 return s.units.every(u=>{
  const c=u.supply&&physicalSite(s,u.supply.siteId),p=u.supplyPickup,q=p&&physicalSite(s,p.siteId),orderSite=u.order.kind==='build'&&physicalSite(s,u.order.target);
  if(u.supply!==undefined&&(!c||!u.cargo||u.transfer||u.reclaim||p||!['supplyDeliver','return','carryMove','idle'].includes(u.phase)||u.phase==='idle'&&u.path.length))return false;
  if(c&&!(u.supply.origin===null&&c.state==='cancelling'||validOrigin(s,u.supply.origin)&&u.supply.origin.resource===u.resource&&u.supply.origin.amount===u.cargo))return false;
  if(u.phase==='supplyDeliver'&&(!c||c.state!=='active'||!orderSite||orderSite!==c||u.next||u.dropoff!==undefined))return false;
  if(p!==undefined&&(!q||q.state!=='active'||u.phase!=='supplyPickup'||u.cargo||u.transfer||u.reclaim||u.next||u.dropoff!==undefined||orderSite!==q||!liveStore(p.storeId)||!RESOURCES.includes(p.resource)||!COST[s.buildings.find(b=>b.id===q.buildingId).kind][p.resource]))return false;
  if(u.phase==='supplyPickup'&&!p)return false;
  if(u.phase==='siteRecovery'&&(!orderSite||orderSite.state!=='cancelling'||u.cargo||u.next||u.dropoff!==undefined||p))return false;
  if(orderSite&&u.phase==='construct'&&(orderSite.state!=='active'||u.cargo||u.next||u.dropoff!==undefined||p))return false;
  return true;
 });
}
function canonicalReason(s){
 if(s.units.length<4||s.units.some((u,i)=>u.id!=='u'+i||!integer(u.cargo)))return 'The original four to eight villagers and integer cargo are required';
 if(!integer(s.nextId)||s.nextId<1||s.buildings.some(b=>!/^b(?:0|[1-9]\d*)$/.test(b.id)||Number(b.id.slice(1))>=s.nextId||!Number.isInteger(b.x)||!Number.isInteger(b.y)))return 'Building identities or the next identity are outside the canonical profile';
 if(s.buildings.filter(b=>b.kind==='hearth').length!==1||!s.buildings.some(b=>b.id==='b0'&&b.kind==='hearth'&&b.done&&b.x===7&&b.y===11&&sameCost(b.cost,{})))return 'The original free hearth must be b0 at 7, 11';
 if(s.buildings.some(b=>b.kind!=='hearth'&&(b.id==='b0'||!sameCost(b.cost,COST[b.kind]))))return 'A structure has a noncanonical material bill';
 if(canonicalDeposits.some(([kind,x,y,initial],i)=>!s.deposits.some(d=>d.id==='d'+i&&d.kind===kind&&d.x===x&&d.y===y&&d.initial===initial&&integer(d.amount)&&d.amount<=initial)))return 'A finite source differs from the canonical map';
 if(!['stock','spent','delivered'].every(k=>vector(s[k]))||!integer(s.depleted))return 'Material counters must be bounded integers';
 if(s.storage&&(!integer(s.storage.nextId)||s.storage.nextId<1||!vector(s.storage.transferred)||Object.values(s.storage.stores).some(v=>!vector(v))||s.storage.payments.some(p=>p.sources.some(v=>!integer(v.amount)))||Object.values(s.storage.reservations).some(v=>v.sources.some(p=>!integer(p.amount)))))return 'Store identities, payment and refundable-source materials must be bounded integers';
 if(s.storage&&RESOURCES.some(r=>s.storage.transferred[r]+s.storage.transfers.filter(j=>j.resource===r).reduce((n,j)=>n+j.remaining+s.units.filter(u=>u.transfer===j.id).reduce((m,u)=>m+u.cargo,0),0)>=LIMIT))return 'Transfer counters lack room for existing reserved and carried loads';
 if(s.depleted+s.deposits.filter(d=>d.amount>0).length>=LIMIT||RESOURCES.some(r=>s.delivered[r]+s.deposits.filter(d=>d.kind===r).reduce((n,d)=>n+d.amount,0)+s.units.filter(u=>u.resource===r&&!u.transfer&&!u.reclaim&&!u.supply).reduce((n,u)=>n+u.cargo,0)>=LIMIT))return 'Gathering counters lack room for the remaining finite resources';
 const totals={wood:416,stone:220,food:225};
 if(RESOURCES.some(r=>s.stock[r]+s.spent[r]+s.units.filter(u=>u.resource===r).reduce((n,u)=>n+u.cargo,0)+(s.version===6?s.construction.sites.reduce((n,c)=>n+c.staged[r],0):0)+s.deposits.filter(d=>d.kind===r).reduce((n,d)=>n+d.amount,0)!==totals[r]))return 'The declared world does not conserve the original finite material budget';
 return null;
}
function paidVector(s,claims=null){const total=empty();for(const b of s.buildings){const cost=b.kind==='hearth'||physicalSite(s,b.id)?{}:b.kind==='outpost'&&claims?claims.find(c=>c.buildingId===b.id)?.unreleased:COST[b.kind];if(!cost)return null;for(const r of RESOURCES)total[r]+=cost[r]||0;}if(s.version>=2&&s.knapping)for(const r of RESOURCES)total[r]+=COST.knapping[r]||0;total.food+=25*(s.units.length-4);return total;}
function paymentReason(s){
 const seen=new Set();let recruits=0;
 for(const p of s.storage?.payments||[]){
  let bill;if(p.kind==='construction'){const b=s.buildings.find(b=>b.id===p.target&&b.kind!=='hearth');if(!b)return 'A payment names no paid structure';bill=COST[b.kind];}
  else if(p.kind==='knapping'){if(s.version<2||!s.knapping||p.target!==s.knapping.workshop)return 'A payment names no paid tool project';bill=COST.knapping;}
  else if(p.kind==='recruitment'){if(p.target!==null||++recruits>s.units.length-4)return 'Recruitment payment assertions exceed joined villagers';bill=COST.worker;}
  else return 'An asserted payment has no canonical recipe';
  if(p.refunded||RESOURCES.some(r=>p.sources.filter(v=>v.resource===r).reduce((n,v)=>n+v.amount,0)!==(bill[r]||0)))return 'An asserted payment differs from its canonical bill';
  const reservation=p.kind==='construction'?s.storage.reservations[p.target]:p.kind==='knapping'?s.storage.reservations.knapping:null;
  if(reservation){const keys=new Set([...p.sources,...reservation.sources].map(v=>v.storeId+':'+v.resource));if([...keys].some(key=>p.sources.filter(v=>v.storeId+':'+v.resource===key).reduce((n,v)=>n+v.amount,0)!==reservation.sources.filter(v=>v.storeId+':'+v.resource===key).reduce((n,v)=>n+v.amount,0)))return 'An asserted payment conflicts with its refundable source reservation';}
  if(p.kind!=='recruitment'){const key=p.kind+':'+p.target;if(seen.has(key))return 'Duplicate payment assertions cannot certify capital';seen.add(key);}
 }
 return null;
}
function certifyLegacy(state){
 if(!state||![1,2,3,4].includes(state.version)||!valid(state))return{ok:false,reason:'The source is not a supported legacy camp'};
 const s=withoutReclaimAuthority(withoutConstructionAuthority(state));if(s.version===1){s.tools=false;s.knapping=null;}if(s.version<3)delete s.storage;
 const reason=canonicalReason(s)||paymentReason(s),paid=paidVector(s);
 if(reason)return{ok:false,reason};
 if(RESOURCES.some(r=>paid[r]!==s.spent[r]))return{ok:false,reason:'Spent materials do not match extant paid structures, tools and recruits'};
 return{ok:true,reason:null};
}
// A bounded diagnostic fingerprint; exact source bytes are retained by the controller.
// It is not a cryptographic identity, authentication or a history proof.
function sourceLabel(s){let h=2166136261;for(const c of JSON.stringify(s))h=Math.imul(h^c.charCodeAt(0),16777619);return 'canonical-v'+s.version+'-snapshot-'+(h>>>0).toString(16).padStart(8,'0');}
function validReclaim(s){
 const a=s.reclaim;if(!a||a.profile!==RECLAIM_PROFILE||typeof a.sourceIdentity!=='string'||a.sourceIdentity.length>100||!Array.isArray(a.claims)||a.claims.length>29||!vector(a.recovered)||!vector(a.settled)||!integer(a.settledSites)||!integer(a.closedPayments)||canonicalReason(s)||paymentReason(s))return false;
 if(!Number.isInteger(s.storage.nextId)||s.storage.nextId>=LIMIT||!sameCost(a.settled,{wood:a.settledSites*60,stone:a.settledSites*20,food:0}))return false;
 if(a.closedPayments+s.storage.payments.length>=LIMIT)return false;
 const ids=new Set();
 for(const c of a.claims){
  if(!c||typeof c!=='object')return false;
  const b=s.buildings.find(b=>b.id===c.buildingId&&b.kind==='outpost');
  if(!b||c.id!==b.id||ids.has(c.id)||physicalSite(s,b.id)||!vector(c.unreleased)||!vector(c.receipted)||!Array.isArray(c.assigned)||c.assigned.length>8||new Set(c.assigned).size!==c.assigned.length||!c.basis||!['legacy-state-consistency','paid-construction',...(s.version===6?['delivered-construction']:[])].includes(c.basis.rule)||!['payment-origin-unrecorded','recorded-payment',...(s.version===6?['physical-delivery']:[])].includes(c.basis.origin)||!Array.isArray(c.origin)||c.origin.length>90)return false;
  if((c.basis.rule==='delivered-construction')!==(c.basis.origin==='physical-delivery')||(b.supplyProfile===CONSTRUCTION_PROFILE)!==(c.basis.rule==='delivered-construction')||c.basis.rule==='delivered-construction'&&!b.done)return false;
  if(c.basis.sourceIdentity!==a.sourceIdentity||c.basis.recipe!==RECLAIM_PROFILE)return false;
  ids.add(c.id);
  if(c.origin.some(p=>!p||typeof p.storeId!=='string'||!/^b(?:0|[1-9]\d*)$/.test(p.storeId)||Number(p.storeId.slice(1))>=s.nextId||!['hearth','outpost'].includes(p.kind)||!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.x>=W||p.y<0||p.y>=H||!RESOURCES.includes(p.resource)||!integer(p.amount)||p.amount<=0))return false;
  if(['recorded-payment','physical-delivery'].includes(c.basis.origin)&&RESOURCES.some(r=>c.origin.filter(p=>p.resource===r).reduce((n,p)=>n+p.amount,0)!==(COST.outpost[r]||0))||c.basis.origin==='payment-origin-unrecorded'&&c.origin.length)return false;
  if(RESOURCES.some(r=>c.unreleased[r]+c.receipted[r]+s.units.filter(u=>u.reclaim?.claimId===c.id&&u.resource===r).reduce((n,u)=>n+u.cargo,0)!==(COST.outpost[r]||0)))return false;
  if(!b.retiring&&(c.assigned.length||!sameCost(c.unreleased,COST.outpost)||!sameCost(c.receipted,{}))||b.retiring&&!b.done)return false;
  if(c.assigned.some(id=>!s.units.some(u=>u.id===id&&u.order.kind==='reclaim'&&u.order.target===c.id&&!u.next)))return false;
 }
 if(s.buildings.some(b=>b.kind==='outpost'&&!ids.has(b.id)&&!physicalSite(s,b.id)||b.retiring!==undefined&&(b.retiring!==true||b.kind!=='outpost'))||s.buildings.filter(b=>b.retiring).some(b=>s.storage.stores[b.id]))return false;
 if(s.buildings.some(b=>b.retiring&&b.x>20)&&!s.buildings.some(b=>b.kind==='outpost'&&isStore(b)&&b.x>20))return false;
 if(RESOURCES.some(r=>a.recovered[r]!==a.settled[r]+a.claims.reduce((n,c)=>n+c.receipted[r],0)))return false;
 const active=a.claims.filter(c=>s.buildings.some(b=>b.id===c.id&&b.retiring));
 if(a.settledSites+active.length>=LIMIT||RESOURCES.some(r=>a.recovered[r]+active.reduce((n,c)=>n+c.unreleased[r],0)+s.units.filter(u=>u.reclaim&&u.resource===r).reduce((n,u)=>n+u.cargo,0)>=LIMIT))return false;
 const paid=paidVector(s,a.claims);if(!paid||RESOURCES.some(r=>paid[r]!==s.spent[r]))return false;
 return s.units.every(u=>{
  const c=u.reclaim&&a.claims.find(c=>c.id===u.reclaim.claimId),assigned=a.claims.find(c=>c.assigned.includes(u.id));
  if(u.reclaim&&(!c||!s.buildings.some(b=>b.id===c.id&&b.retiring)||u.transfer||!u.cargo||!['return','carryMove','idle'].includes(u.phase)||u.phase==='idle'&&u.path.length))return false;
  if(u.phase==='reclaimPickup'&&(!assigned||u.cargo))return false;
  if(u.order.kind==='reclaim'&&!assigned||u.next?.kind==='reclaim')return false;
  if(assigned&&(u.cargo?u.reclaim?.claimId!==assigned.id||!['return','idle'].includes(u.phase):!['reclaimPickup','idle'].includes(u.phase)||u.dropoff!==undefined))return false;
  if(assigned&&u.phase==='idle'&&u.path.length)return false;
  return !assigned||s.buildings.some(b=>b.id===assigned.id&&b.retiring);
 });
}
// Explicit recovery only: callers retain the original bytes before adopting this copy.
// No stock, construction/crafting progress, transfer cargo or ordinary negative work is repaired.
function repairWorkResidue(state){
 if(!state||![1,2,3].includes(state.version)||!Array.isArray(state.units)||!Array.isArray(state.deposits))return null;
 try{
  const candidate=structuredClone(state);let changed=false;
  for(const u of candidate.units){
   if(!u||!Number.isFinite(u.work)||u.work>=0)continue;
   if(u.work< -1e-12||!u.order||u.order.kind!=='gather'||u.transfer||!Number.isFinite(u.cargo)||u.cargo<=0||u.cargo>5||!['extract','return','idle'].includes(u.phase)||!Array.isArray(u.path)||u.phase==='idle'&&u.path.length||!candidate.deposits.some(d=>d&&d.id===u.order.target&&d.kind===u.resource))return null;
   u.work=0;changed=true;
  }
  return changed&&valid(candidate)?candidate:null;
 }catch(e){return null;}
}
class Camp{
 constructor(state){if(state&&!valid(state))throw Error('Not a compatible RTS Hearth save.');const source=state||fresh(),clean=source.version<6?withoutConstructionAuthority(source):structuredClone(source);this.s=source.version>=5?clean:withoutReclaimAuthority(clean);if(this.s.version===1){this.s.tools=false;this.s.knapping=null;}if(this.s.version<3||!this.s.storage)this.migrateStorage();if(source.version<5){this.s.version=4;const legacy=state?clean:structuredClone(this.s),certificate=certifyLegacy(legacy);if(certificate.ok)this.adoptReclaim(legacy);else this.reclaimIssue=certificate.reason;}if(this.s.version===5){this.s.version=6;this.s.construction={profile:CONSTRUCTION_PROFILE,sites:[]};}this.reveal();if(!valid(this.s))throw Error('Not a compatible RTS Hearth save.');}
 migrateStorage(){
  const home=this.s.buildings.find(b=>b.kind==='hearth'&&b.done),stores=Object.fromEntries(this.s.buildings.filter(isStore).map(b=>[b.id,empty()]));stores[home.id]={...this.s.stock};
  const reservations={},sources=cost=>Object.entries(cost).filter(([,amount])=>amount>0).map(([resource,amount])=>({storeId:home.id,resource,amount}));
  for(const b of this.s.buildings.filter(b=>!b.done))reservations[b.id]={sources:sources(b.cost),legacy:true};
  if(this.s.knapping&&!this.s.knapping.done)reservations.knapping={sources:sources(COST.knapping),legacy:true};
  this.s.storage={version:1,stores,transfers:[],nextId:1,transferred:empty(),reservations,payments:[]};
 }
 adoptReclaim(source){
  this.s.version=5;this.s.reclaim={profile:RECLAIM_PROFILE,sourceIdentity:sourceLabel(source),claims:[],recovered:empty(),settled:empty(),settledSites:0,closedPayments:0};
  for(const b of this.s.buildings.filter(b=>b.kind==='outpost'))this.issueClaim(b,'legacy-state-consistency');
  this.compactPayments();
 }
 issueClaim(b,rule='paid-construction',deliveredOrigins=null){
  const payment=this.s.storage.payments.find(p=>p.kind==='construction'&&p.target===b.id),origin=deliveredOrigins?structuredClone(deliveredOrigins):payment?payment.sources.map(p=>{const store=this.s.buildings.find(b=>b.id===p.storeId);return{...p,kind:store.kind,x:store.x,y:store.y};}):[];
  const c={id:b.id,buildingId:b.id,unreleased:{...empty(),...COST.outpost},receipted:empty(),assigned:[],basis:{rule,origin:deliveredOrigins?'physical-delivery':payment?'recorded-payment':'payment-origin-unrecorded',sourceIdentity:this.s.reclaim.sourceIdentity,recipe:RECLAIM_PROFILE},origin};this.s.reclaim.claims.push(c);return c;
 }
 compactPayments(){if(!this.s.reclaim)return;this.s.storage.payments=this.s.storage.payments.filter(p=>{const live=p.kind==='construction'&&this.s.storage.reservations[p.target]||p.kind==='knapping'&&this.s.storage.reservations.knapping;if(live)return true;this.s.reclaim.closedPayments++;return false;});}
 constructionSite(id){return physicalSite(this.s,id);}
 siteSupply(id){const c=this.constructionSite(id);if(!c)return null;const reserved=empty(),carried=empty();for(const p of c.sources)reserved[p.resource]+=p.amount;for(const u of this.s.units)if(u.supply?.siteId===id)carried[u.resource]+=u.cargo;return{state:c.state,reserved,carried,staged:{...c.staged},released:{...c.released},returned:{...c.returned},sources:structuredClone(c.sources),origins:structuredClone(c.origins)};}
 planSupply(b,storeId=null){
  const stores=this.stores().filter(v=>!storeId||v.id===storeId).map(v=>{const paths=this.around(v).filter(p=>!this.blocked(p.x,p.y)).map(p=>this.path(p,this.around(b))).filter(Boolean);return{...v,distance:paths.length?Math.min(...paths.map(p=>p.length)):Infinity};}).filter(v=>Number.isFinite(v.distance)).sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id)),sources=[];
  for(const resource of RESOURCES){let left=COST[b.kind][resource]||0;for(const v of stores){const amount=Math.min(left,v.available[resource]);if(amount){sources.push({storeId:v.id,resource,amount});left-=amount;}}if(left)return null;}return sources;
 }
 supplyTargets(storeId,siteId){const store=this.s.buildings.find(b=>b.id===storeId&&isStore(b)),site=this.s.buildings.find(b=>b.id===siteId&&!b.done);return store&&site?this.around(store).filter(p=>!this.blocked(p.x,p.y)&&this.path(p,this.around(site))):[];}
 recoveryTargets(siteId){const site=this.s.buildings.find(b=>b.id===siteId&&!b.done);return site?this.around(site).filter(p=>!this.blocked(p.x,p.y)&&this.s.buildings.some(b=>isStore(b)&&this.path(p,this.around(b)))):[];}
 startSupply(u,c){
  const b=this.s.buildings.find(b=>b.id===c.buildingId);delete u.supplyPickup;delete u.dropoff;
  if(c.state==='cancelling'){
   if(!RESOURCES.some(r=>c.staged[r])){u.order={kind:'idle'};u.phase='idle';u.reason='Supply recovery waiting for remaining carriers';return;}
   if(this.route(u,this.recoveryTargets(b.id))){u.phase='siteRecovery';u.reason='Recover onsite supplies at the site edge';}return;
  }
  const choices=c.sources.map(p=>({p,targets:this.supplyTargets(p.storeId,b.id)})).map(v=>({...v,path:this.path(u,v.targets)})).filter(v=>v.path).sort((a,b)=>a.path.length-b.path.length||a.p.storeId.localeCompare(b.p.storeId)||RESOURCES.indexOf(a.p.resource)-RESOURCES.indexOf(b.p.resource));
  if(choices.length){const {p,targets}=choices[0],store=this.s.buildings.find(b=>b.id===p.storeId);if(this.route(u,targets)){u.supplyPickup={siteId:b.id,storeId:p.storeId,resource:p.resource};u.phase='supplyPickup';u.reason='Fetch '+p.resource+' from '+storeName(store)+' for '+b.kind;}return;}
  if(this.route(u,this.around(b))){u.phase='construct';u.reason=sameCost(c.staged,b.cost)?'Installing '+b.kind:'Waiting for site supplies';}
 }
 deliverSupply(u){const c=this.constructionSite(u.supply?.siteId),b=c&&this.s.buildings.find(b=>b.id===c.buildingId);delete u.dropoff;if(!b||c.state!=='active'){this.home(u);return;}if(this.route(u,this.around(b))){u.phase='supplyDeliver';u.reason='Deliver '+u.cargo+' '+u.resource+' to '+b.kind+' site';}}
 pickupSupply(u){
  const p=u.supplyPickup,c=p&&this.constructionSite(p.siteId),store=p&&this.s.buildings.find(b=>b.id===p.storeId&&isStore(b)),row=c?.sources.find(v=>v.storeId===p.storeId&&v.resource===p.resource);
  if(!c||c.state!=='active'||!row||!store||!this.supplyTargets(store.id,c.buildingId).some(v=>Math.abs(v.x-u.x)<.001&&Math.abs(v.y-u.y)<.001)){this.start(u);return;}
  const amount=Math.min(5,row.amount);this.s.storage.stores[store.id][p.resource]-=amount;row.amount-=amount;c.sources=c.sources.filter(v=>v.amount);u.cargo=amount;u.resource=p.resource;u.supply={siteId:c.buildingId,origin:{storeId:store.id,kind:store.kind,x:store.x,y:store.y,resource:p.resource,amount}};delete u.supplyPickup;this.syncStock();this.deliverSupply(u);
 }
 receiveSupply(u){
  const c=this.constructionSite(u.supply?.siteId),b=c&&this.s.buildings.find(b=>b.id===c.buildingId);if(!b||c.state!=='active'){this.home(u);return;}
  if(!this.around(b).some(p=>Math.abs(p.x-u.x)<.001&&Math.abs(p.y-u.y)<.001)){this.deliverSupply(u);return;}
  const origin=u.supply.origin,row=c.origins.find(p=>originKey(p)===originKey(origin));if(row)row.amount+=u.cargo;else c.origins.push({...origin});c.staged[u.resource]+=u.cargo;u.cargo=0;u.resource=null;delete u.supply;this.start(u);
 }
 recoverSupply(u){
  const c=this.constructionSite(u.order.target);if(!c||c.state!=='cancelling'||!this.recoveryTargets(c.buildingId).some(p=>Math.abs(p.x-u.x)<.001&&Math.abs(p.y-u.y)<.001)){this.start(u);return;}
  const resource=RESOURCES.find(r=>c.staged[r]);if(!resource){this.start(u);return;}const amount=Math.min(5,c.staged[resource]);let left=amount;
  for(const p of c.origins)if(p.resource===resource&&left){const n=Math.min(left,p.amount);p.amount-=n;left-=n;}c.origins=c.origins.filter(p=>p.amount);c.staged[resource]-=amount;u.cargo=amount;u.resource=resource;u.supply={siteId:c.buildingId,origin:null};this.home(u);
 }
 clearSiteOrders(id){for(const u of this.s.units){if(u.next?.kind==='build'&&u.next.target===id)u.next={kind:'idle'};if(u.supplyPickup?.siteId===id)delete u.supplyPickup;if(u.order.kind==='build'&&u.order.target===id){if(u.cargo){u.order={kind:'idle'};/* Keep the existing physical return and unrelated successor. */}else{u.order=u.next||{kind:'idle'};u.next=null;this.start(u);}}}}
 finishCancelledSites(){if(!this.s.construction)return;for(const c of [...this.s.construction.sites])if(c.state==='cancelling'&&!RESOURCES.some(r=>c.staged[r])&&!this.s.units.some(u=>u.supply?.siteId===c.buildingId)){this.clearSiteOrders(c.buildingId);this.s.buildings=this.s.buildings.filter(b=>b.id!==c.buildingId);this.s.construction.sites=this.s.construction.sites.filter(v=>v!==c);}}
 reclaimClaim(id){return this.s.reclaim?.claims.find(c=>c.id===id)||null;}
 reclaimTargets(id,exclude=null){const source=this.s.buildings.find(b=>b.id===id&&b.kind==='outpost');if(!source)return[];const stores=this.s.buildings.filter(b=>isStore(b)&&b.id!==id&&b.id!==exclude);return this.around(source).filter(p=>!this.blocked(p.x,p.y)&&stores.some(b=>this.path(p,this.around(b))));}
 reclaimQuote(ids,id){
  const fail=reason=>({ok:false,reason,buildingId:id});
  if(!this.s.reclaim)return fail('Recovery unavailable: '+(this.reclaimIssue||'this legacy camp has no canonical capital certificate')+'. The camp can still be played and exported.');
  const b=this.s.buildings.find(b=>b.id===id),c=this.reclaimClaim(id);
  if(!b||b.kind!=='outpost'||!b.done||!c)return fail('Choose a completed certified outpost; the hearth and workshop cannot be recovered');
  if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!this.s.units.some(u=>u.id===id)))return fail('Select existing villagers with empty hands');
  const workers=this.s.units.filter(u=>ids.includes(u.id));
  if(b.retiring&&workers.every(u=>c.assigned.includes(u.id)&&u.order.kind==='reclaim'&&u.order.target===id))return{ok:true,reason:null,buildingId:id,id,assigned:workers.length,repeated:true};
  if(!RESOURCES.some(r=>c.unreleased[r]))return fail('All capital has been picked up. Return the remaining carried goods to finish recovery');
  if(workers.some(u=>u.cargo||u.transfer||u.next||u.order.kind==='transfer'))return fail('Stop and Return current loads and transfers before assigning recovery');
  if(!b.retiring){
   if(b.x>20&&!this.s.buildings.some(other=>other.id!==id&&other.kind==='outpost'&&other.x>20&&isStore(other)))return fail('Keep one usable eastern outpost for the opening goal');
   if(RESOURCES.some(r=>this.s.storage.stores[id]?.[r]))return fail('Transfer all stored goods out before recovering this outpost');
   if(this.s.storage.transfers.some(j=>j.from===id||j.to===id))return fail('Finish or Stop and Return transfers involving this outpost first');
   if(this.s.units.some(u=>u.dropoff===id||[u.order,u.next].some(o=>o?.target===id)))return fail('Finish or stop incoming and queued orders at this outpost first');
   if(Object.values(this.s.storage.reservations).some(v=>v.sources.some(p=>p.storeId===id)))return fail('Finish or cancel the paid work supplied by this outpost first');
   if(this.s.construction?.sites.some(c=>c.sources.some(p=>p.storeId===id))||this.s.units.some(u=>u.supplyPickup?.storeId===id))return fail('Finish or cancel the construction supplies reserved at this outpost first');
   if(this.s.construction?.sites.some(c=>!this.recoveryTargets(c.buildingId).some(p=>this.s.buildings.some(store=>isStore(store)&&store.id!==id&&this.path(p,this.around(store))))))return fail('Keep a reachable receiving store for every construction site');
   if(this.s.reclaim.claims.some(other=>this.s.buildings.some(b=>b.id===other.id&&b.retiring)&&(!this.reclaimTargets(other.id,id).length||this.s.units.filter(u=>u.reclaim?.claimId===other.id).some(u=>!this.s.buildings.some(store=>isStore(store)&&store.id!==id&&this.path(u,this.around(store)))))))return fail('This store is needed by another recovery; keep a reachable receiving store');
   const retiring=this.s.reclaim.claims.filter(c=>this.s.buildings.some(b=>b.id===c.id&&b.retiring)),pending=retiring.reduce((v,c)=>{for(const r of RESOURCES)v[r]+=c.unreleased[r]+this.s.units.filter(u=>u.reclaim?.claimId===c.id&&u.resource===r).reduce((n,u)=>n+u.cargo,0);return v;},empty());
   if(this.s.reclaim.settledSites+retiring.length+1>=LIMIT||RESOURCES.some(r=>this.s.reclaim.recovered[r]+pending[r]+c.unreleased[r]>=LIMIT))return fail('Recovery accounting is at its supported limit; export this camp');
  }
  const targets=this.reclaimTargets(id);if(!targets.length||workers.some(u=>!this.path(u,targets)))return fail('Recovery needs one reachable pickup edge connected to a receiving store');
  return{ok:true,reason:null,buildingId:id,id,assigned:workers.length};
 }
 reclaim(ids,id){
  const q=this.reclaimQuote(ids,id);if(!q.ok)return{error:q.reason};if(q.repeated)return{id,assigned:q.assigned};
  const b=this.s.buildings.find(b=>b.id===id),c=this.reclaimClaim(id);
  b.retiring=true;delete this.s.storage.stores[id];this.syncStock();
  for(const u of this.s.units.filter(u=>ids.includes(u.id)).sort((a,b)=>a.id.localeCompare(b.id))){this.releaseTransfer(u);this.releaseReclaim(u);c.assigned.push(u.id);u.order={kind:'reclaim',target:id};u.next=null;delete u.dropoff;this.start(u);}c.assigned.sort();this.pruneTransfers();this.updateGoal();return{id,assigned:q.assigned};
 }
 releaseReclaim(u){if(!this.s.reclaim)return;for(const c of this.s.reclaim.claims)c.assigned=c.assigned.filter(id=>id!==u.id);if(u.order.kind==='reclaim')u.order={kind:'idle'};}
 reclaimPickup(u){
  const c=this.reclaimClaim(u.order.target),b=c&&this.s.buildings.find(b=>b.id===c.id&&b.retiring);
  if(!b||!c.assigned.includes(u.id)||u.cargo){this.releaseReclaim(u);this.start(u);return;}
  const targets=this.reclaimTargets(c.id),adjacent=targets.some(p=>Math.abs(p.x-u.x)<.001&&Math.abs(p.y-u.y)<.001);
  if(!adjacent){this.start(u);return;}
  const resource=RESOURCES.find(r=>c.unreleased[r]>0);if(!resource){this.releaseReclaim(u);this.start(u);this.finishReclaims();return;}
  const amount=Math.min(5,c.unreleased[resource]);if(this.s.spent[resource]<amount){u.phase='idle';u.reason='Recovery capital is unavailable — export this camp';return;}
  this.s.spent[resource]-=amount;c.unreleased[resource]-=amount;u.cargo=amount;u.resource=resource;u.reclaim={claimId:c.id};this.home(u);
  if(!RESOURCES.some(r=>c.unreleased[r]))for(const other of this.s.units)if(c.assigned.includes(other.id)&&!other.cargo){this.releaseReclaim(other);this.start(other);}
 }
 finishReclaims(){
  if(!this.s.reclaim)return;
  this.s.reclaim.claims=this.s.reclaim.claims.filter(c=>{
   if(!this.s.buildings.some(b=>b.id===c.id&&b.retiring)||RESOURCES.some(r=>c.unreleased[r])||c.assigned.length||this.s.units.some(u=>u.reclaim?.claimId===c.id||[u.order,u.next].some(o=>o?.target===c.id)))return true;
   for(const r of RESOURCES)this.s.reclaim.settled[r]+=c.receipted[r];this.s.reclaim.settledSites++;this.s.buildings=this.s.buildings.filter(b=>b.id!==c.id);return false;
  });
 }
 updateGoal(){this.s.complete=this.s.depleted>0&&this.s.buildings.some(b=>b.kind==='outpost'&&isStore(b)&&b.x>20)&&this.s.buildings.some(b=>b.kind==='workshop'&&b.done);}
 syncStores(){for(const b of this.s.buildings.filter(isStore))if(!this.s.storage.stores[b.id])this.s.storage.stores[b.id]=empty();}
 syncStock(){for(const r of RESOURCES)this.s.stock[r]=Object.values(this.s.storage.stores).reduce((sum,stock)=>sum+stock[r],0);}
 stores(){
  return this.s.buildings.filter(isStore).map(b=>{const stock={...this.s.storage.stores[b.id]},reserved=empty(),incoming=empty();
   for(const j of this.s.storage.transfers)if(j.from===b.id)reserved[j.resource]+=j.remaining;
   for(const c of this.s.construction?.sites||[])for(const p of c.sources)if(p.storeId===b.id)reserved[p.resource]+=p.amount;
   for(const u of this.s.units)if(u.cargo&&u.dropoff===b.id)incoming[u.resource]+=u.cargo;
   return{id:b.id,name:storeName(b),kind:b.kind,x:b.x,y:b.y,stock,reserved,available:Object.fromEntries(RESOURCES.map(r=>[r,stock[r]-reserved[r]])),incoming};
  });
 }
 store(id){return this.stores().find(b=>b.id===id)||null;}
 economy(){const stores=this.stores(),available=empty(),reserved=empty(),inTransit=empty(),constructionReserved=empty(),constructionSourceReserved=empty(),constructionStaged=empty(),constructionCarried=empty();
  for(const b of stores)for(const r of RESOURCES){available[r]+=b.available[r];reserved[r]+=b.reserved[r];}
  for(const u of this.s.units)if(u.cargo)inTransit[u.resource]+=u.cargo;
  for(const v of Object.values(this.s.storage.reservations))for(const p of v.sources)constructionReserved[p.resource]+=p.amount;
  for(const c of this.s.construction?.sites||[]){for(const p of c.sources)constructionSourceReserved[p.resource]+=p.amount;for(const r of RESOURCES)constructionStaged[r]+=c.staged[r];}for(const u of this.s.units)if(u.supply)constructionCarried[u.resource]+=u.cargo;
  return{stored:{...this.s.stock},available,reserved,inTransit,constructionReserved,constructionSourceReserved,constructionStaged,constructionCarried,transferred:{...this.s.storage.transferred},produced:{...this.s.delivered},recovered:this.s.reclaim?{...this.s.reclaim.recovered}:empty(),stores};
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
  const sources=this.s.version===6&&['outpost','workshop'].includes(kind)?this.planSupply({kind,x,y},b?.id||null):null;
  return{mode:local?'local':'opening-pool',storeId:b?.id||null,name:local?(b?storeName(b):'No reachable store'):'Opening camp stores',cost:{...cost},available,missing,sources,error:local&&!b?'No reachable supplying store':null};
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
  if(this.s.reclaim&&(this.s.storage.nextId+1>=LIMIT||this.s.storage.transferred[resource]+this.s.storage.transfers.filter(j=>j.resource===resource).reduce((n,j)=>n+j.remaining+this.s.units.filter(u=>u.transfer===j.id).reduce((m,u)=>m+u.cargo,0),0)+workers.length*5>=LIMIT))return{...quote,error:'Transfer accounting is at its supported limit; export this camp'};
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
  if(u.supply){const c=this.constructionSite(u.supply.siteId);if(c.state==='active'){const row=c.sources.find(p=>p.storeId===b.id&&p.resource===u.resource);if(row)row.amount+=u.cargo;else c.sources.push({storeId:b.id,resource:u.resource,amount:u.cargo});}else c.returned[u.resource]+=u.cargo;delete u.supply;}
  else if(u.reclaim){const c=this.reclaimClaim(u.reclaim.claimId);c.receipted[u.resource]+=u.cargo;this.s.reclaim.recovered[u.resource]+=u.cargo;delete u.reclaim;if(!RESOURCES.some(r=>c.unreleased[r]))this.releaseReclaim(u);}
  else if(u.transfer){const j=this.s.storage.transfers.find(j=>j.id===u.transfer);if(b.id===j.to){j.delivered+=u.cargo;this.s.storage.transferred[u.resource]+=u.cargo;}else j.recovered+=u.cargo;delete u.transfer;}else this.s.delivered[u.resource]+=u.cargo;
  u.cargo=0;u.resource=null;delete u.dropoff;if(u.next){u.order=u.next;u.next=null;}else if(u.order.kind==='transfer')u.order={kind:'idle'};this.start(u);this.pruneTransfers();this.finishReclaims();this.finishCancelledSites();
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
 // An empty grid route reaches the rounded cell; physical arrival still needs its final segment.
 approachPath(u,path){const p={x:Math.round(u.x),y:Math.round(u.y)};return path&&!path.length&&(u.x!==p.x||u.y!==p.y)?[p]:path;}
 route(u,targets){const free=this.freeTargets(u,targets);const path=this.path(u,free.length?free:targets);if(!path){u.phase='idle';u.reason='Blocked — choose a reachable target';u.path=[];return false;}u.path=this.approachPath(u,path);return true;}
 home(u){const choices=this.s.buildings.filter(isStore).map(b=>({b,path:this.path(u,this.freeTargets(u,this.around(b)))})).filter(v=>v.path).sort((a,b)=>a.path.length-b.path.length);if(!choices.length){u.phase='idle';u.reason='Drop-off blocked or crowded — clear space';u.path=[];return false;}u.dropoff=choices[0].b.id;u.path=this.approachPath(u,choices[0].path);u.phase='return';u.reason='Returning '+u.cargo+' '+u.resource+' to '+storeName(choices[0].b);return true;}
 movePath(u,o){if(!Number.isInteger(o.x)||!Number.isInteger(o.y))return null;const path=this.path(u,[o]);return path&&!path.length&&(u.x!==o.x||u.y!==o.y)?[{x:o.x,y:o.y}]:path;}
 moveCarry(u,path=this.movePath(u,u.order)){delete u.dropoff;u.next=null;u.path=path||[];u.phase=path?'carryMove':'idle';u.reason=path?'Moving with '+u.cargo+' '+u.resource:'Holding '+u.cargo+' '+u.resource+' — Move target blocked; choose Move or Stop and Return';}
 start(u){delete u.supplyPickup;delete u.dropoff;if(u.cargo&&u.order.kind==='move'){this.moveCarry(u);return;}u.work=0;u.path=[];const o=u.order;if(o.kind==='idle'){u.phase='idle';u.reason='Ready for orders';return;}
 if(o.kind==='move'){if(this.route(u,[o])){u.phase='walk';u.reason='Moving';}return;}
 if(o.kind==='reclaim'){
  const c=this.reclaimClaim(o.target);if(!c||!c.assigned.includes(u.id)||!RESOURCES.some(r=>c.unreleased[r])){this.releaseReclaim(u);u.phase='idle';u.reason='Recovery assignment finished';return;}
  if(this.route(u,this.reclaimTargets(c.id))){u.phase='reclaimPickup';u.reason='Recover outpost capital — collect at its edge';}else u.reason='Recovery pickup blocked — keep a route to a receiving store';return;
 }
 if(o.kind==='transfer'){
  const job=this.s.storage.transfers.find(j=>j.id===o.target),source=job&&this.s.buildings.find(b=>b.id===job.from&&isStore(b));
  if(!job||!job.pending[u.id]||!source){u.order={kind:'idle'};u.phase='idle';u.reason='Transfer complete';return;}
  if(this.route(u,this.transferTargets(job.from,job.to))){u.phase='pickup';u.reason='Collect '+job.pending[u.id]+' '+job.resource+' from '+storeName(source);}return;
 }
 const target=(o.kind==='gather'?this.s.deposits:this.s.buildings).find(v=>v.id===o.target);
 if(o.kind==='craft'&&(!this.s.knapping||this.s.knapping.workshop!==o.target||this.s.knapping.done)){u.phase='idle';u.reason=this.s.tools?'Toolset complete':'No active knapping project';return;}
 if(!target||o.kind==='gather'&&target.amount===0||o.kind==='build'&&target.done){u.phase='idle';u.reason=o.kind==='gather'?'Deposit exhausted — choose another':'Construction complete';return;}
 if(o.kind==='build'&&this.constructionSite(target.id)){this.startSupply(u,this.constructionSite(target.id));return;}
 if(this.route(u,this.around(target))){u.phase=o.kind==='gather'?'extract':o.kind==='craft'?'craft':'construct';u.reason=o.kind==='gather'?'Gathering '+target.kind:o.kind==='craft'?'Knapping tools':'Building '+target.kind;}
 }
 accepts(u,o){
  if(!o||!['idle','move','gather','build','craft','transfer'].includes(o.kind))return false;if(o.kind==='idle')return true;
  if(o.kind==='move')return !!this.movePath(u,o);
  if(o.kind==='transfer'){const j=this.s.storage.transfers.find(j=>j.id===o.target&&j.pending[u.id]>0);return !!j&&!!this.path(u,this.transferTargets(j.from,j.to));}
  const target=(o.kind==='gather'?this.s.deposits:this.s.buildings).find(v=>v.id===o.target);
  if(!target||o.kind==='gather'&&!target.amount||o.kind==='build'&&target.done||o.kind==='craft'&&(!this.s.knapping||this.s.knapping.done||this.s.knapping.workshop!==o.target))return false;
  return !!this.path(u,this.around(target));
 }
 command(ids,order){if(!Array.isArray(ids)||ids.some(id=>!this.s.units.some(u=>u.id===id)))return 0;const workers=this.s.units.filter(u=>ids.includes(u.id)),changing=workers.filter(u=>!(order?.kind==='move'?['walk','carryMove'].includes(u.phase)&&JSON.stringify(u.order)===JSON.stringify(order):JSON.stringify(u.next||u.order)===JSON.stringify(order)&&u.phase!=='idle'));
  const routes=new Map();for(const u of changing){if(order?.kind==='move'){const path=this.movePath(u,order);if(!path)return 0;routes.set(u.id,path);}else if(!this.accepts(u,order))return 0;}
  let count=0;for(const u of changing){count++;this.releaseTransfer(u);this.releaseReclaim(u);delete u.supplyPickup;if(u.cargo&&order.kind==='move'){u.order=structuredClone(order);this.moveCarry(u,routes.get(u.id));}else if(u.cargo){if(u.order.kind==='move')u.order={kind:'idle'};u.next=structuredClone(order);this.home(u);}else{u.order=structuredClone(order);u.next=null;this.start(u);}}this.pruneTransfers();this.finishReclaims();this.finishCancelledSites();return count;
 }
 canPay(cost,storeId=null){const available=storeId?this.store(storeId)?.available:this.economy().available;return !!available&&Object.entries(cost).every(([r,n])=>available[r]>=n);}
 pay(cost,storeId=null,kind='expense',target=null){
  if(!this.canPay(cost,storeId)||this.s.reclaim&&(this.s.storage.payments.length>=40||this.s.reclaim.closedPayments+this.s.storage.payments.length+4>=LIMIT))return false;const sources=[],stores=this.stores().filter(b=>!storeId||b.id===storeId);
  for(const[r,total]of Object.entries(cost)){let left=total;for(const b of stores){const amount=Math.min(left,b.available[r]);if(!amount)continue;this.s.storage.stores[b.id][r]-=amount;sources.push({storeId:b.id,resource:r,amount});left-=amount;}this.s.spent[r]+=total;}this.syncStock();
  this.s.storage.payments.push({kind,target,sources,refunded:false});return{sources};
 }
 placement(kind,x,y){if(!WORK[kind])return 'Unknown structure';if(this.s.buildings.length>=30)return 'Camp structure limit reached';if(this.s.reclaim){const east=kind==='outpost'&&x>20||this.s.buildings.some(b=>b.kind==='outpost'&&!b.retiring&&b.x>20),workshop=kind==='workshop'||this.s.buildings.some(b=>b.kind==='workshop');if(this.s.nextId+1+Number(!east)+Number(!workshop)>=LIMIT)return 'Keep the remaining building identities for required opening structures';if(this.s.storage.payments.length>=40||this.s.reclaim.closedPayments+this.s.storage.payments.length+4>=LIMIT)return 'Payment accounting is at its supported limit; export this camp';}if(!this.visible(x,y))return 'Scout this ground first';for(let dx=0;dx<2;dx++)for(let dy=0;dy<2;dy++)if(this.blocked(x+dx,y+dy)||this.s.units.some(u=>Math.abs(u.x-x-dx)<.65&&Math.abs(u.y-y-dy)<.65))return 'Choose clear ground';const q=this.funding(kind,x,y);if(q.error||!this.canPay(COST[kind],q.storeId))return this.shortage(q);return null;}
 build(kind,x,y,ids){if(!Number.isInteger(x)||!Number.isInteger(y)||!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!this.s.units.some(u=>u.id===id)))return{error:'Choose whole map cells and existing villagers'};const error=this.placement(kind,x,y);if(error)return {error};const funding=this.funding(kind,x,y),b={id:'b'+this.s.nextId,kind,x,y,done:false,work:0,cost:{...COST[kind]}};this.s.buildings.push(b);
 // Preserve access to every worker and deposit; no irreversible choke-point seals.
 const home=this.s.buildings.find(v=>v.kind==='hearth');const targets=[...this.s.units,...this.s.deposits.filter(d=>d.amount>0).flatMap(d=>this.around(d).filter(p=>!this.blocked(p.x,p.y)).slice(0,1))];
 if(targets.some(p=>!this.path(p,this.around(home)))||this.s.buildings.filter(site=>isStore(site)||site.retiring||!site.done).some(site=>!this.around(site).some(p=>!this.blocked(p.x,p.y)&&this.path(p,this.around(home))))){this.s.buildings.pop();return {error:'Leave a route through the camp and to every store, construction or recovery site'};}
 // Admission uses the same whole-selection predicate as the eventual order,
 // with the candidate footprint present but before any accounting or actor changes.
 if(this.s.units.some(u=>ids.includes(u.id)&&!this.accepts(u,{kind:'build',target:b.id}))){this.s.buildings.pop();return{error:'Every selected villager needs a reachable route to the new site'};}
 if(this.s.version===6){const sources=this.planSupply(b,funding.storeId);if(!sources){this.s.buildings.pop();return{error:'Every construction supply needs available stock and a route to the site'};}b.supplyProfile=CONSTRUCTION_PROFILE;this.s.construction.sites.push({buildingId:b.id,state:'active',sources,staged:empty(),released:empty(),returned:empty(),origins:[]});}
 else{const reservation=this.pay(b.cost,funding.storeId,'construction',b.id);if(!reservation){this.s.buildings.pop();return{error:'Payment accounting is at its supported limit; no materials spent'};}this.s.storage.reservations[b.id]=reservation;if(this.s.reclaim&&kind==='outpost')this.issueClaim(b);}
 this.s.nextId++;for(const u of this.s.units)if(u.path.length){if(u.phase==='carryMove')this.moveCarry(u);else if(u.transfer&&u.phase==='transfer')this.transferHome(u);else if(u.supply&&u.phase==='supplyDeliver')this.deliverSupply(u);else if(u.cargo)this.home(u);else this.start(u);}this.command(ids,{kind:'build',target:b.id});return {id:b.id};}
 cancel(id){const b=this.s.buildings.find(v=>v.id===id&&!v.done);if(!b)return false;const c=this.constructionSite(id);if(c){if(c.state==='cancelling')return false;for(const p of c.sources)c.released[p.resource]+=p.amount;c.sources=[];c.state='cancelling';for(const u of this.s.units){if(u.next?.kind==='build'&&u.next.target===id)u.next={kind:'idle'};if(u.supplyPickup?.siteId===id)delete u.supplyPickup;if(u.order.kind==='build'&&u.order.target===id&&!u.next){if(u.cargo)this.home(u);else this.start(u);}}this.finishCancelledSites();return true;}const reservation=this.s.storage.reservations[id];
  for(const p of reservation.sources){this.s.storage.stores[p.storeId][p.resource]+=p.amount;this.s.spent[p.resource]-=p.amount;}this.syncStock();
  delete this.s.storage.reservations[id];this.s.storage.payments=this.s.storage.payments.filter(p=>!(p.kind==='construction'&&p.target===id));
  this.s.buildings=this.s.buildings.filter(v=>v.id!==id);if(this.s.reclaim)this.s.reclaim.claims=this.s.reclaim.claims.filter(c=>c.id!==id);for(const u of this.s.units){if(u.next&&u.next.target===id)u.next={kind:'idle'};if(u.order.target===id){u.order={kind:'idle'};if(u.cargo)this.home(u);else this.start(u);}}return true;
 }
 beginKnapping(workshop,ids){const b=this.s.buildings.find(b=>b.id===workshop&&b.kind==='workshop'&&b.done);if(!b)return 'Finish a workshop first';if(!Array.isArray(ids)||!ids.length||ids.some(id=>!this.s.units.some(u=>u.id===id)))return 'Select villagers to craft the tools';if(ids.some(id=>!this.path(this.s.units.find(u=>u.id===id),this.around(b))))return 'Selected villagers need a reachable path to the workshop';if(this.s.tools)return 'Useful edges already crafted';if(this.s.knapping&&this.s.knapping.workshop!==workshop)return 'Resume the project at its original workshop';if(!this.s.knapping){const q=this.knappingFunding(workshop);if(q.error||!this.canPay(COST.knapping,q.storeId))return this.shortage(q);const reservation=this.pay(COST.knapping,q.storeId,'knapping',workshop);if(!reservation)return 'Payment accounting is at its supported limit; no materials spent';this.s.storage.reservations.knapping=reservation;this.s.knapping={workshop,work:0,done:false};}this.command(ids,{kind:'craft',target:workshop});return null;}
 train(){if(this.s.units.length>=8)return 'All eight villagers have joined';const home=this.s.buildings.find(b=>b.kind==='hearth'),spot=this.around(home).find(p=>!this.blocked(p.x,p.y)&&!this.s.units.some(u=>Math.hypot(u.x-p.x,u.y-p.y)<.8)&&this.s.units.some(u=>this.path(u,[p])));if(!spot)return 'Clear reachable space beside the hearth first';if(!this.pay(COST.worker,home.id,'recruitment'))return this.shortage(this.funding('worker',home.x,home.y));const i=this.s.units.length;this.s.units.push(unit(i,spot.x,spot.y));return null;}
 tick(dt=.1){if(!Number.isFinite(dt)||dt<=0||dt>1)throw Error('Tick must be in (0,1]');this.s.time+=dt;
 for(const u of this.s.reclaim?[...this.s.units].sort((a,b)=>a.id.localeCompare(b.id)):this.s.units){if(u.phase==='idle')continue;
 if(u.phase==='carryMove'){
  if(this.blocked(u.order.x,u.order.y)||u.path.some(p=>this.blocked(p.x,p.y)))this.moveCarry(u);if(u.phase==='idle')continue;
  if(!u.path.length){u.order={kind:'idle'};u.phase='idle';u.reason='Holding '+u.cargo+' '+u.resource+' — choose Move or Stop and Return';continue;}
  const p=u.path[0],dx=p.x-u.x,dy=p.y-u.y,d=Math.hypot(dx,dy),step=Math.min(d,dt*3);
  if(d<=step){u.x=p.x;u.y=p.y;u.path.shift();}else{u.x+=dx/d*step;u.y+=dy/d*step;}continue;
 }
 if(u.path.length){const p=u.path[0],dx=p.x-u.x,dy=p.y-u.y,d=Math.hypot(dx,dy),step=Math.min(d,dt*3);if(d){u.x+=dx/d*step;u.y+=dy/d*step;}if(d<=step+.00001)u.path.shift();continue;}
 if(u.phase==='walk'){u.order={kind:'idle'};this.start(u);continue;}
 if(u.phase==='return'||u.phase==='transfer'){this.receive(u);continue;}
 if(u.phase==='reclaimPickup'){this.reclaimPickup(u);continue;}
 if(u.phase==='supplyPickup'){this.pickupSupply(u);continue;}
 if(u.phase==='supplyDeliver'){this.receiveSupply(u);continue;}
 if(u.phase==='siteRecovery'){this.recoverSupply(u);continue;}
 if(u.phase==='pickup'){
  const j=this.s.storage.transfers.find(j=>j.id===u.order.target),amount=j&&j.pending[u.id];
  if(!amount){u.order={kind:'idle'};this.start(u);this.pruneTransfers();continue;}
  const source=this.s.buildings.find(b=>b.id===j.from&&isStore(b));
  if(!source||!this.around(source).some(p=>Math.abs(p.x-u.x)<.001&&Math.abs(p.y-u.y)<.001)){this.start(u);continue;}
  this.s.storage.stores[j.from][j.resource]-=amount;this.syncStock();j.pending[u.id]=0;j.remaining-=amount;u.cargo=amount;u.resource=j.resource;u.transfer=j.id;this.transferHome(u);continue;
 }
 if(u.phase==='extract'){const d=this.s.deposits.find(d=>d.id===u.order.target);if(!d||!d.amount){if(u.cargo)this.home(u);else{u.phase='idle';u.reason='Deposit exhausted — choose another';}continue;}u.work+=dt;const interval=this.s.tools?.45:.6;if(u.work+.00001>=interval){u.work=Math.max(0,u.work-interval);d.amount--;u.cargo++;u.resource=d.kind;if(d.amount===0)this.s.depleted++;if(u.cargo>=5||d.amount===0)this.home(u);}continue;}
 if(u.phase==='craft'){const project=this.s.knapping;if(!project||project.done||project.workshop!==u.order.target){u.order={kind:'idle'};this.start(u);continue;}project.work=Math.min(12,project.work+dt);if(project.work+.00001>=12){project.work=12;project.done=true;this.s.tools=true;delete this.s.storage.reservations.knapping;for(const artisan of this.s.units)if(artisan.order.kind==='craft'){artisan.order={kind:'idle'};this.start(artisan);artisan.reason='Useful edges crafted';}}continue;}
 if(u.phase==='construct'){const b=this.s.buildings.find(b=>b.id===u.order.target);if(!b||b.done){u.order={kind:'idle'};this.start(u);continue;}const c=this.constructionSite(b.id);if(c&&!sameCost(c.staged,b.cost)){if(c.sources.length||c.state==='cancelling')this.start(u);continue;}if(c)u.reason='Installing '+b.kind;b.work+=dt;if(b.work+.00001>=WORK[b.kind]){b.work=WORK[b.kind];b.done=true;if(c){for(const r of RESOURCES)this.s.spent[r]+=c.staged[r];if(b.kind==='outpost')this.issueClaim(b,'delivered-construction',c.origins);this.s.construction.sites=this.s.construction.sites.filter(v=>v!==c);}delete this.s.storage.reservations[b.id];this.syncStores();this.clearSiteOrders(b.id);}}
 }
 this.compactPayments();this.finishReclaims();this.finishCancelledSites();this.reveal();this.updateGoal();
 }
 serialize(){return JSON.stringify(this.s);}
}
const API={Camp,W,H,KEY,COST,WORK,valid,repairWorkResidue,certifyLegacy,RECLAIM_PROFILE,CONSTRUCTION_PROFILE};if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HearthRTS=API;
})(globalThis);
