/* Original Canvas artwork, authored for the 2026-10-08 visual references.
   Pure presentation: all coordinates, quantities and availability come from callers. */
(function(root){
'use strict';
const P={ink:'#30355c',purple:'#7760bf',plum:'#594291',grass:'#d5e787',green:'#0d8c69',leaf:'#56b44d',lime:'#9bcd47',gold:'#ffc34c',orange:'#ef922f',clay:'#c67456',sand:'#f7df9c',water:'#36bde0',blue:'#409bd2',cream:'#fff6db'};
function painter(c){
 const ellipse=(x,y,rx,ry,color)=>{c.beginPath();c.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,Math.PI*2);c.fillStyle=color;c.fill();};
 const path=(pts,color)=>{c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();};
 const rect=(x,y,w,h,r,color)=>{c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=color;c.fill();};
 const line=(pts,color,width=3)=>{c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();};
 const at=(x,y,k,fn)=>{c.save();c.translate(x,y);c.scale(k,k);fn();c.restore();};
 const shadow=(x,y,rx=20,ry=8)=>ellipse(x+3,y+4,rx,ry,'#687e3930');
 function tree(x,y,k=1,variant=0){at(x,y,k,()=>{shadow(0,0,19,7);line([[0,0],[0,-32]],'#bc7940',7);if(variant%2){path([[-18,-15],[0,-57],[18,-15]],P.green);ellipse(0,-15,18,6,P.green);path([[-13,-32],[0,-65],[13,-32]],'#168860');ellipse(0,-32,13,4,'#168860');}else{ellipse(9,-35,17,18,P.green);ellipse(-10,-33,17,18,'#269b5b');ellipse(-2,-48,18,18,P.leaf);ellipse(-9,-47,8,9,'#67bd50');}});}
 function bush(x,y,k=1,berries=false){at(x,y,k,()=>{shadow(0,0,22,8);ellipse(-12,-7,13,12,'#369d5f');ellipse(10,-10,17,15,P.green);ellipse(-1,-17,16,14,P.leaf);ellipse(-1,-5,13,10,'#6bbe4e');if(berries)for(const [a,b]of [[-12,-14],[1,-22],[12,-10],[-1,-4]])ellipse(a,b,3.7,4,P.purple);});}
 function rock(x,y,k=1){at(x,y,k,()=>{shadow(0,0,19,6);path([[-19,1],[-13,-16],[-3,-24],[7,-22],[20,-6],[15,4]],'#b87b65');path([[-19,1],[-13,-16],[-3,-24],[2,-9],[-3,5]],'#d89472');path([[2,-9],[7,-22],[20,-6],[15,4],[-3,5]],'#a56b60');});}
 function tent(x,y,k=1,purple=false){at(x,y,k,()=>{shadow(0,0,27,10);line([[-5,-44],[5,-59]],'#ad683b',4);line([[5,-44],[-5,-59]],'#ad683b',4);c.beginPath();c.moveTo(0,-50);c.quadraticCurveTo(-8,-31,-25,-5);c.quadraticCurveTo(-25,8,0,9);c.quadraticCurveTo(25,8,25,-5);c.quadraticCurveTo(8,-31,0,-50);c.fillStyle=purple?'#b962c2':P.orange;c.fill();path([[0,-49],[0,7],[-19,1]],purple?'#d982d2':P.gold);c.beginPath();c.moveTo(-7,7);c.quadraticCurveTo(-7,-15,1,-15);c.quadraticCurveTo(9,-15,10,7);c.fillStyle=P.ink;c.fill();});}
 function house(x,y,k=1,kind='home',warm=false){at(x,y,k,()=>{shadow(0,2,32,11);path([[-27,-25],[7,-15],[7,10],[-27,0]],warm?'#f9dda6':'#6fb9e6');path([[7,-15],[28,-27],[28,-2],[7,10]],warm?'#eab781':P.blue);path([[-31,-27],[-10,-49],[32,-34],[8,-12]],P.gold);path([[8,-12],[32,-34],[32,-26],[9,-5]],P.orange);path([[-31,-27],[8,-12],[9,-5],[-31,-20]],'#efab34');for(let i=0;i<5;i++)line([[-22+i*8,-28-i*1.1],[-18+i*8,-35-i*.7]],'#ffe39b',3);rect(-18,-16,10,17,3,P.ink);rect(13,-13,7,7,2,'#25577b');if(kind==='store'||kind==='granary'){jar(-30,8,.8,P.purple);jar(-18,13,.65,P.clay);}if(kind==='workshop'){line([[17,8],[37,0]],'#b77741',6);line([[20,10],[20,19]],'#98603e',3);line([[34,3],[34,13]],'#98603e',3);rock(29,-1,.28);}if(kind==='outpost'){line([[26,-14],[26,-65]],'#a66b41',3);path([[26,-65],[45,-59],[26,-51]],P.purple);}});}
 function jar(x,y,k=1,color=P.clay,amount=1){at(x,y,k,()=>{shadow(0,1,9,3);rect(-8,-17,16,20,6,color);ellipse(0,-17,6,3,'#f0b96e');ellipse(0,-18,4.5,2,P.ink);line([[-6,-6],[6,-6]],'#f9d793',2);if(amount>0)ellipse(0,-18,3.5,1.3,'#e4c364');});}
 function logs(x,y,k=1,amount=12){at(x,y,k,()=>{for(let i=0;i<Math.min(12,Math.ceil(amount/8));i++){const a=(i%3)*8,b=-Math.floor(i/3)*6;line([[a-12,b-9],[a+3,b]],'#bb733e',6);ellipse(a+3,b,3,3,'#f5c17c');ellipse(a+3,b,1,1,'#b37b4d');}});}
 function person(x,y,k=1,id=0,active=false,time=0,state={}){id=Number(String(id).replace(/\D/g,''))||0;at(x,y,k,()=>{
  const resting=state.job==='idle',sway=active&&!resting?Math.sin(time*5+id)*2:0,lower=resting?8:0;
  shadow(0,0,resting?11:8,3);
  if(resting){line([[-3,-2],[-8,1],[-11,1]],P.purple,4);line([[3,-2],[8,1],[11,1]],P.purple,4);}
  else{line([[-3,-7],[-4+sway,0]],P.purple,4);line([[3,-7],[4-sway,0]],P.purple,4);}
  line([[-5,-19+lower],[-8,-10+lower+sway]],'#bf7541',4);line([[5,-19+lower],[8,-10+lower-sway]],'#bf7541',4);
  rect(-5,-21+lower,10,16,4,['#42b9bd','#f6b438','#ed8676','#9466cb'][id%4]);ellipse(0,-28+lower,7,8,P.ink);ellipse(1,-27+lower,5.3,6,['#c17a45','#9d5737','#d89454'][id%3]);
  if(state.hat&&!resting){ellipse(0,-33,10,2.5,state.hat);path([[-6,-33],[-3,-40],[4,-38],[7,-33]],state.hat);}
  if(!state.job||resting)return;
  // A tool identifies the assigned job even while paused; the work pose lifts it.
  const lift=state.phase==='work'?-5+Math.sin(time*5+id)*1.5:0;
  at(9,-8+lift,1,()=>{
   if(state.job==='water'){line([[-4,-7],[-4,-12],[4,-12],[4,-7]],P.ink,1.8);rect(-5,-8,10,10,3,P.water);line([[-3,-5],[3,-5]],P.cream,1.5);}
   else if(['wood','stone','build','farm','plow'].includes(state.job)){line([[0,3],[-3,-18]],'#9c633f',2.7);if(state.job==='wood')path([[-3,-18],[5,-20],[6,-13],[-2,-13]],'#66728a');else if(state.job==='stone')line([[-9,-16],[4,-20],[7,-17]],'#66728a',3);else if(state.job==='build')rect(-8,-21,12,6,2,P.clay);else line([[-3,-18],[6,-17],[6,-12]],P.ink,2.7);}
   else if(state.job==='herd'){line([[0,3],[0,-20],[4,-23],[7,-20],[7,-17]],'#9c633f',2.5);}
   else if(state.job==='fiber'){for(let n=-1;n<=1;n++)line([[0,2],[n*5,-15]],P.leaf,2);line([[-3,-3],[3,-3]],P.gold,2);}
   else if(state.job==='food')jar(0,0,.55,P.clay);
  });
 });}
 function sheep(x,y,k=1){at(x,y,k,()=>{shadow(0,1,15,5);for(const a of [-9,8])line([[a,-6],[a,2]],'#b99dc4',4);ellipse(-2,-11,14,10,P.cream);ellipse(-9,-16,7,7,P.cream);ellipse(1,-18,8,7,P.cream);ellipse(12,-12,6,8,'#d1bde4');ellipse(14,-19,4,2,P.purple);ellipse(14,-12,1.3,1.5,P.ink);});}
 function grain(x,y,k=1,ripe=true){at(x,y,k,()=>{line([[0,2],[0,-14]],ripe?'#c19431':'#369a5a',1.8);for(let i=0;i<3;i++){ellipse(-2.6,-7-i*3,3,1.7,ripe?P.gold:P.leaf);ellipse(2.6,-9-i*3,3,1.7,ripe?'#ffe68c':P.lime);}});}
 function fire(x,y,k=1,time=0){at(x,y,k,()=>{ellipse(0,0,18,7,'#ae8649');line([[-10,-2],[10,2]],'#ae6334',5);line([[-8,4],[8,-4]],'#bd7935',5);const flick=Math.sin(time*3)*2;path([[-10,-3],[-7,-17],[flick,-32],[5,-20],[11,-4]],P.orange);path([[-5,-3],[0,-24],[6,-3]],P.gold);ellipse(0,-7,4,6,P.cream);});}
 function badge(text,x,y,color=P.ink){c.font='600 11px system-ui';const w=c.measureText(text).width+16;rect(x-w/2,y-11,w,20,10,'#fff9e9ed');c.fillStyle=color;c.textAlign='center';c.fillText(text,x,y+3);return{x:x-w/2,y:y-11,width:w,height:20};}
 return{ellipse,path,rect,line,at,shadow,tree,bush,rock,tent,house,jar,logs,person,sheep,grain,fire,badge};
}
function icon(kind){const glyph={wood:'<path d="M6 17L18 11M5 11L15 6" stroke="#ad713a" stroke-width="6" stroke-linecap="round"/><circle cx="18" cy="11" r="3" fill="#edc583"/><circle cx="15" cy="6" r="3" fill="#edc583"/>',water:'<path d="M12 3C10 7 5 11 5 15a7 7 0 0014 0c0-4-5-8-7-12" fill="#42bddd"/><path d="M8 15q0 4 4 4" fill="none" stroke="#baf3f1" stroke-width="2" stroke-linecap="round"/>',stone:'<path d="M3 17L7 7l6-3 8 9-3 7H6z" fill="#bc8270"/><path d="M3 17L7 7l6-3 1 10-8 6z" fill="#e4b297"/>',grain:'<path d="M12 21V4" stroke="#c09831" stroke-width="2"/><path d="M11 8Q4 8 6 3q6 0 5 5m2 5q8 0 6-5-6 0-6 5m-2 5q-8 0-6-5 6 0 6 5" fill="#e9b331"/>',seed:'<ellipse cx="8" cy="9" rx="4" ry="6" transform="rotate(-25 8 9)" fill="#a886c4"/><ellipse cx="16" cy="15" rx="4" ry="6" transform="rotate(30 16 15)" fill="#ccb3de"/>',fiber:'<path d="M5 20Q1 6 19 3q4 17-14 17" fill="#70b863"/><path d="M5 20L15 8" stroke="#cbe28f" stroke-width="2"/>'};return '<svg class="resource-icon" viewBox="0 0 24 24" aria-hidden="true">'+(glyph[kind]||glyph[{food:'grain',clay:'stone'}[kind]]||glyph.seed)+'</svg>';}
root.SettlementArt={palette:P,painter,icon};
})(typeof globalThis!=='undefined'?globalThis:this);
