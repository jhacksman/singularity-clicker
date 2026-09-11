(()=>{
'use strict';
const {Camp,MILESTONES}=CaveEngine,KEY='singularity-clicker.cave.v1',$=id=>document.getElementById(id);
const n=v=>Number(v.toFixed(4)).toLocaleString('en-US',{maximumFractionDigits:4}),one=v=>v.toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1});
const time=ms=>{let t=Math.floor(ms/1000);return (t>=3600?Math.floor(t/3600)+':':'')+String(Math.floor(t/60)%60).padStart(2,'0')+':'+String(t%60).padStart(2,'0');};
let camp,storageOK=true,saveBlocked=false,loadError=false,lastSaved='',paused=false,selected='forage',held=null,lastNow=performance.now(),lastClockSave=0,discoveryHTML='',lastEvent=-1,dialogPauses=false,reduceTimer=null;
try{const raw=localStorage.getItem(KEY);camp=new Camp(raw?JSON.parse(raw):null);lastSaved=raw||'';}catch(e){camp=new Camp();loadError=true;saveBlocked=true;}
function save(){if(saveBlocked)return;try{lastSaved=camp.serialize();localStorage.setItem(KEY,lastSaved);storageOK=true;}catch(e){storageOK=false;}$('save-status').textContent=storageOK?'Saved on this device':'Saving unavailable · use Settings to export';}
function announce(message){$('action-announcement').textContent=message;}
function journal(message){$('journal-text').textContent=message;}
function costs(q){return '−'+n(q.f)+' food'+(q.w?' · −'+n(q.w)+' water':'');}
function setMeter(id,value,max){$(id+'-value').textContent=id==='comfort'?n(value):one(value);const meter=$(id+'-meter');meter.setAttribute('aria-valuenow',value.toFixed(2));meter.firstElementChild.style.width=Math.max(0,Math.min(100,value/max*100))+'%';meter.closest('.resource').classList.toggle('low',id!=='comfort'&&value<4);}
function showPile(id,value,max){const el=$(id);el.style.opacity=value>0?'1':'0';el.style.transform='scale('+(value>0?.48+.52*Math.sqrt(Math.min(value/max,1)):0)+')';}
function render(){
 const r=camp.r,s=camp.state;
 setMeter('food',camp.food,60);setMeter('water',r.water,60);setMeter('comfort',r.bedding*50,100);
 $('food-detail').textContent='plant '+n(Math.round(camp.plant*10)/10)+' · animal '+n(Math.round(camp.animal*10)/10);
 $('comfort-detail').textContent=['bare ground','soft grasses','layered bedding'][r.bedding];
 $('mobile-innovation-value').textContent=one(r.innovation);
 const parts=one(r.innovation).split('.');$('innovation-value').innerHTML=parts[0]+'<span>.'+parts[1]+'</span>';
 showPile('stone-art',r.stones.length,6);showPile('plant-art',camp.plant,60);showPile('animal-art',camp.animal,60);showPile('fiber-art',r.fibers,12);
 $('stone-mark').textContent=r.stones.length?r.stones.length+' stone'+(r.stones.length===1?'':'s')+' · '+r.stones[0]+' uses':'No usable stones';
 $('stone-skill').textContent=['Ⅰ','Ⅱ','Ⅲ','Ⅳ'][camp.skill];$('stone-skill').setAttribute('aria-label','Stone finding skill level '+(camp.skill+1));
 $('plant-mark').textContent=camp.plant?n(Math.round(camp.plant*10)/10)+' plant food':'No plant food';
 $('animal-mark').textContent=camp.animal?n(Math.round(camp.animal*10)/10)+' animal food':'No animal food';
 $('fiber-mark').textContent=r.fibers+' / 12 fibers';
 $('bedding-art').style.opacity=r.bedding?'1':'0';$('bedding-art').style.transform='scale('+(r.bedding===1?.75:1)+',.47)';
 $('camp-people').classList.toggle('comfortable',r.bedding>0);
 $('scene-note').textContent=camp.food<4||r.water<4?'A little food. A little water.':r.bedding===2?'Rest comes a little easier.':r.bedding===1?'A softer place to be together.':'The cold keeps everyone close.';
 document.body.classList.toggle('reduce-motion',!!s.settings.reducedMotion);
 for(const id of ['grunt','gesture']){const q=camp.quote(id);$(id+'-cost').textContent=costs(q);$(id+'-gain').innerHTML='+'+n(q.out)+' <span>innovation</span>';document.querySelector('.expression-button[data-act="'+id+'"]').classList.toggle('bonus',r.signals&&r.lastExpression!==null&&r.lastExpression!==id);}
 $('expression-hint').textContent=r.signals?(r.lastExpression==='grunt'?'Answer with a gesture.':r.lastExpression==='gesture'?'Answer with a sound.':'Try a sound. Try a sign.'):'Try a sound. Try a sign.';
 const q=camp.quote(selected);
 $('focus-title').textContent=q.label;$('focus-note').textContent=q.note;
 $('focus-yield').textContent=selected==='scavenge'?'80%: +'+n(q.out)+' · 20%: +'+n(q.minimum)+' animal food':'+'+n(q.out)+' '+q.unit+(q.tool?' · uses a stone':'');
 if(selected==='stone'){
  const values=[0,2,6].map(extra=>n((2+extra*(1-.25*camp.skill))*camp.discount));
  $('focus-cost').textContent=values.join(' / ')+' food & water · skill '+(camp.skill+1)+'/4';
 }else $('focus-cost').textContent=q.f||q.w?costs(q):'No supplies needed';
 $('focus-action').dataset.act=selected;$('focus-action').innerHTML=q.label+' <span>Hold to repeat</span>';
 $('focus-reason').textContent=paused?'Paused. Return when you are ready.':r.event?'Something outside has changed.':q.ok?'':q.reason;
 document.querySelectorAll('[data-act]').forEach(btn=>{const action=btn.dataset.act,quote=camp.quote(action);btn.setAttribute('aria-disabled',String(!quote.ok||paused||dialogPauses));btn.title=quote.label+': '+quote.note+' '+(action==='stone'?'Reserve '+n(quote.f)+' food and water.':costs(quote))+(!quote.ok?' '+quote.reason:'');btn.classList.toggle('is-selected',action===selected);});
 const showRecovery=camp.active&&(camp.food<4||r.water<4);$('recovery').hidden=!showRecovery;$('morsel').hidden=camp.food>=4;$('sip').hidden=r.water>=4;
 renderDiscoveries();
 $('tradition-block').hidden=!s.discovered.prestige&&!s.tradition;
 $('tradition-value').textContent=s.tradition+' / 3';
 const eligible=camp.eligible.filter(Boolean).length;
 $('tradition-description').textContent=s.tradition?'+'+(s.tradition*20)+'% learning · '+(s.tradition*5)+'% less effort · '+(s.tradition*10)+'% routine output.':'Pass on useful habits. Begin again with more understanding.';
 $('prestige').textContent=eligible?'New generation · +'+eligible+' Tradition':'A new generation';$('prestige').disabled=!eligible||!camp.active||paused;
 const next=MILESTONES.find((v,i)=>!s.claimed[i]&&r.innovation<v);
 $('prestige-next').textContent=eligible?'A fresh camp. Your tradition stays.':next?'Next unclaimed milestone: '+n(next)+' innovation.':'Every tradition has been passed on.';
 renderClock();renderEvent();
 $('pause-cover').hidden=!paused;$('pause').innerHTML='<span aria-hidden="true">'+(paused?'▷':'Ⅱ')+'</span><span class="pause-word">'+(paused?'Resume':'Pause')+'</span>';$('pause').setAttribute('aria-label',paused?'Resume game':'Pause game');
}
function renderDiscoveries(){
 const upgrades=['bedding','route','signals','provision'].map(id=>camp.upgrade(id)).filter(q=>q.visible),symbols={bedding:'≋',route:'⌁',signals:'∷',provision:'⋮'};
 let html=upgrades.map(q=>'<div class="discovery'+(q.owned?' owned':'')+'"><h3 class="discovery-title"><span class="discovery-symbol" aria-hidden="true">'+symbols[q.id]+'</span>'+q.name+(q.owned?'<span class="learned-label">✓</span>':'')+'</h3><p>'+q.effect+'</p>'+(q.owned?'':q.requirements.map(t=>'<div class="requirement'+(t.have+1e-8>=t.need?' met':'')+'"><span>'+t.label+'</span><span>'+n(Math.min(t.need,Math.floor(t.have)))+' / '+n(t.need)+(t.have+1e-8>=t.need?' ✓':'')+'</span></div>').join('')+'<div class="discovery-cost">'+n(q.f)+' food · '+n(q.w)+' water'+(q.fibers?' · '+q.fibers+' fibers':'')+'</div><button data-buy="'+q.id+'" '+(!q.ok||paused||dialogPauses?'disabled':'')+'>'+(q.ok?'Learn this':q.met?'Gather supplies':'Keep practicing')+'</button>')+'</div>').join('');
 if(!upgrades.length)html='<p class="empty-discoveries">Work with what is here.<br>Better ways will follow.</p>';
 if(html!==discoveryHTML){$('discoveries').innerHTML=html;discoveryHTML=html;}
 const r=camp.r;$('discovery-count').textContent=(r.bedding+Number(r.route)+Number(r.signals)+r.slots)+' learned';
}
function renderClock(){const r=camp.r;$('clock').textContent=time(camp.state.everCompleted?r.runMs:camp.state.campaignMs);$('run-label').textContent=r.complete?'JOURNEY COMPLETE':camp.state.everCompleted?'CAVE REPLAY':'FIRST JOURNEY';
 $('routine-status').textContent=r.event?(r.complete?'The group gathers around the flame.':'The group is watching with you.'):!r.slots?'For now, the work is yours.':r.routinesPaused?'The group is taking a break.':r.slots===1?'One shared routine. A little help.':'Food and water. The work is shared.';
 $('routine-time').textContent=r.slots&&!r.event?(r.routinesPaused?'Ⅱ':Math.ceil((20000-r.phase)/1000)+'s'):'—';
 $('rhythm-track').firstElementChild.style.width=r.slots?r.phase/200+'%':'0%';$('routine-pause').hidden=!r.slots||!!r.event;$('routine-pause').textContent=r.routinesPaused?'▷':'Ⅱ';$('routine-pause').setAttribute('aria-label',r.routinesPaused?'Resume shared routines':'Pause shared routines');}
function renderEvent(){
 const r=camp.r,stage=r.event;$('scene').classList.toggle('has-event',!!stage);$('fire-encounter').hidden=!stage;$('event-art').style.display=stage?'block':'none';
 if(!stage){$('warmth').style.opacity=0;$('scene-era').textContent='DEEP PREHISTORY';$('scene-heading').textContent='A small beginning.';$('scene-subtitle').textContent='Enough to survive. A little room to wonder.';lastEvent=0;return;}
 const entries={
  1:['SOMETHING BEYOND THE CAVE','The sky breaks.','Lightning has struck a fallen branch. Something bright is moving along the wood.','Retrieve the burning branch'],
  2:['CARRY IT CAREFULLY','A little of the sun.','The others draw close. There is a bare patch of earth, safely away from the bedding.','Place it on the bare earth'],
  3:['DON’T LET IT FADE','Keep it alive.','The small glow needs something to consume. Dry twigs lie within reach.','Feed it dry material'],
  4:['STAGE 00 COMPLETE','We kept the fire.','For the first time in this cave, the warmth belongs to us. Everything after this begins here.','See this journey']};
 const e=entries[stage];$('event-kicker').textContent=e[0];$('event-title').textContent=e[1];$('event-description').textContent=e[2];$('event-action').textContent=e[3];$('event-hint').textContent=stage===4?time(r.runMs)+' this generation · '+r.actions+' actions':'Take your time. The opportunity will wait.';
 const art=$('event-art');art.style.backgroundPosition=stage>=3?'33.33333% 100%':'66.66667% 100%';art.style.left=stage===1?'13%':stage===2?'25%':'21%';art.style.top=stage===1?'29%':stage===2?'38%':'37%';art.style.width=stage>=3?'30%':'22%';$('warmth').style.opacity=stage===4?'1':stage===3?'.5':'.15';
 if(stage===4){$('scene-era').textContent='THE FIRST EMBER';$('scene-heading').textContent='A different kind of dawn.';$('scene-subtitle').textContent='The cave is no longer cold.';}
 if(stage===1&&lastEvent===0){$('weather-flash').classList.remove('strike');void $('weather-flash').offsetWidth;$('weather-flash').classList.add('strike');journal('A crack in the sky. Light beyond the entrance.');announce('Lightning struck a branch outside. Retrieve it when you are ready.');}
 if(stage!==lastEvent&&stage>0)cancelHold();lastEvent=stage;
}
function feedback(result){
 const pos={forage:[39,66],scavenge:[60,73],water:[14,43],stone:[17,70],fiber:[84,71],grunt:[65,46],gesture:[72,45],morsel:[39,66],sip:[14,43]};
 const [x,y]=pos[result.id]||[50,50],el=document.createElement('span');el.className='float-number '+(['forage','scavenge','morsel'].includes(result.id)?'food':['water','sip'].includes(result.id)?'water':['grunt','gesture'].includes(result.id)?'innovation':'');el.textContent='+'+n(result.out)+' '+result.unit;el.style.left=x+'%';el.style.top=y+'%';$('scene-feedback').appendChild(el);setTimeout(()=>el.remove(),1250);
 if(['forage','scavenge','fiber','stone'].includes(result.id)){
  const item=document.createElement('span'),positions={forage:'33.33333% 0',scavenge:'66.66667% 0',fiber:'100% 0',stone:'0 0'};
  item.className='sprite returning-supply';item.style.backgroundPosition=positions[result.id];item.style.left=x+'%';item.style.top=(y-7)+'%';$('scene-feedback').appendChild(item);setTimeout(()=>item.remove(),700);
  if(['forage','scavenge'].includes(result.id)&&result.f<=.5){const tool=document.createElement('span');tool.className='sprite working-tool';tool.style.left=(x+3)+'%';tool.style.top=(y-6)+'%';$('scene-feedback').appendChild(tool);setTimeout(()=>tool.remove(),450);}
 }
 if(['grunt','gesture'].includes(result.id)){
  const human=$('human-response'),people=$('camp-people');human.textContent=result.id==='grunt'?'◌  ◌':'∷';human.classList.remove('respond');people.classList.remove('talking-grunt','talking-gesture');void human.offsetWidth;human.classList.add('respond');people.classList.add('talking-'+result.id);clearTimeout(reduceTimer);reduceTimer=setTimeout(()=>{human.classList.remove('respond');people.classList.remove('talking-grunt','talking-gesture');},650);
 }
}
function perform(id){
 if(paused||dialogPauses||document.hidden)return;
 selected=id;const result=camp.act(id);render();
 if(!result.ok){journal(result.message);announce(result.message);cancelHold();return;}
 save();feedback(result);announce('Gained '+n(result.out)+' '+result.unit+'.');
 if(result.message)journal(result.message);
 else if(result.broke)journal(camp.r.stones.length?'A worn edge. The next stone takes its place.':'The stone is worn. Food gathering takes more effort again.');
 else if(id==='fiber'&&camp.r.fibers===6)journal('Enough dry grass for a softer place to rest.');
 else if(camp.r.counts.grunt===1&&id==='grunt')journal('A sound in the cave. The others are listening.');
 else if(camp.r.counts.gesture===1&&id==='gesture')journal('A movement. A response. The beginnings of understanding.');
 else if(id==='forage'&&camp.r.counts.forage===1)journal('Roots and berries return to the cave. Gathering takes energy, too.');
 else if(id==='water'&&camp.r.counts.water===10&&!camp.r.route)journal('Ten trips. You know an easier way to the water.');
 else if(id==='scavenge')journal(result.out>=7.9?'There is still good food on these bones.':'Another scavenger got here first. A few scraps remain.');
 if(result.fire)journal('A crack in the sky. Light beyond the entrance.');
}
function cancelHold(){if(held&&held.element)held.element.classList.remove('holding');held=null;}
function startHold(id,element,key){cancelHold();held={id,element,key,next:performance.now()+1000};if(element)element.classList.add('holding');perform(id);}
document.addEventListener('pointerdown',e=>{const btn=e.target.closest('[data-act]');if(!btn||e.button!==0)return;e.preventDefault();btn.focus({preventScroll:true});startHold(btn.dataset.act,btn,null);});
document.addEventListener('pointerup',cancelHold);document.addEventListener('pointercancel',cancelHold);
document.addEventListener('click',e=>{
 const action=e.target.closest('[data-act]');if(action){if(e.detail===0)perform(action.dataset.act);return;}
 const upgrade=e.target.closest('[data-buy]');if(upgrade&&!paused&&!dialogPauses){const result=camp.buy(upgrade.dataset.buy);if(result.ok){save();render();journal(result.message);announce(result.message);}return;}
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){cancelHold();return;}
 if(dialogPauses||e.ctrlKey||e.metaKey||e.altKey||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
 const focused=e.target.closest?.('[data-act]'),keys={f:'forage',c:'scavenge',w:'water',s:'stone',b:'fiber','1':'grunt','2':'gesture'},key=e.key.toLowerCase();
 const id=(key===' '||key==='enter')&&focused?focused.dataset.act:keys[key];
 if(id){e.preventDefault();if(!e.repeat)startHold(id,focused,key);}
 else if((key==='p'||key===' ')&&!e.repeat&&!e.target.closest('button,a')){e.preventDefault();togglePause();}
});
document.addEventListener('keyup',e=>{if(held&&held.key===e.key.toLowerCase())cancelHold();});
window.addEventListener('blur',cancelHold);
function togglePause(){cancelHold();paused=!paused;lastNow=performance.now();save();render();}
$('pause').addEventListener('click',togglePause);$('resume').addEventListener('click',togglePause);
$('routine-pause').addEventListener('click',()=>{camp.r.routinesPaused=!camp.r.routinesPaused;save();render();});
function openModal(kicker,title,content){cancelHold();dialogPauses=true;lastNow=performance.now();$('modal-kicker').textContent=kicker;$('modal-title').textContent=title;$('modal-content').innerHTML=content;if(!$('modal').open)$('modal').showModal();render();}
function closeModal(){$('modal').close();dialogPauses=false;lastNow=performance.now();render();}
$('modal-close').addEventListener('click',closeModal);$('modal').addEventListener('cancel',()=>{dialogPauses=false;lastNow=performance.now();render();});$('modal').addEventListener('click',e=>{if(e.target===$('modal')){const box=$('modal').getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)closeModal();}});
$('help').addEventListener('click',()=>openModal('A SMALL BEGINNING','Live. Learn. Remember.','<p>Click a place in the cave to gather. The large button repeats your selected action. <strong>Hold it to work once each second.</strong></p><ul><li>Food and water pay for your actions. Nothing drains while you think.</li><li>A useful stone makes foraging and scavenging easier. Each has 24 uses.</li><li>Gather fibers for bedding. Comfort improves learning.</li><li>Grunt and gesture to gain innovation. Practice reveals discoveries.</li><li>Shared routines and inherited traditions can make a faster journey.</li></ul><p><strong>Keyboard:</strong> F forage · C scavenge · W water · S stone · B fibers · 1 grunt · 2 gesture · P pause. Hold a key to repeat.</p><small>The game pauses while this panel is open or the tab is hidden. Saves stay in this browser; use Settings to take a backup. There is no offline production.</small>'));
function settings(){openModal('YOUR CAMP','A moment of quiet.','<label class="settings-row">Reduce motion<input type="checkbox" id="motion-setting" '+(camp.state.settings.reducedMotion?'checked':'')+'></label><p>Progress is saved on this device after every action. Export a camp to keep a backup or move it to another browser.</p><button class="outline-button" id="export-save">Export saved camp</button><button class="outline-button" id="import-save">Import saved camp</button><input id="save-file" type="file" accept=".json,application/json" hidden><p id="import-status" role="status"></p><div class="modal-facts"><div><span>This generation</span><strong>'+time(camp.r.runMs)+'</strong></div><div><span>Actions this generation</span><strong>'+camp.r.actions+'</strong></div><div><span>Tradition</span><strong>'+camp.state.tradition+' / 3</strong></div></div><small>This prototype covers Stage 0. Its prehistoric scene compresses history; the exact first encounter with fire is unknown.</small><button class="outline-button danger-button" id="reset-camp">Reset all progress</button>');
 $('motion-setting').addEventListener('change',e=>{camp.state.settings.reducedMotion=e.target.checked;save();render();});
 $('export-save').addEventListener('click',()=>{const blob=new Blob([camp.serialize()],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='singularity-clicker-camp.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);});
 $('import-save').addEventListener('click',()=>$('save-file').click());
 $('save-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2000000)throw Error('This file is too large for a camp save.');const incoming=new Camp(JSON.parse(await file.text()));openModal('RESTORE A CAMP','Replace this camp?','<p>The imported camp has <strong>'+one(incoming.r.innovation)+' innovation</strong> and <strong>'+incoming.state.tradition+' Tradition</strong>. Importing replaces the progress on this device.</p><button class="primary-button" id="confirm-import">Restore this saved camp</button><button class="outline-button" id="cancel-import">Keep my current camp</button>');$('confirm-import').onclick=()=>{camp=incoming;saveBlocked=false;lastEvent=-1;save();closeModal();journal('Your saved camp is here.');};$('cancel-import').onclick=settings;}catch(error){$('import-status').textContent='This file could not be read as a compatible camp save. Your current camp is unchanged.';}});
 $('reset-camp').addEventListener('click',()=>openReset());
}
$('settings').addEventListener('click',settings);
function openReset(){openModal('START OVER','Leave every tradition behind?','<p>This erases the camp, its records, and all Tradition on this device. A new generation prestige keeps your permanent benefits; a full reset does not.</p><button class="primary-button" id="confirm-reset">Erase progress and begin again</button><button class="outline-button" id="cancel-reset">Keep my camp</button>');$('confirm-reset').onclick=()=>{camp=new Camp();selected='forage';paused=false;saveBlocked=false;lastEvent=-1;save();closeModal();journal('The world is cold. The cave is home.');};$('cancel-reset').onclick=closeModal;}
$('prestige').addEventListener('click',()=>{const gain=camp.eligible.filter(Boolean).length,total=camp.state.tradition+gain;openModal('PASS IT ON','A new generation.','<p>Begin in a fresh cave with 18 food and 18 water. Your supplies, innovation, tools, bedding, and routines reset.</p><p><strong>Gain '+gain+' Tradition.</strong> Inherited habits remain through every new generation.</p><div class="modal-facts"><div><span>Learning</span><strong>+'+(total*20)+'%</strong></div><div><span>Action costs</span><strong>−'+(total*5)+'%</strong></div><div><span>Routine output</span><strong>+'+(total*10)+'%</strong></div></div><ul class="milestones">'+MILESTONES.map((v,i)=>'<li><span>'+n(v)+' innovation</span><span>'+(camp.state.claimed[i]?'Already inherited':camp.r.innovation>=v?'Ready to pass on':'Not reached')+'</span></li>').join('')+'</ul><small>The first-journey clock includes earlier generations. Restarting is optional.</small><button class="primary-button" id="confirm-prestige">Begin again · inherit '+gain+' Tradition</button><button class="outline-button" id="cancel-prestige">Stay with this generation</button>');$('confirm-prestige').onclick=()=>{const result=camp.prestige();if(result.ok){selected='forage';save();closeModal();journal(result.message);}else announce(result.message);};$('cancel-prestige').onclick=closeModal;});
$('event-action').addEventListener('click',()=>{if(paused||dialogPauses)return;if(camp.r.complete){completion();return;}const result=camp.fireStep();save();render();if(result.complete){journal('The cold gives way. We kept the fire.');announce('Stage zero complete. You kept the fire.');}});
function completion(){const s=camp.state,r=camp.r;openModal('STAGE 00 COMPLETE','We kept the fire.','<p>From the work of staying alive to a flame the group can tend together.</p><div class="modal-facts"><div><span>First journey, all generations</span><strong>'+time(s.campaignMs)+'</strong></div><div><span>This generation</span><strong>'+time(r.runMs)+'</strong></div><div><span>Actions this generation</span><strong>'+r.actions+'</strong></div><div><span>Tradition carried</span><strong>'+s.tradition+' / 3</strong></div></div><p><strong>Next: living with fire.</strong> Tending embers, cooking, and exploring beyond the cave. The Hearth is ready to explore.</p><small>Stage 0’s provisional first-run target is 12–15 minutes. Clever upgrades can shorten it. Your completed camp is preserved if you replay.</small><a class="primary-button" href="hearth.html" style="display:block;text-align:center;text-decoration:none">Carry the ember · enter The Hearth</a><button class="outline-button" id="keep-flame">Stay by the fire</button><button class="outline-button" id="replay">Replay the cave</button>');$('keep-flame').onclick=closeModal;$('replay').onclick=()=>{camp.replay();selected='forage';save();closeModal();journal('A familiar cave. A different way through.');};}
document.addEventListener('visibilitychange',()=>{cancelHold();lastNow=performance.now();if(document.hidden)save();});
window.addEventListener('pagehide',save);
window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue!==lastSaved&&!saveBlocked){saveBlocked=true;paused=true;openModal('CAMP UPDATED ELSEWHERE','Another window has this camp.','<p>A different window changed the saved progress. Reload to continue from that camp without overwriting it.</p><button class="primary-button" id="reload-camp">Reload saved camp</button>');$('reload-camp').onclick=()=>location.reload();}});
setInterval(()=>{
 const now=performance.now(),delta=now-lastNow;lastNow=now;
 if(paused||dialogPauses||document.hidden)return;
 if(held&&now>=held.next){const id=held.id;held.next=now+1000;perform(id);}
 const rounds=camp.advance(delta);if(rounds.some(v=>v.food||v.water)){const sum=rounds.reduce((a,v)=>({food:a.food+v.food,water:a.water+v.water}),{food:0,water:0});journal('The group returns. '+(sum.food>=0?'+':'')+n(sum.food)+' food · '+(sum.water>=0?'+':'')+n(sum.water)+' water.');render();}
 else renderClock();
 if(rounds.length||now-lastClockSave>=5000){save();lastClockSave=now;}
},100);
render();
if(loadError){$('save-status').textContent='Saved camp could not be opened';openModal('SAVED PROGRESS','We couldn’t open this camp.','<p>The saved data is unavailable or incompatible. It has not been overwritten. You can import a backup in Settings, or start fresh.</p><button class="primary-button" id="recover-settings">Open Settings</button><button class="outline-button" id="recover-fresh">Start a fresh camp</button>');$('recover-settings').onclick=settings;$('recover-fresh').onclick=openReset;}
})();
