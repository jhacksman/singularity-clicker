/* Read-only guidance for existing local supplies; never commands or funds work. */
(function(root){
'use strict';
const resources=['wood','stone','food','water','seed'];
const ledger=typeof module!=='undefined'&&module.exports?require('./ledger.js'):root.CultivationLedger;
function goods(map){return resources.filter(r=>map?.[r]>0).map(r=>Math.round(map[r]*100)/100+' '+r).join(' · ')||'none';}
function missingText(rows){
 const groups=new Map(),other=[];
 for(const p of rows||[]){const amount=Number(p.amount),where=p.location==='b0'?'Hearth store':p.location;
  if(!Number.isFinite(amount)){other.push(p.resource+' recipe at '+where);continue;}
  const needed=Math.ceil(p.unit==='third-milli'?amount/3000:amount),key=p.resource+'\0'+where,old=groups.get(key);
  if(needed>0&&(!old||needed>old.needed))groups.set(key,{resource:p.resource,where,needed});
 }
 return [...groups.values()].map(p=>p.needed+' whole '+p.resource+' to '+p.where).concat(other).join('; ')||'no additional supplies';
}
function waterTransport(camp,missing){
 const needsWater=Array.isArray(missing)&&missing.some(p=>{
  if(!p||p.resource!=='water'||p.location!=='b0')return false;
  if(p.unit==='third-milli'){try{return ledger.big(p.amount)>0n;}catch{return false;}}
  return p.unit==='whole recipe items'&&Number.isSafeInteger(p.amount)&&p.amount>0&&p.amount<ledger.LIMIT;
 });
 if(!needsWater)return null;
 const stores=camp.stores();if(!stores.some(v=>v.id==='b0'))return null;
 const source=stores.find(v=>v.id!=='b0'&&v.kind==='outpost'&&Number.isSafeInteger(v.available?.water)&&v.available.water>0&&v.available.water<ledger.LIMIT&&camp.transferTargets(v.id,'b0').length>0);
 return source?{sourceId:source.id,sourceName:source.name,availableWater:source.available.water}:null;
}
function transportText(hint){
 return hint.availableWater+' whole water is available at '+hint.sourceName+'. Select empty-handed villagers, inspect this store, choose Hearth store and water, review the carrier preview, then Send selected carriers. Water counts at Hearth only after delivery; review the support quote again when it arrives.';
}
function nextOpportunity(camp){
 const s=camp.summary(),recovery=s.plots.find(p=>p.phase==='cancelling'),output=s.plots.find(p=>p.phase==='output'),harvest=s.plots.find(p=>p.phase==='harvest');
 if(recovery)return{title:'Bring planting supplies back',detail:'Unstarted materials remain at '+recovery.label+'. Select villagers and use Recover planting supplies; staged and carried goods return through actual loads.',actionLabel:'Inspect recovery',targetId:recovery.id};
 if(output)return Object.values(output.output).some(n=>n>0)?{title:'Bring the yield home',detail:output.label+' holds '+goods(output.output)+'. Select villagers and collect the retained seed, then food or wood. Materials become useful at their actual receiving store.',actionLabel:'Inspect yield',targetId:output.id}:{title:'Deliver the carried yield',detail:'The plot tray is empty and its output is still with the carriers. Their loads need a real store receipt. Use Stop and Return if a carrier is holding a load.',actionLabel:'Inspect delivery',targetId:output.id};
 if(harvest)return{title:'Harvest the woodland',detail:'Growth is finished. Assign villagers for the remaining paid harvest work, then carry its wood and retained seed home.',actionLabel:'Inspect woodland',targetId:harvest.id};
 const provision=s.active?null:camp.provisionQuote(),missing=s.active?s.nextMissing:provision.missing;
 const transport=(s.active?!s.nextFunded:!provision.ok)?waterTransport(camp,missing):null;
 if(transport)return{title:'Bring stored water to the Hearth',detail:(s.active?'Committed crops keep their paid work. For the following crop, replenish ':'Before starting support, replenish ')+missingText(missing)+'. '+transportText(transport),actionLabel:'Inspect '+transport.sourceName,targetId:transport.sourceId};
 if(s.active&&!s.nextFunded)return{title:'Fund the next crop',detail:'Committed crops keep their paid work. Replenish '+missingText(s.nextMissing)+'. Ordinary gathering and committed output remain available.',actionLabel:'Inspect Hearth store',targetId:'b0'};
 return{title:s.active?'Tend a supply patch':'Prepare a supported camp',detail:s.active?'A planted crop returns food and its retained seed. Gather or deliver other supplies while it grows. This is local cultivation; First Furrow and Agriculture are still unavailable.':(provision.ok?'Review the support quote. ':'Collect water and discover the seed cache, then inspect the support quote. ')+'Rules begin only when you confirm Provision this camp.',actionLabel:'Inspect pilot plot',targetId:'pilot'};
}
const API={goods,missingText,waterTransport,transportText,nextOpportunity};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HearthCultivationGuidance=API;
})(globalThis);
