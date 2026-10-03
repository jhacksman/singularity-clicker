(function(root){
'use strict';
const EPS=1e-8, MILESTONES=[200,600,1000];
const emptyCounts=()=>({forage:0,scavenge:0,water:0,stone:0,fiber:0,grunt:0,gesture:0});
function freshRun(){return {food:[{kind:'plant',amount:18}],water:18,innovation:0,fibers:0,stones:[],searches:0,bedding:0,route:false,signals:false,slots:0,counts:emptyCounts(),lastExpression:null,phase:0,runMs:0,actions:0,event:0,complete:false,routinesPaused:false};}
function fresh(seed){return {version:1,rng:(seed>>>0)||317837281,tradition:0,claimed:[false,false,false],campaignMs:0,campaignActions:0,everCompleted:false,baseline:null,records:[],discovered:{},settings:{reducedMotion:false},run:freshRun()};}
class Camp{
 constructor(state,seed=Date.now()){this.state=state?structuredClone(state):fresh(seed);if(!Camp.valid(this.state))throw Error('This camp save is not compatible.');}
 static valid(s){
  if(!s||s.version!==1||!s.run||!Array.isArray(s.claimed)||s.claimed.length!==3||!s.claimed.every(v=>typeof v==='boolean'))return false;
  if(!Number.isInteger(s.tradition)||s.tradition<0||s.tradition>3||s.tradition!==s.claimed.filter(Boolean).length)return false;
  const r=s.run, n=(v,max=1e12)=>Number.isFinite(v)&&v>=-EPS&&v<=max;
  if(!n(s.rng,4294967295)||!n(s.campaignMs)||!n(s.campaignActions)||!Array.isArray(s.records)||!s.settings||!s.discovered)return false;
  if(!Array.isArray(r.food)||r.food.length>10000||!r.food.every(l=>l&&['plant','animal'].includes(l.kind)&&n(l.amount,60)))return false;
  if(!n(r.food.reduce((a,l)=>a+l.amount,0),60)||!n(r.water,60)||!n(r.innovation)||!n(r.fibers,12)||!Number.isInteger(r.fibers))return false;
  if(!Array.isArray(r.stones)||r.stones.length>6||!r.stones.every(v=>Number.isInteger(v)&&v>=1&&v<=24))return false;
  if(![0,1,2].includes(r.bedding)||![0,1,2].includes(r.slots)||![0,1,2,3,4].includes(r.event)||!n(r.phase,20000)||!n(r.runMs)||!n(r.actions)||!n(r.searches))return false;
  if(!r.counts||!Object.keys(emptyCounts()).every(k=>n(r.counts[k]))||![null,'grunt','gesture'].includes(r.lastExpression))return false;
  if(!['route','signals','complete','routinesPaused'].every(k=>typeof r[k]==='boolean')||typeof s.everCompleted!=='boolean')return false;
  if(r.complete!==(r.event===4)||r.complete&&!s.everCompleted)return false;
  return true;
 }
 get r(){return this.state.run;}
 get food(){return this.r.food.reduce((sum,l)=>sum+l.amount,0);}
 get plant(){return this.r.food.filter(l=>l.kind==='plant').reduce((sum,l)=>sum+l.amount,0);}
 get animal(){return this.r.food.filter(l=>l.kind==='animal').reduce((sum,l)=>sum+l.amount,0);}
 get discount(){return 1-.05*this.state.tradition;}
 get skill(){return Math.min(3,Math.floor(this.r.searches/3));}
 get active(){return !this.r.event&&!this.r.complete;}
 random(){let x=this.state.rng>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;this.state.rng=x>>>0;return this.state.rng/4294967296;}
 gainFood(amount,kind='plant'){let gain=Math.max(0,Math.min(amount,60-this.food));if(gain>EPS){let last=this.r.food.at(-1);if(last&&last.kind===kind)last.amount+=gain;else this.r.food.push({kind,amount:gain});}return gain;}
 spendFood(amount){while(amount>EPS&&this.r.food.length){const lot=this.r.food[0],take=Math.min(lot.amount,amount);lot.amount-=take;amount-=take;if(lot.amount<EPS)this.r.food.shift();}}
 affordable(f,w){return this.food+EPS>=f&&this.r.water+EPS>=w;}
 pay(f,w){this.spendFood(f);this.r.water=Math.max(0,this.r.water-w);}
 gainI(type){let bonus=this.r.signals&&this.r.lastExpression&&this.r.lastExpression!==type?1:0;return (2+bonus)*(1+.15*this.r.bedding)*(1+.2*this.state.tradition);}
 countAction(){this.r.actions++;if(!this.state.everCompleted)this.state.campaignActions++;}
 quote(id){
  const r=this.r,d=this.discount,tool=r.stones.length>0;let f=0,w=0,out=0,label='',reason='',unit='',note='';
  switch(id){
   case 'forage': f=tool?.25:1;w=tool?.5:1;out=6;label='Forage';unit='plant food';note=tool?'A stone cracks husks and scrapes roots. One tool use.':'Gather edible roots, nuts, and berries.';break;
   case 'scavenge': f=tool?.5:2;w=tool?.5:2;out=8;label='Scavenge';unit='animal food';note='80% chance of 8 food; 20% chance of 2.'+(tool?' One tool use.':'');break;
   case 'water':f=r.route?.5:1;out=r.route?9:7;label='Get water';unit='water';note=r.route?'The familiar route makes the return easier.':'Follow the seep to fresh water.';break;
   case 'stone':f=w=2+6*(1-.25*this.skill);out=1;label='Find stone';unit='stone';note='60% easy · 30% difficult · 10% very difficult. Reserve the maximum; pay actual effort.';if(r.stones.length>=6)reason='All 6 stone places are full.';break;
   case 'fiber':f=w=1;out=1;label='Gather fibers';unit='fiber';note='Bring in dry grasses for a softer place to rest.';if(r.fibers>=12)reason='Fiber storage is full (12).';break;
   case 'grunt':f=2;w=1;out=this.gainI(id);label='Grunt';unit='innovation';note='A sound. A response. Something begins to make sense.';break;
   case 'gesture':f=1;w=2;out=this.gainI(id);label='Gesture';unit='innovation';note='Show the others what you mean.';break;
   case 'morsel':out=2;label='Find a morsel';unit='food';note='A small, free way back on your feet.';if(this.food>=4-EPS)reason='Available below 4 food.';break;
   case 'sip':out=2;label='Take a sip';unit='water';note='A little water, with no supply cost.';if(r.water>=4-EPS)reason='Available below 4 water.';break;
   default:return {ok:false,reason:'Unknown action.'};
  }
  f*=d;w*=d;
  if(!this.active)reason='The cave has your attention.';
  if(!reason&&!this.affordable(f,w))reason='Need '+(this.food+EPS<f?'more food':'')+(this.food+EPS<f&&r.water+EPS<w?' and ':'')+(r.water+EPS<w?'more water':'')+'.';
  let actual=out,minimum;
  if(['forage','scavenge','morsel'].includes(id)){actual=Math.min(out,60-Math.max(0,this.food-f));if(id==='scavenge')minimum=Math.min(2,60-Math.max(0,this.food-f));}
  if(['water','sip'].includes(id))actual=Math.min(out,60-r.water+w);
  return {id,label,f,w,out:actual,minimum,unit,note,tool:tool&&['forage','scavenge'].includes(id),ok:!reason,reason};
 }
 act(id){
  const q=this.quote(id);if(!q.ok)return {ok:false,message:q.reason};
  let f=q.f,w=q.w,out=q.out,message='',r=this.r,broke=false;
  if(id==='stone'){let z=this.random(),extra=z<.6?0:z<.9?2:6;f=w=(2+extra*(1-.25*this.skill))*this.discount;message=extra===0?'A useful edge, close to the surface.':extra===2?'Deeper in the earth. Worth the effort.':'A stubborn search. At last, a useful stone.';}
  this.pay(f,w);this.countAction();if(id in r.counts)r.counts[id]++;
  this.state.discovered[id]=true;
  if(id==='forage'||id==='scavenge'){out=this.gainFood(id==='forage'?6:(this.random()<.8?8:2),id==='forage'?'plant':'animal');if(q.tool){r.stones[0]--;if(r.stones[0]===0){r.stones.shift();broke=true;}}}
  else if(id==='water'||id==='sip'){out=Math.min(id==='sip'?2:r.route?9:7,60-r.water);r.water+=out;}
  else if(id==='morsel')out=this.gainFood(2);
  else if(id==='fiber')r.fibers++;
  else if(id==='stone'){r.stones.push(24);r.searches++;}
  else {out=this.gainI(id);r.innovation+=out;r.lastExpression=id;}
  if(r.innovation>=200)this.state.discovered.prestige=true;
  let fire=false;if(r.innovation+EPS>=1200&&!r.event){r.event=1;fire=true;}
  return {ok:true,id,f,w,out,unit:q.unit,broke,fire,message};
 }
 upgrade(id){
  const r=this.r,d=this.discount;let name='',f=0,w=0,fibers=0,requirements=[],effect='',owned=false,visible=true;
  if(id==='bedding'){name=r.bedding===0?'A place to rest':'Better bedding';owned=r.bedding===2;f=4;w=2;fibers=6;visible=!!this.state.discovered.fiber||r.bedding>0;requirements=[{label:'Fibers',have:r.fibers,need:6}];effect=r.bedding===0?'50 comfort · 15% more innovation':'100 comfort · 30% more innovation total';}
  else if(id==='route'){name='Familiar water route';owned=r.route;f=10;w=4;visible=!!this.state.discovered.water;requirements=[{label:'Water trips',have:r.counts.water,need:10}];effect='Bring back 9 water for just 0.5 food.';}
  else if(id==='signals'){name='Shared signals';owned=r.signals;f=10;w=8;visible=!!(this.state.discovered.grunt&&this.state.discovered.gesture);requirements=[{label:'Innovation',have:r.innovation,need:80},{label:'Grunts',have:r.counts.grunt,need:8},{label:'Gestures',have:r.counts.gesture,need:8}];effect='+1 base innovation when you change expression.';}
  else if(id==='provision'){name=r.slots===0?'Shared provisioning':'A second routine';owned=r.slots===2;f=r.slots?16:12;w=f;visible=r.signals||!!this.state.discovered.provision;requirements=r.slots?[{label:'Innovation',have:r.innovation,need:600}]:[{label:'Innovation',have:r.innovation,need:240},{label:'Shared signals',have:Number(r.signals),need:1},{label:'Foraging trips',have:r.counts.forage,need:10},{label:'Water trips',have:r.counts.water,need:10}];effect=r.slots?'The group brings both food and water every round.':'Every 20 seconds, the group gathers the scarcer supply.';}
  else return {ok:false,visible:false};
  f*=d;w*=d;let met=requirements.every(q=>q.have+EPS>=q.need),ok=!owned&&met&&this.active&&this.affordable(f,w)&&r.fibers>=fibers;
  return {id,name,f,w,fibers,requirements,effect,owned,visible,met,ok};
 }
 buy(id){const q=this.upgrade(id);if(!q.ok)return {ok:false,message:q.owned?'Already learned.':!q.met?'Keep practicing to discover this.':'Gather the needed supplies first.'};this.pay(q.f,q.w);this.r.fibers-=q.fibers;this.countAction();if(id==='bedding')this.r.bedding++;if(id==='route')this.r.route=true;if(id==='signals')this.r.signals=true;if(id==='provision'){this.r.slots++;this.state.discovered.provision=true;}return {ok:true,message:q.name+' learned.',id};}
 round(){
  let food=0,water=0;const r=this.r,m=1+.1*this.state.tradition;
  const doFood=()=>{if(r.water+EPS>=2&&this.food+6*m<=60+EPS){r.water-=2;food+=this.gainFood(6*m);water-=2;}};
  const doWater=()=>{if(this.food+EPS>=1&&r.water+7*m<=60+EPS){this.spendFood(1);r.water+=7*m;food-=1;water+=7*m;}};
  if(!r.slots||r.routinesPaused)return {food,water};
  if(r.slots===1){if(this.food<=r.water)doFood();else doWater();}else{doFood();doWater();}
  return {food,water};
 }
 advance(ms){
  if(!Number.isFinite(ms)||ms<=0||this.r.complete)return [];
  this.r.runMs+=ms;if(!this.state.everCompleted)this.state.campaignMs+=ms;
  const rounds=[];if(this.r.event)return rounds;
  this.r.phase+=ms;while(this.r.phase>=20000){this.r.phase-=20000;rounds.push(this.round());}return rounds;
 }
 get eligible(){return MILESTONES.map((v,i)=>this.r.innovation+EPS>=v&&!this.state.claimed[i]);}
 prestige(){
  const eligible=this.eligible,gain=eligible.filter(Boolean).length;
  if(!this.active||!gain)return {ok:false,message:'No new tradition to pass on yet.'};
  this.countAction();this.state.records.push({kind:'generation',ms:this.r.runMs,actions:this.r.actions,innovation:this.r.innovation});this.state.records=this.state.records.slice(-30);
  eligible.forEach((v,i)=>{if(v)this.state.claimed[i]=true;});this.state.tradition+=gain;this.state.run=freshRun();
  return {ok:true,message:'A new generation remembers. +'+gain+' Tradition.'};
 }
 fireStep(){
  const r=this.r;if(!r.event||r.complete)return {ok:false};this.countAction();r.event++;
  if(r.event===4){r.complete=true;const record={kind:'complete',ms:r.runMs,campaignMs:this.state.campaignMs,actions:r.actions,campaignActions:this.state.campaignActions,tradition:this.state.tradition};this.state.records.push(record);if(!this.state.everCompleted)this.state.baseline=structuredClone(r);this.state.everCompleted=true;return {ok:true,complete:true};}return {ok:true};
 }
 replay(){if(!this.r.complete)return {ok:false};this.state.run=freshRun();return {ok:true};}
 serialize(){return JSON.stringify(this.state);}
}
root.CaveEngine={Camp,fresh,MILESTONES};if(typeof module!=='undefined'&&module.exports)module.exports=root.CaveEngine;
})(typeof globalThis!=='undefined'?globalThis:this);
