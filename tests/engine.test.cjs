const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Camp}=require('../src/engine.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const supplies=(c,f,w)=>{c.r.food=f?[{kind:'plant',amount:f}]:[];c.r.water=w;};

test('A depleted camp recovers without resets or emergency experience',()=>{
 const c=new Camp(null,12);supplies(c,0,0);
 for(const id of ['morsel','morsel','sip','forage','forage','water','water'])assert.ok(c.act(id).ok,id);
 close(c.food,12);close(c.r.water,14);assert.equal(c.r.counts.forage,2);assert.equal(c.r.counts.water,2);assert.equal(c.r.innovation,0);
});
test('Unaffordable searches are atomic, reserve the worst case, and do not reroll RNG',()=>{
 const c=new Camp(null,99);supplies(c,7.99,20);const before=c.serialize();assert.equal(c.act('stone').ok,false);assert.equal(c.serialize(),before);
 supplies(c,20,20);const result=c.act('stone');assert.ok([2,4,8].includes(result.f));close(result.f,result.w);assert.deepEqual(c.r.stones,[24]);
 c.r.searches=9;close(c.quote('stone').f,3.5);
});
test('Stone tools reduce gathering costs, wear exactly once, and hand over to the next tool',()=>{
 const c=new Camp();c.r.stones=[1,24];const f=c.food,w=c.r.water;const result=c.act('forage');assert.ok(result.broke);close(c.food,f-.25+6);close(c.r.water,w-.5);assert.deepEqual(c.r.stones,[24]);
 const uses=c.r.stones[0];c.act('water');c.act('fiber');c.act('grunt');assert.equal(c.r.stones[0],uses);
});
test('Food origins use FIFO and output caps reflect supply expenditure',()=>{
 const c=new Camp();c.r.food=[{kind:'plant',amount:1},{kind:'animal',amount:5}];c.act('grunt');close(c.plant,0);close(c.animal,4);
 supplies(c,59,20);assert.equal(c.quote('forage').out,2);assert.equal(c.act('forage').out,2);close(c.food,60);
});
test('Bedding and responsive signals multiply learning; innovation is never spent',()=>{
 const c=new Camp();supplies(c,60,60);c.r.fibers=6;assert.ok(c.buy('bedding').ok);c.r.fibers=6;assert.ok(c.buy('bedding').ok);
 c.r.innovation=80;c.r.counts.grunt=8;c.r.counts.gesture=8;c.r.lastExpression='grunt';assert.ok(c.buy('signals').ok);close(c.r.innovation,80);
 close(c.act('gesture').out,3.9);close(c.act('gesture').out,2.6);c.act('water');close(c.act('grunt').out,3.9);
});
test('Routines run at boundaries, check full output, and never create manual experience',()=>{
 const c=new Camp();c.r.slots=2;supplies(c,20,20);c.advance(19999);close(c.food,20);const rounds=c.advance(1);assert.equal(rounds.length,1);close(c.food,25);close(c.r.water,25);assert.equal(c.r.actions,0);assert.equal(c.r.counts.forage,0);
 supplies(c,56,54);c.advance(20000);close(c.food,56);close(c.r.water,54); // both full outputs would overflow
 c.r.slots=1;supplies(c,0,0);c.advance(20000);close(c.food,0);close(c.r.water,0); // no fallback, no negative supply
 c.r.routinesPaused=true;supplies(c,20,20);c.advance(20000);close(c.food,20);
});
test('Prestige grants each milestone once, resets the camp, and retains first-journey time',()=>{
 const c=new Camp();c.advance(123000);c.r.innovation=200;assert.ok(c.prestige().ok);assert.equal(c.state.tradition,1);close(c.r.runMs,0);close(c.state.campaignMs,123000);close(c.food,18);assert.equal(c.r.lastExpression,null);
 c.r.innovation=200;assert.equal(c.prestige().ok,false);c.r.innovation=1000;assert.ok(c.prestige().ok);assert.equal(c.state.tradition,3);assert.deepEqual(c.state.claimed,[true,true,true]);
 close(c.quote('grunt').f,1.7);close(c.quote('grunt').out,3.2);c.r.innovation=1000;assert.equal(c.prestige().ok,false);
});
test('Fire depends on innovation alone, survives saves, is free, and preserves the completed baseline',()=>{
 let c=new Camp();c.r.innovation=1198;supplies(c,2,1);assert.ok(c.act('grunt').fire);close(c.food,0);close(c.r.water,0);assert.equal(c.r.event,1);
 c.r.slots=2;const phase=c.r.phase;c.advance(20000);close(c.food,0);close(c.r.phase,phase);
 c=new Camp(JSON.parse(c.serialize()));assert.equal(c.r.event,1);assert.ok(c.fireStep().ok);c=new Camp(JSON.parse(c.serialize()));assert.equal(c.r.event,2);assert.ok(c.fireStep().ok);assert.ok(c.fireStep().complete);
 const baseline=JSON.stringify(c.state.baseline);assert.ok(c.state.everCompleted);assert.equal(c.fireStep().ok,false);assert.ok(c.replay().ok);assert.ok(c.state.everCompleted);assert.equal(JSON.stringify(c.state.baseline),baseline);
 c.r.innovation=200;c.prestige();assert.equal(JSON.stringify(c.state.baseline),baseline);assert.ok(c.state.everCompleted);
});
test('Saving preserves exact random sequence and full camp state',()=>{
 const c=new Camp(null,4294960000);c.act('stone');c.act('scavenge');c.advance(8751);const restored=new Camp(JSON.parse(c.serialize()));
 assert.deepEqual(restored.act('scavenge'),c.act('scavenge'));assert.equal(restored.serialize(),c.serialize());
 const bad=JSON.parse(c.serialize());bad.run.water=-10;assert.throws(()=>new Camp(bad));bad.run.water=0;bad.tradition=9;assert.throws(()=>new Camp(bad));
});

function choose(c,efficient,prestige){
 const r=c.r,d=c.discount;
 function fund(f,w){f*=d;w*=d;if(c.food+1e-8<f)return c.quote('forage').ok?'forage':c.food<4?'morsel':'sip';if(r.water+1e-8<w)return c.quote('water').ok?'water':'morsel';return null;}
 const invest=(f,w)=>fund(f+(efficient?4/d:0),w+(efficient?4/d:0));
 if(prestige&&!c.state.tradition&&r.innovation>=200)return '!prestige';
 if(!r.stones.length&&(efficient||r.innovation>=180)){const effort=2+6*(1-.25*c.skill);return invest(effort,effort)||'stone';}
 const bed=efficient?2:r.innovation<200?0:r.innovation<600?1:2;
 if(r.bedding<bed){if(r.fibers<6)return invest(1,1)||'fiber';return invest(4,2)||'!bedding';}
 if(!r.route&&r.counts.water>=10&&(efficient||r.innovation>=500))return invest(10,4)||'!route';
 if(!r.signals&&r.innovation>=(efficient?80:350)&&Math.min(r.counts.grunt,r.counts.gesture)>=8)return invest(10,8)||'!signals';
 if(r.signals&&r.slots<2&&r.innovation>=(efficient?(r.slots?600:240):(r.slots?900:500))&&Math.min(r.counts.water,r.counts.forage)>=10){const cost=r.slots?16:12;return invest(cost,cost)||'!provision';}
 const action=efficient?(r.lastExpression==='grunt'?'gesture':'grunt'):(Math.floor((r.counts.grunt+r.counts.gesture)/8)%2?'gesture':'grunt');
 const f=action==='grunt'?2:1,w=action==='grunt'?1:2;if(!c.affordable(f*d,w*d))return fund(f,w);
 if(c.food<(efficient?8:14))return fund(1,1)||'forage';if(r.water<(efficient?8:14))return fund(r.route?.5:1,0)||'water';return action;
}
test('The actual game completes ordinary, efficient, and optional-prestige playthroughs',()=>{
 const medians=[];
 for(const policy of [{efficient:false,prestige:false},{efficient:true,prestige:false},{efficient:true,prestige:true}]){
  const results=[];
  for(let seed=1;seed<=20;seed++){
   const c=new Camp(null,seed*91717);let actions=0;
   while(!c.r.event&&actions<2000){const id=choose(c,policy.efficient,policy.prestige);const result=id==='!prestige'?c.prestige():id.startsWith('!')?c.buy(id.slice(1)):c.act(id);assert.ok(result.ok,`${JSON.stringify(policy)} ${id} at ${actions}: ${result.message}`);c.advance(1000);actions++;assert.ok(Camp.valid(c.state));}
   assert.equal(c.r.event,1);for(let i=0;i<3;i++){c.advance(1000);c.fireStep();actions++;}assert.ok(c.r.complete);assert.ok(actions<900);results.push(actions);
  }
  results.sort((a,b)=>a-b);medians.push(results[Math.floor(results.length/2)]);
 }
 assert.ok(medians[1]<medians[0]*.72,JSON.stringify(medians));assert.ok(medians[2]>medians[1]&&medians[2]<medians[0],JSON.stringify(medians));console.log('Actual-engine median actions / seconds at 1 action per second:',medians);
});
