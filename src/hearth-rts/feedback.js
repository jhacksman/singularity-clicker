/* Read-only, visit-local observations. Never owns simulation or save state. */
(function(root){
'use strict';
const resources=['wood','stone','food'];
const clone=value=>JSON.parse(JSON.stringify(value));
const ordinary=u=>u.order.kind==='gather'&&!u.next&&!u.transfer&&!u.reclaim&&!u.supply&&['extract','return'].includes(u.phase);
const storeName=b=>b.kind==='hearth'?'Hearth store':'Outpost '+b.id.slice(1)+' store';
const isStore=b=>b.done&&!b.retiring&&['hearth','outpost'].includes(b.kind);
function adjacent(u,b){
 const z=b.kind==='hearth'?3:2,near=(a,v)=>Math.abs(a-v)<.001;
 for(let i=0;i<z;i++)if(near(u.x,b.x-1)&&near(u.y,b.y+i)||near(u.x,b.x+z)&&near(u.y,b.y+i)||near(u.x,b.x+i)&&near(u.y,b.y-1)||near(u.x,b.x+i)&&near(u.y,b.y+z))return true;
 return false;
}
function snapshot(s){
 return{time:s.time,tools:s.tools,units:new Map(s.units.map(u=>[u.id,{unit:clone(u),stamp:JSON.stringify(u)}])),
  delivered:{...s.delivered},deposits:clone(s.deposits),buildings:clone(s.buildings),
  topology:JSON.stringify([s.buildings.map(b=>[b.id,b.kind,b.x,b.y,b.done,!!b.retiring]),s.deposits.map(d=>[d.id,d.x,d.y,d.amount>0])])};
}
class Session{
 constructor(){this.reset();}
 reset(){this.previous=null;this.pending=null;this.cycles=new Map();this.loads=new Map();this.samples=[];this.receipts=[];}
 reconcile(now){
  // An unobserved clock jump is a new observation session, never inferred history.
  if(this.previous&&now.time!==this.previous.time)this.reset();
  if(this.previous){
   if(now.topology!==this.previous.topology||now.tools!==this.previous.tools)this.cycles.clear();
   for(const [id,row] of now.units)if(row.stamp!==this.previous.units.get(id)?.stamp){this.cycles.delete(id);this.loads.delete(id);}
  }
  for(const [id,row] of now.units)if(!ordinary(row.unit)){this.cycles.delete(id);this.loads.delete(id);}
 }
 // Called after visible commands too: Stop then Gather between ticks must not
 // restore a previously interrupted observation merely by restoring actor bytes.
 notice(s){const now=snapshot(s);this.reconcile(now);this.previous=now;this.pending=null;}
 before(s){const now=snapshot(s);this.reconcile(now);this.pending=now;}
 after(s){
  const before=this.pending,after=snapshot(s);this.pending=null;
  if(!before){this.previous=after;return;}
  const dt=after.time-before.time;
  if(dt===0){this.previous=after;return;}
  if(!(dt>0&&dt<=1.000001)){this.reset();this.previous=after;return;}
  if(before.topology!==after.topology||before.tools!==after.tools)this.cycles.clear();
  const delivered=[];
  for(const [id,row] of before.units){
   const u=row.unit,v=after.units.get(id)?.unit;if(!v){this.cycles.delete(id);this.loads.delete(id);continue;}
   const cycle=this.cycles.get(id);
   if(cycle){
    if(!ordinary(u)||u.order.target!==cycle.sourceId||before.tools!==cycle.tools||before.topology!==cycle.topology)this.cycles.delete(id);
    else if(u.path.length)cycle.travelSeconds+=dt;
    else if(u.phase==='extract')cycle.extractSeconds+=dt;
    else cycle.otherSeconds+=dt;
   }
   // Observe the first item's work from zero, not just its eventual cargo credit.
   // An imported half-worked item or mid-item tool completion is not new Tools work.
   if(ordinary(u)&&!u.path.length&&u.phase==='extract'&&!u.cargo&&u.work===0&&!this.loads.has(id))
    this.loads.set(id,{sourceId:u.order.target,amount:0,tools:before.tools===true&&after.tools===true});
   if(ordinary(u)&&!u.path.length&&u.phase==='extract'&&v.cargo===u.cargo+1){
    const d=before.deposits.find(d=>d.id===u.order.target);
    if(d&&v.resource===d.kind){
     const load=this.loads.get(id);
     if(load&&load.sourceId===d.id&&load.amount===u.cargo){load.amount++;load.tools=load.tools&&before.tools===true&&after.tools===true;}
     else this.loads.delete(id);
    }
   }
   if(before.tools!==after.tools&&this.loads.has(id))this.loads.get(id).tools=false;
   if(u.phase==='return'&&!u.path.length&&u.cargo>0&&!v.cargo&&!u.transfer&&!u.reclaim&&!u.supply){
    const b=before.buildings.find(b=>isStore(b)&&(!u.dropoff||b.id===u.dropoff)&&adjacent(u,b));
    if(b)delivered.push({id,u,b,eligible:ordinary(u)});
   }
  }
  // Several receipts and other material operations may share a tick. Verify the
  // aggregate genuine gathered counter, not a misleading net store-stock delta.
  const credited=resources.every(r=>after.delivered[r]-before.delivered[r]===delivered.filter(x=>x.u.resource===r).reduce((n,x)=>n+x.u.cargo,0));
  for(const {id,u,b,eligible} of delivered){
   const load=this.loads.get(id);this.loads.delete(id);
   if(!credited||!eligible){this.cycles.delete(id);continue;}
   const d=after.deposits.find(d=>d.id===u.order.target);
   if(!d||d.kind!==u.resource){this.cycles.delete(id);continue;}
   const receipt={workerId:id,workerName:u.name,sourceId:d.id,storeId:b.id,storeName:storeName(b),resource:u.resource,
    amount:u.cargo,time:after.time,tools:before.tools===true&&after.tools===true,sourceRemaining:d.amount,
    producedWithTools:!!load&&load.sourceId===d.id&&load.amount===u.cargo&&load.tools};
   this.receipts.push(receipt);this.receipts=this.receipts.slice(-24);
   const cycle=this.cycles.get(id);
   if(u.cargo===5&&cycle&&cycle.storeId===b.id&&cycle.sourceId===d.id&&cycle.tools===receipt.tools&&cycle.topology===after.topology){
    const sample={...receipt,seconds:after.time-cycle.time,extractSeconds:cycle.extractSeconds,
     travelSeconds:cycle.travelSeconds,otherSeconds:cycle.otherSeconds,topology:after.topology};
    if(sample.seconds>0){
     const prior=this.samples.findIndex(x=>x.workerId===id&&x.sourceId===d.id&&x.storeId===b.id&&x.tools===sample.tools&&x.topology===sample.topology);
     if(prior>=0)this.samples.splice(prior,1);this.samples.push(sample);
     const same=this.samples.filter(x=>x.sourceId===d.id);if(same.length>8)this.samples.splice(this.samples.indexOf(same[0]),1);
    }
   }
   this.cycles.delete(id);
   if(u.cargo===5&&before.tools===after.tools&&before.topology===after.topology&&ordinary(after.units.get(id).unit))
    this.cycles.set(id,{sourceId:d.id,storeId:b.id,tools:receipt.tools,topology:after.topology,time:after.time,extractSeconds:0,travelSeconds:0,otherSeconds:0});
  }
  if(!credited)this.cycles.clear();
  this.previous=after;
 }
 samplesFor(sourceId){return clone(this.samples.filter(x=>x.sourceId===sourceId).map(x=>({...x,currentLayout:x.topology===this.previous?.topology})));}
 latestReceipt({toolsOnly=false}={}){const r=this.receipts.slice().reverse().find(r=>!toolsOnly||r.producedWithTools);return r?clone(r):null;}
}
const goods=amounts=>resources.filter(r=>amounts[r]>0).map(r=>amounts[r]+' '+r).join(' + ');
function nextStep(camp,session){
 const s=camp.s,project=s.knapping,workshop=s.buildings.find(b=>b.id===project?.workshop)||s.buildings.find(b=>b.kind==='workshop'&&b.done);
 if(workshop&&s.tools){
  const receipt=session.latestReceipt({toolsOnly:true}),known=s.deposits.filter(d=>d.amount>0&&camp.visible(d.x,d.y));
  const source=known.find(d=>d.id===receipt?.sourceId)||known.find(d=>d.x>20)||known[0];
  if(!source){const remains=s.deposits.some(d=>d.amount>0),store=s.buildings.find(b=>b.id===receipt?.storeId&&isStore(b))||s.buildings.find(isStore);
   return{kind:remains?'scout':'exhausted',title:remains?'Scout for another source':'The finite sources are exhausted',
    detail:remains?'The known deposits are empty. Select villagers and scout to find another source; the tools stay with your camp.':'Nothing here grows back. Your tools and stored goods remain. Inspect the stores to plan remaining work or recovery; there is no further resource grant.',targetId:store?.id,actionLabel:'Inspect stored supplies'};
  }
  return{kind:'use-tools',title:receipt?'Tools are doing useful work':'Put the tools to work',
   detail:(receipt?receipt.workerName+' delivered '+receipt.amount+' '+receipt.resource+' to '+receipt.storeName+', observed this visit. ':'Gather another load to see the payoff. ')+
    'Tools shorten extraction; a closer outpost shortens the haul. Inspect a deposit to compare observed trips.',targetId:source?.id||workshop.id,actionLabel:source?'Inspect a deposit':'Inspect workshop'};
 }
 if(workshop){
  if(project){const workers=s.units.filter(u=>(u.next||u.order).kind==='craft'&&(u.next||u.order).target===workshop.id).length;
   return{kind:'finish-tools',title:'Finish useful edges',detail:'Materials already paid. '+project.work.toFixed(1)+' / 12 worker-seconds; '+workers+' assigned. '+(workers?'Work continues on Resume if paused.':'Select villagers and assign them at the original workshop; progress is kept.'),targetId:workshop.id,actionLabel:'Inspect workshop'};
  }
  const q=camp.knappingFunding(workshop.id),missing=goods(q.missing);
  return{kind:'fund-tools',title:'Make the workshop useful',detail:'Craft useful edges: 4 wood + 8 stone, 12 worker-seconds. Funding: '+q.name+'. '+(q.error?q.error:missing?'Still needed here: '+missing+'. Gather supplies here or use Stores to send carriers to this store.':'Materials available here. Select villagers, then reserve materials at the workshop.'),targetId:workshop.id,actionLabel:'Inspect workshop'};
 }
 const site=s.buildings.find(b=>!b.done),outpost=s.buildings.find(b=>b.kind==='outpost'&&b.done&&!b.retiring&&b.x>20);
 if(site)return{kind:'construction',title:'Follow the building supplies',detail:'Inspect the site to see its reserved, carried and delivered materials and the next physical step.',targetId:site.id,actionLabel:'Inspect site'};
 return{kind:outpost?'workshop':'expansion',title:outpost?'Give the camp a workshop':'Reach the eastern grove',detail:outpost?'Gather into the eastern store, then build a workshop nearby. It turns paid materials and worker time into useful tools.':'Gather finite supplies and scout across the ford. A drop-off near the eastern deposits shortens carrying; food at the Hearth can invite another worker.',targetId:outpost?.id||'b0',actionLabel:'Inspect store'};
}
const API={Session,nextStep};if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.HearthFeedback=API;
})(globalThis);
