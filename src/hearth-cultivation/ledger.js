/* Exact local support and custody arithmetic. No storage, clocks or DOM. */
(function(root){
'use strict';
const R=['wood','stone','food','water','seed'],SUPPORT=['food','water','wood'];
const LIMIT=10000000,MAX=1000000000000000n;
const whole=v=>Number.isSafeInteger(v)&&v>=0&&v<LIMIT;
const wire=v=>typeof v==='string'&&/^(0|[1-9][0-9]*)$/.test(v)&&v.length<=16&&BigInt(v)<=MAX;
const big=v=>{if(!wire(v))throw Error('Invalid exact ledger amount');return BigInt(v);};
const out=n=>{if(n<0n||n>MAX)throw Error('Exact ledger limit reached');return String(n);};
const empty=()=>Object.fromEntries(R.map(r=>[r,0]));
const account=()=>({milli:'0',consumedMilli:'0',remainder:'0',fundedWhole:'0',returnedWhole:'0'});
const plots=()=>[{id:'pilot',x:11,y:17,batchesStarted:0,batchesFinished:0,job:null},{id:'woodland',x:14,y:17,batchesStarted:0,batchesFinished:0,job:null}];
function fresh(){return{tick:0,active:false,seedDiscovered:false,woodlandUnlocked:false,nextFunded:false,nextJob:1,water:{poolMilli:'30000',inflowMilli:'0',collected:0},seedCache:6,pantry:{food:account(),water:account(),wood:account()},demandSlots:'0',campSlots:'0',recipeWaterConsumed:0,generated:{food:0,wood:0},receipts:{pilotFood:0,woodlandWood:0},plots:plots()};}
const effective=a=>big(a.milli)*3n-big(a.remainder);
function remaining(j){if(!j||j.phase==='cancelling'||j.phase==='output')return 0;return (j.plotId==='pilot'?900:300)-j.workSlots+(j.plotId==='woodland'?200-j.harvestSlots:0);}
function holds(s,next=s.cultivation.nextFunded){let slots=0;for(const p of s.cultivation.plots)slots+=remaining(p.job);return{food:BigInt(slots+(next?900:0)),water:BigInt(slots+(next?900:0)),wood:5n*BigInt(slots+(next?900:0))};}
function rawReserved(s,id,r){let n=0;for(const t of s.storage.transfers)if(t.from===id&&t.resource===r)n+=t.remaining;for(const c of s.construction.sites)for(const p of c.sources)if(p.storeId===id&&p.resource===r)n+=p.amount;for(const p of s.cultivation.plots)for(const v of p.job?.sources||[])if(v.storeId===id&&v.resource===r)n+=v.amount;return n;}
const rawFree=(s,id,r)=>s.storage.stores[id][r]-rawReserved(s,id,r);
const floor=(s,r)=>BigInt(r==='wood'?4:s.units.length)*3000n;
function balance(s,r,next=s.cultivation.nextFunded){return BigInt(rawFree(s,'b0',r))*3000n+effective(s.cultivation.pantry[r])-floor(s,r)-holds(s,next)[r]-(r==='water'&&next?9000n:0n);}
function funded(s,next=s.cultivation.nextFunded){return SUPPORT.every(r=>balance(s,r,next)>=0n)&&(next?rawFree(s,'b0','water')>=3:true);}
function available(s,id,r,raw){if(!s.cultivation.active||id!=='b0'||!SUPPORT.includes(r))return raw;const n=balance(s,r);let count=n>0n?Number(n/3000n):0;count=Math.min(raw,count);if(r==='water'&&s.cultivation.nextFunded)count=Math.min(count,Math.max(0,raw-3));return Math.max(0,count);}
function nextSeed(s){const p=s.cultivation.plots[0],j=p.job;if(j&&j.phase!=='cancelling')return 2;return Object.values(s.storage.stores).reduce((n,v)=>n+v.seed,0)+s.units.filter(u=>u.resource==='seed').reduce((n,u)=>n+u.cargo,0)+s.cultivation.seedCache;}
function refreshNext(s){const c=s.cultivation;if(c.active&&!c.nextFunded&&nextSeed(s)>=2&&funded(s,true))c.nextFunded=true;}
function quoteProvision(s){const missing=[];for(const r of SUPPORT){const v=balance(s,r,true);if(v<0n)missing.push({resource:r,location:'b0',amount:String(-v),unit:'third-milli'});}if(rawFree(s,'b0','water')<3)missing.push({resource:'water',location:'b0',amount:3-rawFree(s,'b0','water'),unit:'whole recipe items'});if(nextSeed(s)<2)missing.push({resource:'seed',location:'pilot lineage',amount:2-nextSeed(s),unit:'whole'});return{ok:!missing.length,reason:missing.length?'Gather the missing support and next-crop supplies at Hearth store before provisioning':null,action:'Provision this camp',supportStoreId:'b0',ingredientSources:[],recipe:{seed:2,water:3},workSlots:900,growthTicks:900,harvestSlots:0,support:{foodThirdMilli:'900',waterThirdMilli:'900',woodThirdMilli:'4500',fuelIsUpperBound:true},missing,notes:['Protect '+s.units.length+' food and water plus 4 wood.','Only Hearth store supplies this camp.','Standing whole-item pantry top-ups are custody transfers. New invitations are unavailable after activation.']};}
function topup(s,r,needed){const c=s.cultivation,a=c.pantry[r];while(big(a.milli)*3n-big(a.remainder)<needed){if(rawFree(s,'b0',r)<1)throw Error('Funded support has no local physical supply');s.storage.stores.b0[r]--;s.stock[r]--;a.milli=out(big(a.milli)+1000n);a.fundedWhole=out(big(a.fundedWhole)+1n);}}
function charge(s,r,third){const a=s.cultivation.pantry[r];topup(s,r,third);const total=big(a.remainder)+third,posted=total/3n;a.milli=out(big(a.milli)-posted);a.consumedMilli=out(big(a.consumedMilli)+posted);a.remainder=out(total%3n);}
/* A job owns its declining finish bound; optional work may not spend it. */
function allocate(s,job=null,fuelPaid=false){const c=s.cultivation;if(!c.active)return true;const own=job&&remaining(job)>0?1n:0n;
 for(const r of SUPPORT){const debit=r==='wood'?(fuelPaid?0n:5n):1n,release=r==='wood'?own*5n:own;if(balance(s,r)+release<debit)return false;}
 charge(s,'food',1n);charge(s,'water',1n);c.demandSlots=out(big(c.demandSlots)+1n);if(!fuelPaid){charge(s,'wood',5n);c.campSlots=out(big(c.campSlots)+1n);}return true;
}
function returnPantry(s,r,amount){if(!SUPPORT.includes(r)||!whole(amount)||amount<1)return{ok:false,reason:'Choose whole owned pantry supplies'};const a=s.cultivation.pantry[r];if(effective(a)<BigInt(amount)*3000n)return{ok:false,reason:'Fractional pantry material and accrued support remain owned here'};if(s.storage.stores.b0[r]+amount>=LIMIT)return{ok:false,reason:'Store limit reached'};a.milli=out(big(a.milli)-BigInt(amount)*1000n);a.returnedWhole=out(big(a.returnedWhole)+BigInt(amount));s.storage.stores.b0[r]+=amount;s.stock[r]+=amount;return{ok:true,reason:null};}
function beforeTick(s){const c=s.cultivation;if(c.tick+1>=LIMIT)throw Error('Cultivation clock limit reached; export this camp');c.tick++;const add=30000n-big(c.water.poolMilli)<10n?30000n-big(c.water.poolMilli):10n;c.water.poolMilli=out(big(c.water.poolMilli)+add);c.water.inflowMilli=out(big(c.water.inflowMilli)+add);}
function valid(s){try{const c=s.cultivation;if(!c||!whole(c.tick)||!whole(c.nextJob)||c.nextJob<1||!['active','seedDiscovered','woodlandUnlocked','nextFunded'].every(k=>typeof c[k]==='boolean')||!whole(c.seedCache)||c.seedCache>6||!c.water||!wire(c.water.poolMilli)||big(c.water.poolMilli)>30000n||!wire(c.water.inflowMilli)||big(c.water.inflowMilli)>BigInt(c.tick)*10n||!whole(c.water.collected)||!wire(c.demandSlots)||!wire(c.campSlots)||big(c.campSlots)>BigInt(c.tick)||big(c.demandSlots)>BigInt(c.tick*s.units.length)||!whole(c.recipeWaterConsumed))return false;
 if(!c.active&&(c.nextFunded||big(c.demandSlots)||big(c.campSlots)||c.recipeWaterConsumed||c.plots?.some(p=>p.job||p.batchesStarted||p.batchesFinished)))return false;
 if(!c.generated||!c.receipts||!['food','wood'].every(r=>whole(c.generated[r]))||!['pilotFood','woodlandWood'].every(r=>whole(c.receipts[r])))return false;
 if(c.receipts.pilotFood>c.generated.food||c.receipts.woodlandWood>c.generated.wood||c.woodlandUnlocked!==(c.receipts.pilotFood>0))return false;
 if(!Array.isArray(c.plots)||c.plots.length!==2||c.plots.some((p,i)=>!p||p.id!==plots()[i].id||p.x!==plots()[i].x||p.y!==plots()[i].y||!whole(p.batchesStarted)||!whole(p.batchesFinished)||p.batchesFinished>p.batchesStarted))return false;
 if(c.generated.food!==c.plots[0].batchesFinished*6||c.generated.wood!==c.plots[1].batchesFinished*8)return false;
 if(!c.seedDiscovered&&c.seedCache!==6||30000n+big(c.water.inflowMilli)-big(c.water.poolMilli)!==BigInt(c.water.collected)*1000n)return false;
 let recipeWater=0,workSlots=0;for(const p of c.plots){const r=p.id==='pilot'?{water:3,work:900,output:6,receipt:'pilotFood'}:{water:4,work:500,output:8,receipt:'woodlandWood'},j=p.job,inTray=j?.phase==='output';recipeWater+=(p.batchesFinished+(j?.recipeWater&&!inTray?1:0))*r.water;workSlots+=p.batchesFinished*r.work+(j&&!inTray?j.workSlots+j.harvestSlots:0);if(c.receipts[r.receipt]!==(p.batchesFinished-(inTray?1:0))*r.output+(inTray?j.receipted[p.id==='pilot'?'food':'wood']:0))return false;}
 if(c.recipeWaterConsumed!==recipeWater||BigInt(workSlots)>big(c.demandSlots)||big(c.campSlots)>big(c.demandSlots)||big(c.demandSlots)>big(c.campSlots)*BigInt(s.units.length))return false;
 if(!c.pantry||Object.keys(c.pantry).sort().join(',')!=='food,water,wood')return false;
 for(const r of SUPPORT){const a=c.pantry[r];if(!a||Object.keys(a).sort().join(',')!=='consumedMilli,fundedWhole,milli,remainder,returnedWhole'||!Object.values(a).every(wire)||big(a.remainder)>2n||effective(a)<0n)return false;const accrued=r==='wood'?big(c.campSlots)*5n:big(c.demandSlots);if(big(a.consumedMilli)!==accrued/3n||big(a.remainder)!==accrued%3n||big(a.milli)+big(a.consumedMilli)!==(big(a.fundedWhole)-big(a.returnedWhole))*1000n)return false;}
 return true;}catch{return false;}}
function conservation(s){try{const c=s.cultivation;for(const r of R){let total=BigInt(s.stock[r]+s.spent[r]+s.units.filter(u=>u.resource===r).reduce((n,u)=>n+u.cargo,0)+s.deposits.filter(d=>d.kind===r).reduce((n,d)=>n+d.amount,0)+s.construction.sites.reduce((n,j)=>n+j.staged[r],0))*1000n;
  for(const p of c.plots)if(p.job){const j=p.job;total+=BigInt((j.staged[r]||0)+(j.output[r]||0)+(r==='seed'?j.seedLot:0))*1000n;}
  if(SUPPORT.includes(r))total+=big(c.pantry[r].milli)+big(c.pantry[r].consumedMilli);
  if(r==='water')total+=big(c.water.poolMilli)+BigInt(c.recipeWaterConsumed)*1000n;if(r==='seed')total+=BigInt(c.seedCache)*1000n;
  const expected=r==='wood'?416000n+BigInt(c.generated.wood)*1000n:r==='stone'?220000n:r==='food'?225000n+BigInt(c.generated.food)*1000n:r==='water'?30000n+big(c.water.inflowMilli):6000n;if(total!==expected)return false;
 }return true;}catch{return false;}}
const API={R,SUPPORT,LIMIT,MAX,whole,wire,big,out,empty,fresh,effective,remaining,holds,rawReserved,rawFree,balance,funded,available,nextSeed,refreshNext,quoteProvision,allocate,returnPantry,beforeTick,valid,conservation};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.CultivationLedger=API;
})(globalThis);
