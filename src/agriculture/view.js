(function(){
'use strict';
const {Village,CROPS,BUILD,JOBS,RESOURCES}=AgricultureGame,KEY='singularity-clicker.agriculture.v1',HEARTH='singularity-clicker.hearth.v1',$=id=>document.getElementById(id);
let started=true;
let village=new Village(),selected=0,paused=false,blocked=false,unread=null,lastSaved=null,last=performance.now(),acc=0,saveTime=0,modal=false;
const canvas=$('farm'),ctx=canvas.getContext('2d');let points=[],fieldBadges=[];
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function say(text){$('status').textContent=text;}
function save(){if(blocked||!started)return;try{const text=village.serialize();localStorage.setItem(KEY,text);lastSaved=text;}catch{blocked=true;paused=true;say('Saving stopped. Open Journey and export before closing.');}}
function show(title,body){modal=true;$('dialog-title').textContent=title;$('dialog-body').innerHTML=body;$('dialog').showModal();}
function close(){if(!started)return;modal=false;$('dialog').close();last=performance.now();acc=0;}
$('close').onclick=close;$('dialog').addEventListener('cancel',e=>{if(!started){e.preventDefault();return;}modal=false;last=performance.now();acc=0;});
function load(){try{const raw=localStorage.getItem(KEY);if(raw){unread=raw;village=new Village(JSON.parse(raw));unread=null;lastSaved=raw;return;}
 started=false;$('close').hidden=true;
 const rawHearth=localStorage.getItem(HEARTH);let completed=null;try{const state=rawHearth&&JSON.parse(rawHearth);if(state?.complete&&HearthGame.valid(state))completed=state;}catch{}
 if(completed){show('A place for the next harvest.','<p>Carry your people and inherited traditions into a farming settlement. Your completed Hearth remains unchanged, and a copy is kept inside this new journey.</p><p>This is the first Agriculture slice: fields, soil, water, storage and irrigation. The rest of the age is still ahead.</p><button id="begin">Begin the settlement</button>');$('begin').onclick=()=>{started=true;$('close').hidden=false;village=Village.fromHearth(completed);close();save();render();};}
 else{show('Agriculture · first harvest preview.','<p>Finish the first furrow in The Hearth to carry that journey onward, or try a separate settlement here. Neither choice replaces your Cave or Hearth.</p><button id="begin">Try a standalone settlement</button><a href="hearth.html">Return to The Hearth</a>');$('begin').onclick=()=>{started=true;$('close').hidden=false;close();save();render();};}
 }catch{blocked=true;paused=true;say('This save could not be opened. Journey can export the original or import a backup.');}}
function render(){const s=village.s,f=s.fields[selected];
 $('stocks').innerHTML=RESOURCES.map(k=>'<div data-resource="'+k+'" class="stock '+(s.stock[k]<4?'low':'')+'">'+SettlementArt.icon(k)+'<span>'+k[0].toUpperCase()+k.slice(1)+'</span><strong>'+Math.floor(s.stock[k])+'</strong><small>/ '+village.cap(k)+'</small></div>').join('');
 $('day').textContent='Day '+(1+Math.floor(s.time/180));$('pause').textContent=paused?'Resume':'Pause';$('step').disabled=!paused||modal||blocked;
 $('plots').innerHTML=s.fields.map(p=>'<button class="plot" data-field="'+p.id+'" aria-pressed="'+(p.id===selected)+'"><strong>Field '+(p.id+1)+' · '+p.workers+(p.workers===1?' worker':' workers')+'</strong><small>'+Math.floor(p.soil)+'% soil · '+(p.crop?CROPS[p.crop].name:p.nextCrop?CROPS[p.nextCrop].name:'Fallow')+'</small><small>'+ esc(p.blocked||p.phase)+'</small></button>').join('');
 $('field-title').textContent='Field '+(selected+1)+' · '+Math.floor(f.soil)+'% soil';$('field-status').textContent=f.phase==='fallow'?'Choose the next crop; workers sow and tend it automatically.':Math.floor(f.work)+' / '+CROPS[f.crop].work+' work · '+(f.phase==='ripe'?'Ready to harvest':'Growing');
 if(f.blocked)$('field-status').textContent=f.blocked;
 const chosen=CROPS[f.crop||f.nextCrop];$('crop-details').textContent=chosen?'Harvest: '+Math.floor(chosen.grain*(.5+f.soil/200))+' grain + '+chosen.seed+' seed. Sowing uses 1 seed. Soil '+(chosen.soil>0?'+':'')+chosen.soil+' points per harvest.':'Fallow ground slowly recovers its soil.';
 $('crop').value=f.nextCrop||'';$('field-workers').textContent=f.workers;$('field-less').disabled=!f.workers;$('field-more').disabled=!village.idle;
 $('workforce').textContent=village.idle+' unassigned of '+s.population+' people. One water carrier supports several fields.';
 $('jobs').innerHTML=Object.entries(JOBS).map(([k,name])=>'<div class="allocation"><span>'+name+(k==='build'&&s.jobs.build&&!s.project?'<small>No active project</small>':['wood','clay','build'].includes(k)&&s.jobs[k]&&s.stock.grain<=0?'<small>Waiting for food</small>':'')+'</span><button data-job="'+k+'" data-change="-1" aria-label="Remove '+name+' worker" '+(!s.jobs[k]?'disabled':'')+'>−</button><strong>'+s.jobs[k]+'</strong><button data-job="'+k+'" data-change="1" aria-label="Add '+name+' worker" '+(!village.idle?'disabled':'')+'>+</button></div>').join('');
 $('projects').innerHTML=Object.entries(BUILD).map(([k,d])=>{const unavailable=s.harvests<2||s.project||village.has(k)||(k==='irrigation'&&!village.has('granary'))||Object.entries(d.cost).some(([r,n])=>s.stock[r]<n);return '<button data-plan="'+k+'" '+(unavailable?'disabled':'')+'>'+d.name+(village.has(k)?' · built':'')+'<small>'+Object.entries(d.cost).map(([r,n])=>n+' '+r).join(' · ')+'</small></button>';}).join('')+(s.project?'<p>'+BUILD[s.project.kind].name+' · '+Math.floor(s.project.work)+' / '+BUILD[s.project.kind].work+' work. Assign construction workers.'+(s.stock.grain<=0?' Work waits for food.':'')+'</p><progress max="'+BUILD[s.project.kind].work+'" value="'+s.project.work+'"></progress>':s.harvests<2?'<p>Complete two harvests to begin building.</p>':'<p>A granary expands grain storage. Irrigation halves field water use and expands the water reserve. Projects need assigned construction workers.</p>');
 $('goal-title').textContent=s.milestone?'The first dependable surplus.':'A harvest worth keeping.';
 $('goal-detail').textContent=s.milestone?'This Agriculture milestone is complete. Keep experimenting with crop rotation. Exchange, copper and the next age are still to come.':'Complete five harvests, finish a granary and irrigation, and store 40 grain. Start by choosing Grain for a field and assigning two workers.';
 $('goal-progress').innerHTML=[[(s.harvests>=5),Math.min(5,s.harvests)+' / 5 harvests'],[village.has('granary'),'Granary'],[village.has('irrigation'),'Irrigation'],[s.stock.grain>=40,Math.min(40,Math.floor(s.stock.grain))+' / 40 grain']].map(([done,label])=>'<div class="goal-check">'+(done?'✓':'○')+' '+label+'</div>').join('');draw();
}
function draw(){
 const r=canvas.getBoundingClientRect(),w=r.width,h=r.height,dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
 const a=SettlementArt.painter(ctx),s=village.s,late=s.milestone,k=Math.min(w/850,h/500),ox=w*.5,oy=h*(w<600?.53:.40);
 const iso=(x,y)=>({x:ox+(x-y)*56*k,y:oy+(x+y)*27*k}),poly=(pts,color)=>a.path(pts.map(p=>[p.x,p.y]),color);
 const edge=[iso(-4,-2.5),iso(5.8,-2.5),iso(5.8,4.5),iso(-4,4.5)];
 poly(edge.map(p=>({x:p.x,y:p.y+18*k})),late?'#b57861':'#bea06b');poly(edge.map(p=>({x:p.x,y:p.y+7*k})),late?'#dfa978':'#e6c67c');poly(edge,late?'#e9d6a0':'#d5e68c');
 // A continuous bank, with the same six field hit targets as the simulation.
 poly([iso(-3.8,-2.5),iso(-2.5,-2.5),iso(-2.5,4.5),iso(-3.8,4.5)],'#49bddb');
 for(let n=0;n<12;n++){const p=iso(-3.5+(n%3)*.3,-2+n*.52);a.line([[p.x,p.y],[p.x+12*k,p.y+3*k]],'#baf2ee',2*k);}
 const trail=[iso(-2,3.7),iso(-1,2),iso(-.7,0),iso(1,-1.7),iso(4,-1.8)];a.line(trail.map(p=>[p.x,p.y]),'#e2bd77',19*k);a.line(trail.map(p=>[p.x,p.y]),'#fff0c5',11*k);
 for(const [x,y,v]of [[-1.5,-2,0],[3.7,-2,1],[5.2,-1.7,0],[5.2,3.6,0],[4.8,4.1,1],[-1.8,3.6,1]]){const p=iso(x,y);a.tree(p.x,p.y,k*.7,v);}
 for(const [x,y]of [[-2,4],[5,2.4],[5.3,0],[-1,-2]]){const p=iso(x,y);a.bush(p.x,p.y,k*.55);}
 // Housing represents this settlement; added store/irrigation art requires the actual upgrade.
 for(let i=0;i<Math.min(3,Math.ceil(s.population/2));i++){const p=iso(i*1.1-.6,-1.8);a.house(p.x,p.y,k*.85,'home',late);}
 const storage=iso(-1.1,2.7);if(village.has('granary')){a.house(storage.x,storage.y,k*1.1,'granary',late);a.badge('Granary',storage.x,storage.y+25*k);}else{a.jar(storage.x,storage.y,k,'#aa79b9',s.stock.grain);a.jar(storage.x+15*k,storage.y+5*k,k*.8,'#d19a59',s.stock.seed);}
 const water=iso(-2,1.1);a.jar(water.x,water.y,k,'#5bbad4',s.stock.water);
 if(village.has('irrigation')){for(const row of [-.15,1.45,3]){const p=iso(-2.7,row),q=iso(4.6,row);a.line([[p.x,p.y],[q.x,q.y]],'#a8d5ba',9*k);a.line([[p.x,p.y],[q.x,q.y]],'#40b9d6',5*k);}const p=iso(-2.65,-.15);a.line([[p.x-4*k,p.y-10*k],[p.x+12*k,p.y-5*k]],'#bf8350',4*k);}
 points=[];fieldBadges=[];
 for(const f of s.fields){const x=f.id%3*1.6,y=Math.floor(f.id/3)*1.6;
  const corners=[iso(x,y),iso(x+1.35,y),iso(x+1.35,y+1.3),iso(x,y+1.3)];poly(corners,f.crop||f.nextCrop?'#cd9360':'#b2c774');
  ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.strokeStyle=selected===f.id?'#805ab7':'#e9be7c';ctx.lineWidth=selected===f.id?3:1;ctx.stroke();
  const center=iso(x+.675,y+.65);points.push({id:f.id,p:center,r:56*k*.65});
  for(let row=0;row<4;row++){const p=iso(x+.14,y+.21+row*.27),q=iso(x+1.2,y+.21+row*.27);a.line([[p.x,p.y],[q.x,q.y]],f.crop||f.nextCrop?'#ad704b':'#9db966',3*k);
   if(f.crop)for(let col=0;col<5;col++){const t=iso(x+.18+col*.22,y+.21+row*.27),growth=Math.max(.22,Math.min(1,f.work/CROPS[f.crop].work));if(f.crop==='grain')a.grain(t.x,t.y,k*(.3+growth*.7),f.phase==='ripe'||growth>.72);else a.bush(t.x,t.y,k*(.07+growth*.11),true);}
  }
  for(let n=0;n<f.workers;n++){const p=iso(x+.25+n*.35,y+1.25);a.person(p.x,p.y,k*.65,f.id+n);}
  fieldBadges.push({id:f.id,text:String(f.id+1)+(f.phase==='ripe'?(w<600?' ✓':' · READY'):''),x:center.x,y:center.y+29*k,color:selected===f.id?'#7252aa':'#4f6247'});
 }
 // Assigned carriers/crafters are shown at their workplaces; no extra people are created.
 let personId=s.fields.reduce((n,f)=>n+f.workers,0);for(const [job,n] of Object.entries(s.jobs))for(let i=0;i<n;i++){const spot={water:[-2,1],wood:[4.9,3],clay:[4.9,-1],forage:[-1.8,3.5],build:[-1,2.2]}[job]||[1,-1];const p=iso(spot[0]+i*.22,spot[1]);a.person(p.x,p.y,k*.75,personId++);if(job==='water')a.jar(p.x+6*k,p.y-6*k,k*.4,'#49bade');}
 for(let i=0;i<village.idle;i++){const p=iso(-.5+i*.35,-.8);a.person(p.x,p.y,k*.75,personId++);}
 if(s.project){const p=iso(-1.2,2.6);a.line([[p.x-27*k,p.y],[p.x-27*k,p.y-29*k],[p.x+20*k,p.y-12*k],[p.x+20*k,p.y+12*k]],'#b98457',4*k);a.logs(p.x,p.y,k*.65,18);a.badge(BUILD[s.project.kind].name+' · '+Math.floor(s.project.work/BUILD[s.project.kind].work*100)+'%',p.x,p.y+33*k);}
 // Labels sit above all scene artwork. Their painted bounds take input priority.
 for(const badge of fieldBadges)badge.bounds=a.badge(badge.text,badge.x,badge.y,badge.color);
 const heading=document.querySelector('.land-title h2');heading.textContent=late?'A place for tomorrow.':s.harvests?'The village takes root.':'A harvest worth keeping.';
}
function advance(){const project=village.s.project?.kind,harvests=village.s.harvests;village.tick(1);if(village.s.milestone)say('A dependable surplus. Your first Agriculture milestone is preserved.');else if(project&&!village.s.project)say(BUILD[project].name+' finished. Reassign construction workers when ready.');else if(village.s.harvests>harvests)say('A harvest is in. The field workers prepare the next cycle.');}
function change(fn,message){if(blocked||modal)return;if(fn()===false){say('That order needs more available workers, materials, or progress.');return;}if(message)say(message);save();render();}
$('plots').onclick=e=>{const b=e.target.closest('[data-field]');if(b){selected=Number(b.dataset.field);render();}};
canvas.onclick=e=>{const r=canvas.getBoundingClientRect(),p={x:e.clientX-r.left,y:e.clientY-r.top},hit=[...fieldBadges].reverse().find(({bounds:b})=>p.x>=b.x&&p.x<=b.x+b.width&&p.y>=b.y&&p.y<=b.y+b.height)||points.find(a=>Math.hypot(p.x-a.p.x,p.y-a.p.y)<a.r);if(hit){selected=hit.id;render();}};
$('crop').onchange=e=>change(()=>village.crop(selected,e.target.value||null),'The next crop order is set. Workers handle the whole cycle.');
$('field-less').onclick=()=>change(()=>village.allocate(selected,village.s.fields[selected].workers-1));$('field-more').onclick=()=>change(()=>village.allocate(selected,village.s.fields[selected].workers+1));
$('jobs').onclick=e=>{const b=e.target.closest('[data-job]');if(b)change(()=>village.allocate(b.dataset.job,village.s.jobs[b.dataset.job]+Number(b.dataset.change)));};
$('projects').onclick=e=>{const b=e.target.closest('[data-plan]');if(b)change(()=>village.plan(b.dataset.plan),'Materials set aside. Assign construction workers to finish the project.');};
$('pause').onclick=()=>{paused=!paused;last=performance.now();acc=0;render();};$('step').onclick=()=>{if(paused&&!modal&&!blocked){advance();save();render();}};
function download(text,name='singularity-clicker-agriculture.json'){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
$('journey').onclick=()=>{show('Your settlement.','<p>A separate Agriculture save. The Cave and Hearth remain unchanged. Hidden tabs and closed pages do not advance time.</p><button id="export">Export this journey</button><button id="import">Import a journey</button>'+(village.s.sourceArchive?'<button id="export-hearth">Export preserved Hearth</button>':'')+'<a href="hearth.html">Return to The Hearth</a>');$('export').onclick=()=>download(unread??village.serialize());$('import').onclick=()=>$('import-file').click();if($('export-hearth'))$('export-hearth').onclick=()=>download(village.s.sourceArchive,'singularity-clicker-hearth.json');};
$('import-file').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{if(f.size>6e6)throw Error();const incoming=new Village(JSON.parse(await f.text()));if(!confirm('Replace only the active Agriculture journey with this save?'))return;village=incoming;blocked=false;unread=null;selected=0;close();save();render();}catch{say('This is not a compatible Agriculture save. Current progress is unchanged.');}};
window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue!==lastSaved){blocked=true;paused=true;say('Another window changed this journey. Reload before continuing.');render();}});
document.addEventListener('visibilitychange',()=>{last=performance.now();acc=0;if(document.hidden)save();});window.addEventListener('pagehide',save);new ResizeObserver(draw).observe(canvas);
function frame(now){const dt=Math.min(.25,(now-last)/1000);last=now;if(!paused&&!modal&&!blocked&&!document.hidden){acc+=dt;saveTime+=dt;while(acc>=1){advance();acc--;render();}if(saveTime>=5){save();saveTime=0;}}requestAnimationFrame(frame);}
load();render();if(started&&!blocked){if(village.s.milestone)say('A dependable surplus. Your first Agriculture milestone is preserved.');else if(village.s.harvests)say('Your settlement is restored. Existing crop orders continue when time resumes.');}requestAnimationFrame(frame);
})();
