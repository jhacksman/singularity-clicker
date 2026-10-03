/* Agriculture vertical slice. Explicit time only; no DOM, storage or offline progress. */
(function(root){
'use strict';
const HearthAPI=typeof module!=='undefined'&&module.exports?require('../hearth/engine.js'):root.HearthGame;
const CROPS={grain:{name:'Grain',work:50,grain:8,seed:2,soil:-18},pulses:{name:'Restorative crop',work:65,grain:5,seed:3,soil:25}};
const BUILD={granary:{name:'Granary',cost:{wood:12,clay:8,grain:8},work:50},irrigation:{name:'Irrigation channels',cost:{wood:18,clay:10,grain:12},work:75}};
const JOBS={water:'Water carriers',wood:'Wood gathering',clay:'Clay gathering',forage:'Wild food and seed',build:'Construction'};
const RESOURCES=['grain','seed','water','wood','clay'];
function fresh(archive=null){const old=archive?JSON.parse(archive):null;return{stage:'agriculture',version:1,time:0,population:old?Math.max(4,Math.min(12,old.people.length)):5,traditions:old?old.traditions:0,sourceArchive:archive,stock:{grain:24,seed:8,water:24,wood:10,clay:8},jobs:{water:1,wood:0,clay:0,forage:0,build:0},fields:Array.from({length:6},(_,id)=>({id,soil:[100,85,70,100,85,70][id],workers:0,crop:null,nextCrop:null,phase:'fallow',work:0,harvests:0,blocked:''})),buildings:[],project:null,harvests:0,forageWork:0,milestone:false};}
function valid(s){
 const n=(v,max=1e9)=>Number.isFinite(v)&&v>=0&&v<=max,int=(v,max)=>Number.isInteger(v)&&n(v,max);
 if(!s||s.stage!=='agriculture'||s.version!==1||!n(s.time)||!int(s.population,12)||s.population<4||!int(s.traditions,5)||!s.stock||!RESOURCES.every(k=>n(s.stock[k],1e5))||!s.jobs||Object.keys(s.jobs).length!==Object.keys(JOBS).length||!Object.keys(JOBS).every(k=>int(s.jobs[k],s.population))||!Array.isArray(s.fields)||s.fields.length!==6||!Array.isArray(s.buildings)||s.buildings.some(k=>!Object.hasOwn(BUILD,k))||new Set(s.buildings).size!==s.buildings.length||!int(s.harvests,1e7)||!n(s.forageWork,15)||typeof s.milestone!=='boolean')return false;
 if(s.fields.some((f,i)=>!f||f.id!==i||!n(f.soil,100)||!int(f.workers,s.population)||![null,...Object.keys(CROPS)].includes(f.crop)||![null,...Object.keys(CROPS)].includes(f.nextCrop)||!['fallow','growing','ripe'].includes(f.phase)||!n(f.work,65)||!int(f.harvests,1e7)||typeof f.blocked!=='string'||(f.phase!=='fallow'&&!f.crop)))return false;
 if(Object.values(s.jobs).reduce((a,b)=>a+b,0)+s.fields.reduce((a,f)=>a+f.workers,0)>s.population)return false;
 if(s.project&&(!Object.hasOwn(BUILD,s.project.kind)||s.buildings.includes(s.project.kind)||!n(s.project.work,BUILD[s.project.kind].work)))return false;
 if(s.sourceArchive!==null){try{if(typeof s.sourceArchive!=='string'||s.sourceArchive.length>5e6||!HearthAPI.valid(JSON.parse(s.sourceArchive))||!JSON.parse(s.sourceArchive).complete)return false;}catch{return false;}}
 return true;
}
class Village{
 constructor(state){this.s=state?structuredClone(state):fresh();if(!valid(this.s))throw Error('Not a compatible Agriculture save.');}
 static fromHearth(state){if(!HearthAPI.valid(state)||!state.complete)throw Error('Finish the first furrow before carrying this hearth onward.');return new Village(fresh(JSON.stringify(state)));}
 get idle(){return this.s.population-Object.values(this.s.jobs).reduce((a,b)=>a+b,0)-this.s.fields.reduce((a,f)=>a+f.workers,0);}
 cap(k){return k==='grain'?(this.has('granary')?140:40):k==='water'?(this.has('irrigation')?120:40):k==='seed'?60:80;}
 has(k){return this.s.buildings.includes(k);}
 add(k,n){const gain=Math.max(0,Math.min(n,this.cap(k)-this.s.stock[k]));this.s.stock[k]+=gain;return gain;}
 allocate(target,count){if(!Number.isInteger(count)||count<0)return false;const field=Number.isInteger(target)?this.s.fields[target]:null;if(!field&&!Object.hasOwn(JOBS,target))return false;const old=field?field.workers:this.s.jobs[target];if(count>old+this.idle)return false;if(field)field.workers=count;else this.s.jobs[target]=count;return true;}
 crop(id,kind){if(!Number.isInteger(id))return false;const f=this.s.fields[id];if(!f||!(kind===null||Object.hasOwn(CROPS,kind)))return false;f.nextCrop=kind;return true;}
 plan(kind){const d=BUILD[kind];if(!Object.hasOwn(BUILD,kind)||this.s.project||this.has(kind)||this.s.harvests<2||(kind==='irrigation'&&!this.has('granary'))||Object.entries(d.cost).some(([k,v])=>this.s.stock[k]<v))return false;for(const[k,v]of Object.entries(d.cost))this.s.stock[k]-=v;this.s.project={kind,work:0};return true;}
 tick(seconds=1){if(!Number.isFinite(seconds)||seconds<=0||seconds>10)throw Error('Tick must be between 0 and 10 seconds.');while(seconds>0){const dt=Math.min(seconds,1);this.step(dt);seconds-=dt;}}
 step(dt){const s=this.s;s.time+=dt;s.stock.grain=Math.max(0,s.stock.grain-s.population*.012*dt);const speed=1+s.traditions*.04;
 this.add('water',s.jobs.water*.6*dt);this.add('grain',s.jobs.forage*.12*dt);s.forageWork+=s.jobs.forage*dt;while(s.forageWork>=15){s.forageWork-=15;this.add('seed',1);}
 if(s.stock.grain>0){this.add('wood',s.jobs.wood*.16*dt);this.add('clay',s.jobs.clay*.14*dt);if(s.project){s.project.work+=s.jobs.build*dt*speed;if(s.project.work>=BUILD[s.project.kind].work){s.buildings.push(s.project.kind);s.project=null;}}}
 for(const f of s.fields){f.blocked='';if(!f.workers){if(f.phase==='fallow')f.soil=Math.min(100,f.soil+dt*.025);f.blocked='No field workers assigned';continue;}
  if(f.phase==='fallow'){if(!f.nextCrop){f.soil=Math.min(100,f.soil+dt*.025);f.blocked='Resting the soil';continue;}if(s.stock.seed<1){f.blocked='Needs seed: assign wild food and seed gathering';continue;}s.stock.seed--;f.crop=f.nextCrop;f.phase='growing';f.work=0;}
  const d=CROPS[f.crop];if(f.phase==='growing'){const water=f.workers*.035*dt*(this.has('irrigation')?.5:1);if(s.stock.water<water){f.blocked='Needs water carriers';continue;}s.stock.water=Math.max(0,s.stock.water-water);f.work=Math.min(d.work,f.work+f.workers*dt*speed);if(f.work>=d.work)f.phase='ripe';}
  if(f.phase==='ripe'){const yieldGrain=Math.floor(d.grain*(.5+f.soil/200));if(s.stock.grain+yieldGrain>this.cap('grain')){f.blocked='Harvest ready: grain storage is full';continue;}this.add('grain',yieldGrain);this.add('seed',d.seed);f.soil=Math.max(0,Math.min(100,f.soil+d.soil));f.harvests++;s.harvests++;f.phase='fallow';f.work=0;f.crop=null;}
 }
 if(s.harvests>=5&&this.has('granary')&&this.has('irrigation')&&s.stock.grain>=40)s.milestone=true;
 }
 serialize(){return JSON.stringify(this.s);}
}
const API={Village,CROPS,BUILD,JOBS,RESOURCES,valid};if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.AgricultureGame=API;
})(typeof globalThis!=='undefined'?globalThis:this);
