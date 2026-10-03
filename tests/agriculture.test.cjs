const test=require('node:test'),assert=require('node:assert/strict');
const {Village,valid}=require('../src/agriculture/engine.js');
const {Hearth}=require('../src/hearth/engine.js');
const step=(v,n)=>{for(let i=0;i<n;i++)v.tick(1);};
test('Agriculture allocations and repeated crop orders cannot invent workers or reset growth',()=>{
 const v=new Village();assert.ok(v.allocate(0,3));assert.equal(v.allocate(1,3),false);assert.equal(v.idle,1);v.crop(0,'grain');step(v,5);
 const work=v.s.fields[0].work,seed=v.s.stock.seed;for(let i=0;i<100;i++){v.crop(0,'grain');v.allocate(0,3);}assert.equal(v.s.fields[0].work,work);assert.equal(v.s.stock.seed,seed);
 for(const target of [-1,100,'constructor','__proto__'])assert.equal(v.allocate(target,1),false);assert.equal(v.crop('__proto__','grain'),false);assert.ok(valid(v.s));
});
test('crop choices trade food yield for soil recovery and apply after the current harvest',()=>{
 const grain=new Village(),restorative=new Village();for(const v of [grain,restorative]){v.s.fields[0].soil=60;v.allocate(0,1);}grain.crop(0,'grain');restorative.crop(0,'pulses');step(grain,50);step(restorative,65);
 assert.equal(grain.s.fields[0].soil,42);assert.equal(restorative.s.fields[0].soil,85);assert.ok(grain.s.stock.grain>restorative.s.stock.grain);
 grain.tick(1);grain.crop(0,'pulses');assert.equal(grain.s.fields[0].crop,'grain');assert.equal(grain.s.fields[0].nextCrop,'pulses');
});
test('zero grain, seed and water recover through assigned work with no resets',()=>{
 const v=new Village();v.s.stock.grain=v.s.stock.seed=v.s.stock.water=0;v.allocate('forage',2);v.allocate(0,2);v.crop(0,'grain');step(v,120);
 assert.ok(v.s.harvests>0);assert.ok(v.s.stock.grain>0&&v.s.stock.seed>0&&v.s.stock.water>0);assert.equal(v.s.population,5);assert.ok(valid(v.s));
});
test('invalid saves and future schemas are rejected; completed Hearth handoff is non-destructive',()=>{
 const h=new Hearth();assert.throws(()=>Village.fromHearth(h.s));h.s.complete=true;h.s.plowed=1;const before=h.serialize();const v=Village.fromHearth(h.s);assert.equal(h.serialize(),before);assert.equal(v.s.sourceArchive,before);assert.equal(v.s.population,h.s.people.length);
 for(const mutate of [s=>s.version=2,s=>s.jobs.water=-1,s=>s.stock.grain=NaN,s=>s.fields[0].workers=12,s=>s.sourceArchive='bad',s=>s.jobs.extra=100,s=>s.fields[0].crop='magic']){const bad=JSON.parse(v.serialize());mutate(bad);assert.throws(()=>new Village(bad));}
});
test('crop and construction state resume identically; ten seconds equals ten one-second ticks',()=>{
 const a=new Village();a.crop(0,'grain');a.allocate(0,3);step(a,31);const b=new Village(JSON.parse(a.serialize()));a.tick(10);step(b,10);assert.equal(a.serialize(),b.serialize());
});
function policy(v){
 v.crop(0,'grain');v.crop(1,'pulses');v.allocate(0,2);v.allocate(1,1);
 const flex=['wood','clay','forage','build'];for(const job of flex)v.allocate(job,0);
 const next=v.has('granary')?'irrigation':'granary';
 if(!v.has(next)&&!v.s.project)v.plan(next);
 let job=v.s.project?'build':v.s.stock.wood<(v.has('granary')?18:12)?'wood':v.s.stock.clay<(v.has('granary')?10:8)?'clay':'forage';v.allocate(job,1);
}
test('ordinary farm decisions reach dependable surplus across refreshes without boosted resources',()=>{
 let v=new Village();for(let t=0;t<2400&&!v.s.milestone;t++){policy(v);v.tick(1);if(t%37===0)v=new Village(JSON.parse(v.serialize()));}
 assert.equal(v.s.milestone,true);assert.ok(v.has('granary')&&v.has('irrigation'));assert.ok(v.s.stock.grain>=40);assert.ok(valid(v.s));
 const before=v.serialize();assert.equal(v.plan('granary'),false);assert.equal(v.serialize(),before);console.log('Agriculture first surplus:',v.s.time,'simulated seconds');
});
