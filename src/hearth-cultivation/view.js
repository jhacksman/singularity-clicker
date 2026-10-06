(async function(){
'use strict';
const {W,H,COST,WORK}=HearthRTS,KEY=HearthCultivation.KEY,$=id=>document.getElementById(id),canvas=$('world'),ctx=canvas.getContext('2d'),T=32;
let game,paused=false,blocked=false,rejected=null,selected=new Set(),inspect=null,mode=null,pointer=null,hover={x:0,y:0},rings=[],messages=[],lastSave=null,elapsed=0,last=performance.now(),acc=0,frameNo=0;
const camera={x:0,y:0,scale:1},touchContacts=new Set(),nativeKeys=new Map(),cancelledNativeKeys=new Set();
let placement=null,spaceCycle=null,multiTouch=false,suppressTouchClick=false;
const DRAG_PX=4,LONG_PRESS_MS=550;
let originalRaw=null,readCompleted=false,unreadableSave=false,recoveredWork=false;
let sourceRaw=null,archives=[],ownsLock=false,releaseLock=null,readOnlyReason='',selectedPlot='pilot';
const ENVELOPE='hearth-local-cultivation-envelope.v1',MAX_BYTES=6000000;
const readWarning='Saved camp could not be read. No save was changed. Reload when browser storage is available.';
function campFrom(state){
 if(state?.version===7)return new HearthCultivation.Camp(state);
 if(state?.version===6&&HearthRTS.valid(state))return new HearthRTS.Camp(state);
 throw Error('Import an accepted v6 opening or a supported local cultivation envelope.');
}
function parseEnvelope(raw,allowLegacy=false){
 if(typeof raw!=='string'||new TextEncoder().encode(raw).length>MAX_BYTES)throw Error('Camp file exceeds the supported size.');
 const value=JSON.parse(raw);
 if(allowLegacy&&value?.version===6&&HearthRTS.valid(value))return{camp:campFrom(value),sourceRaw:raw,archives:[]};
 if(!value||value.format!==ENVELOPE||value.version!==1||!Array.isArray(value.archives)||value.archives.length>64||!(value.sourceRaw===null||typeof value.sourceRaw==='string'))throw Error('Unsupported cultivation envelope.');
 if(value.sourceRaw!==null){const original=JSON.parse(value.sourceRaw);if(original?.version!==6||!HearthRTS.valid(original))throw Error('The original opening archive is not supported.');}
 if(value.state?.version===7&&value.sourceRaw===null)throw Error('The original opening archive is missing.');
 if(value.archives.some(a=>!a||!['camp-state','legacy-source'].includes(a.kind)||typeof a.raw!=='string'))throw Error('Malformed history archive.');
 return{camp:campFrom(value.state),sourceRaw:value.sourceRaw,archives:value.archives.map(a=>({...a}))};
}
function envelope(camp=game,original=sourceRaw,history=archives){
 const raw=JSON.stringify({format:ENVELOPE,version:1,sourceRaw:original,state:JSON.parse(camp.serialize()),archives:history});
 if(new TextEncoder().encode(raw).length>MAX_BYTES)throw Error('The preserved history exceeds this preview’s save limit. Export it before continuing.');
 return raw;
}
function mergedArchives(...lists){const out=[];for(const list of lists)for(const a of list)if(!out.some(v=>v.kind===a.kind&&v.raw===a.raw))out.push({...a});if(out.length>64)throw Error('The history archive is full. Export this camp; no history was removed.');return out;}
function writeCandidate(candidate,original=sourceRaw,history=archives){
 if(!ownsLock||blocked)throw Error(readOnlyReason||'Saving is unavailable. Export before continuing.');
 const raw=envelope(candidate,original,history);parseEnvelope(raw);
 if(localStorage.getItem(KEY)!==lastSave)throw Error('Another writer changed this camp. Reload before continuing.');
 localStorage.setItem(KEY,raw);
 game=candidate;sourceRaw=original;archives=history;lastSave=raw;return true;
}
if(!navigator.locks?.request)readOnlyReason='Read-only: this browser cannot hold the save writer lock. Inspection and export remain available.';
else await new Promise(resolve=>{
 navigator.locks.request(KEY,{mode:'exclusive',ifAvailable:true},lock=>{
  if(!lock){readOnlyReason='Read-only: another tab owns this cultivation camp. Close that tab and reload to continue.';resolve();return;}
  ownsLock=true;resolve();return new Promise(done=>{releaseLock=done;});
 }).catch(()=>{readOnlyReason='Read-only: the save writer lock could not be acquired. Reload to retry.';resolve();});
});
try{
 originalRaw=localStorage.getItem(KEY);
 lastSave=originalRaw;
 if(originalRaw===null){
  const old=localStorage.getItem(HearthRTS.KEY);readCompleted=true;
  if(old!==null){try{const s=JSON.parse(old);if(s?.version===6&&HearthRTS.valid(s)){game=new HearthRTS.Camp(s);sourceRaw=old;}}catch(_){}}
  if(!game)game=new HearthRTS.Camp();
  paused=true;
 }
 else{
  readCompleted=true;const incoming=parseEnvelope(originalRaw);game=incoming.camp;sourceRaw=incoming.sourceRaw;archives=incoming.archives;paused=true;
 }
}catch(e){rejected=originalRaw;unreadableSave=!readCompleted;game=new HearthRTS.Camp();blocked=true;paused=true;}
if(!ownsLock){blocked=true;paused=true;}
const resources=['wood','stone','food','water','seed'];
const icons={wood:'♧',stone:'◆',food:'✦',water:'◒',seed:'•'},names={wood:'Timber stand',stone:'Stone deposit',food:'Foraging patch'};
let tripSession=new HearthFeedback.Session(),toastUntil=performance.now()+7000;
const tripHistoryOpen=new Set();
function tell(text){toastUntil=performance.now()+7000;$('toast').hidden=false;$('toast').textContent=text;messages.unshift(text);messages=messages.slice(0,3);$('log').replaceChildren(...messages.map(v=>{const p=document.createElement('div');p.textContent='› '+v;return p;}));}
function save(){if(blocked||!ownsLock)return false;try{return writeCandidate(game);}catch(e){blocked=true;paused=true;tell('Saving stopped. Export this camp before closing. '+e.message);ui();return false;}}
function cell(e){const b=canvas.getBoundingClientRect();return{x:((e.clientX-b.x)*canvas.width/b.width-camera.x)/(T*camera.scale),y:((e.clientY-b.y)*canvas.height/b.height-camera.y)/(T*camera.scale)};}
function hit(p){const u=[...game.s.units].reverse().find(u=>Math.hypot(u.x+.5-p.x,u.y+.5-p.y)<.7);const d=game.s.deposits.find(d=>Math.hypot(d.x+.5-p.x,d.y+.5-p.y)<.85&&game.visible(d.x,d.y));const b=game.s.buildings.find(b=>p.x>=b.x&&p.x<b.x+game.size(b)&&p.y>=b.y&&p.y<b.y+game.size(b));return {u,d,b};}
function feedback(p,label){rings.push({x:p.x,y:p.y,at:performance.now(),label});tell(label);save();ui();}
function isPlacement(){return mode==='outpost'||mode==='workshop';}
function actors(){return game.s.units.filter(u=>selected.has(u.id));}
function ready(){if(blocked){tell('Reload or export before giving new orders.');return false;}if(!actors().length){tell('Select villagers first — tap a portrait or select them on the map.');return false;}return true;}
function clearCommand(){mode=null;placement=null;}
function releasePointer(){const old=pointer;pointer=null;if(old){clearTimeout(old.timer);if(canvas.hasPointerCapture(old.id))canvas.releasePointerCapture(old.id);}}
function cancelInput(clearMode=true,clearContacts=false){
 spaceCycle=null;for(const code of nativeKeys.keys())cancelledNativeKeys.add(code);nativeKeys.clear();releasePointer();
 if(clearMode)clearCommand();if(clearContacts){touchContacts.clear();multiTouch=false;suppressTouchClick=true;}
}
function reject(text){tell(text+' Previous orders kept.');ui();return false;}
function returnNote(workers){return workers.some(u=>u.cargo)?' · carried loads return home before the new order':'';}
function cargoLabel(u){return u.cargo+' '+u.resource;}
function moveFeedback(workers,changed){
 if(!changed)return paused?'This Move is already planned · starts on Resume':'Already moving to this destination';
 const loaded=workers.filter(u=>u.cargo),transfers=loaded.filter(u=>u.transfer);
 let label=workers.length===1&&loaded.length?(paused?'Move planned with ':'Move with ')+cargoLabel(loaded[0]):(paused?'Move planned':'Move assigned')+' · '+workers.length+' villagers';
 if(paused)label+=' · starts on Resume';
 if(loaded.length)label+=' · carried goods stay with their carriers on arrival';
 if(transfers.length)label+=transfers.length===1?' · this carrier\'s delivery is paused':' · these carriers\' deliveries are paused';
 return label;
}
function stopFeedback(workers,changed){
 const loaded=workers.filter(u=>u.cargo),waiting=loaded.filter(u=>u.phase!=='return');
 if(!loaded.length)return changed?'Stopped · ready for orders':'Already stopped';
 if(waiting.length===loaded.length)return 'Holding '+(loaded.length===1?cargoLabel(loaded[0]):'carried goods')+' · no reachable store or drop-off space. Move elsewhere or try Stop and Return when a route opens.';
 const label=paused?'Return planned · starts on Resume':'Stop and Return · carrying goods to reachable storage';
 return label+(waiting.length?' · '+waiting.length+' villagers still holding goods; no reachable drop-off':'');
}
function dispatch(p,verb){
 if(!ready())return false;
 const workers=actors(),ids=workers.map(u=>u.id),target=hit(p);let orders,label,inspectId=null;
 if(verb==='move'){
  const x=Math.floor(p.x),y=Math.floor(p.y);
  if(game.blocked(x,y))return reject('Move needs clear ground.');
  const offsets=[[0,0],[1,0],[0,1],[1,1],[-1,0],[0,-1],[-1,-1],[1,-1]];
  orders=workers.map((u,i)=>{const [dx,dy]=offsets[i%offsets.length],q={x:x+dx,y:y+dy};return{kind:'move',...(game.blocked(q.x,q.y)?{x,y}:q)};});
  label='Move assigned · '+workers.length+' villagers';
 }else if(verb==='gather'){
  const {source,plot}=cultivationHit(p);if(source||plot){const id=source?.id||plot.id;if(applyCultivation('collect',[id,ids],'Collect '+id+' assigned'+returnNote(workers))){clearCommand();ui();return true;}return false;}
  if(!target.d||!target.d.amount)return reject('Gather needs a visible deposit with resources.');
  orders=workers.map(()=>({kind:'gather',target:target.d.id}));label='Gather '+target.d.kind;inspectId=target.d.id;
 }else if(verb==='build'){
  if(!target.b||target.b.done)return reject('Build site needs an unfinished site.');
  orders=workers.map(()=>({kind:'build',target:target.b.id}));label='Build site assigned · '+target.b.kind;inspectId=target.b.id;
 }else if(verb==='craft'){
  if(!target.b||!game.s.knapping||game.s.knapping.done||game.s.knapping.workshop!==target.b.id)return reject('There is no active project here.');
  orders=workers.map(()=>({kind:'craft',target:target.b.id}));label='Resume knapping · reserved materials kept';inspectId=target.b.id;
 }else return false;
 // Validate the entire formation before changing any actor's accepted order.
 if(workers.some((u,i)=>!game.accepts(u,orders[i])))return reject('Every selected villager needs a reachable target.');
 const note=verb==='move'?'':returnNote(workers);let changed=0;
 if(verb==='move')for(let i=0;i<workers.length;i++)changed+=game.command([workers[i].id],orders[i]);
 else changed=game.command(ids,orders[0]);
 clearCommand();if(inspectId)inspect=inspectId;
 feedback(p,verb==='move'?moveFeedback(workers,changed):(changed?label:'This order is already assigned')+note);return true;
}
function cultivationHit(p){if(game.s.version!==7)return{};const s=game.summary();return{plot:s.plots.find(v=>p.x>=v.x&&p.x<v.x+v.width&&p.y>=v.y&&p.y<v.y+v.height&&game.visible(v.x,v.y)),source:s.sources.find(v=>v.discovered&&Math.hypot(v.x+.5-p.x,v.y+.5-p.y)<.8&&game.visible(v.x,v.y))};}
function contextualOrder(p){const {plot,source}=cultivationHit(p);if(plot){inspectCultivationPlot(plot.id);return;}if(source){if(ready())applyCultivation('collect',[source.id,[...selected]],'Collect '+source.id+' assigned'+returnNote(actors()));return;}const {d,b}=hit(p);return dispatch(p,d&&d.amount?'gather':b&&!b.done?'build':b&&b.kind==='workshop'&&game.s.knapping?.workshop===b.id&&!game.s.knapping.done?'craft':'move');}
function commitPlacement(p){
 if(!isPlacement()||!ready())return;
 const kind=mode,result=game.build(kind,Math.floor(p.x),Math.floor(p.y),actors().map(u=>u.id));
 if(result.error){tell(result.error);ui();return;}
 inspect=result.id;clearCommand();feedback(p,game.constructionSite(result.id)?'Site reserved · builders fetch and deliver supplies, then install '+kind+' · carried loads return first':'Prepaid site reserved · builders will construct '+kind+' · carried loads return first');
}
function inspectPoint(p,shift=false,onlyInspect=false){
 const {u,d,b}=hit(p);
 const {plot,source}=cultivationHit(p);if(!u&&!d&&!b&&(plot||source)){if(plot)inspectCultivationPlot(plot.id);else{cancelInput();cultivationUI();$('cultivation-source-details').scrollIntoView({block:'nearest'});}return;}
 if(u){if(!onlyInspect){if(!shift)selected.clear();selected.has(u.id)&&shift?selected.delete(u.id):selected.add(u.id);}inspect=u.id;}
 else if(d)inspect=d.id;else if(b)inspect=b.id;else if(!onlyInspect&&!shift)selected.clear();
 ui();
}
function arm(verb){if(!ready())return;cancelInput();mode=verb;tell(verb==='build'?'Build site · choose an unfinished site':verb==='gather'?'Gather · choose a deposit':verb==='move'?'Move · choose clear ground':'Place '+verb+' · touch previews a site; Confirm site reserves its materials');ui();}
function togglePause(){if(blocked)return;paused=!paused;save();ui();}
function observeInput(){
 canvas.dataset.cameraX=String(camera.x);canvas.dataset.cameraY=String(camera.y);canvas.dataset.cameraScale=String(camera.scale);
 canvas.dataset.command=mode||'none';canvas.dataset.gesture=multiTouch?'multiple-touch':pointer?(pointer.pan?'pan':pointer.kind):'none';canvas.dataset.spaceOwned=String(!!spaceCycle);canvas.dataset.spaceConsumed=String(!!spaceCycle?.consumed);canvas.dataset.touchContacts=String(touchContacts.size);
 canvas.dataset.placementX=placement?String(placement.x):'';canvas.dataset.placementY=placement?String(placement.y):'';
 canvas.classList.toggle('pan-ready',!!spaceCycle);canvas.classList.toggle('panning',!!pointer?.pan);
}
// Track all touch contacts, including a second finger on controls outside the map.
document.addEventListener('pointerdown',e=>{
 if(e.pointerType!=='touch'){if(!touchContacts.size&&!multiTouch)suppressTouchClick=false;return;}
 if(!touchContacts.size&&!multiTouch)suppressTouchClick=false;touchContacts.add(e.pointerId);
 if(touchContacts.size>1||multiTouch){multiTouch=true;suppressTouchClick=true;cancelInput();e.preventDefault();e.stopPropagation();ui();}
},{capture:true,passive:false});
function endTouch(e){
 if(e.pointerType!=='touch')return;
 touchContacts.delete(e.pointerId);
 if(multiTouch){e.preventDefault();e.stopPropagation();if(!touchContacts.size)multiTouch=false;observeInput();}
}
document.addEventListener('pointerup',endTouch,{capture:true,passive:false});
document.addEventListener('pointercancel',e=>{endTouch(e);if(e.pointerType==='touch'){suppressTouchClick=true;cancelInput();ui();}},{capture:true,passive:false});
document.addEventListener('click',e=>{if(multiTouch||suppressTouchClick&&(e.pointerType==='touch'||e.sourceCapabilities?.firesTouchEvents)){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
canvas.addEventListener('contextmenu',e=>{
 e.preventDefault();if(e.pointerType==='touch'||e.sourceCapabilities?.firesTouchEvents||suppressTouchClick||touchContacts.size||multiTouch||pointer?.touch||spaceCycle)return;
 contextualOrder(cell(e));
});
canvas.addEventListener('pointerdown',e=>{
 if(e.button!==0||multiTouch||pointer)return;
 canvas.focus({preventScroll:true});const p=cell(e),rect=canvas.getBoundingClientRect(),touch=e.pointerType==='touch';
 pointer={id:e.pointerId,touch,kind:spaceCycle?'space':touch?'touch':'select',start:p,now:p,clientX:e.clientX,clientY:e.clientY,shift:e.shiftKey,moved:false,pan:false,long:false,cameraX:camera.x,cameraY:camera.y,ratioX:canvas.width/rect.width,ratioY:canvas.height/rect.height,timer:null};
 canvas.setPointerCapture(e.pointerId);
 if(touch&&!spaceCycle){const id=e.pointerId;pointer.timer=setTimeout(()=>{if(!pointer||pointer.id!==id||pointer.moved||multiTouch)return;pointer.long=true;suppressTouchClick=true;clearCommand();inspectPoint(pointer.start,false,true);tell('Inspection only · choose a command to give orders');},LONG_PRESS_MS);}
 observeInput();
});
function movePointer(e){
 hover=cell(e);if(!pointer||pointer.id!==e.pointerId)return;
 const dx=e.clientX-pointer.clientX,dy=e.clientY-pointer.clientY;
 if(Math.hypot(dx,dy)>=DRAG_PX){pointer.moved=true;clearTimeout(pointer.timer);}
 if(pointer.kind==='space'&&pointer.moved){
  pointer.pan=true;if(spaceCycle)spaceCycle.consumed=true;
  camera.x=Math.max(-canvas.width*.75,Math.min(canvas.width*.75,pointer.cameraX+dx*pointer.ratioX));
  camera.y=Math.max(-canvas.height*.75,Math.min(canvas.height*.75,pointer.cameraY+dy*pointer.ratioY));hover=cell(e);
 }else if(pointer.touch&&pointer.moved){suppressTouchClick=true;clearCommand();}
 pointer.now=hover;observeInput();
}
canvas.addEventListener('pointermove',movePointer);
canvas.addEventListener('pointerup',e=>{
 if(e.button!==0||!pointer||pointer.id!==e.pointerId)return;
 movePointer(e);const drag=pointer,p=cell(e);releasePointer();
 if(drag.kind==='space'||drag.pan||drag.long||multiTouch||(drag.touch&&drag.moved)){ui();return;}
 if(drag.moved&&mode){clearCommand();tell('Command cancelled by drag');ui();return;}
 if(isPlacement()){
  if(drag.touch){placement={kind:mode,x:Math.floor(p.x),y:Math.floor(p.y)};hover=p;tell('Site preview · review the cost, then Confirm site');ui();}
  else commitPlacement(p);return;
 }
 if(mode){dispatch(p,mode);return;}
 if(drag.moved){if(!drag.shift)selected.clear();for(const u of game.s.units)if(u.x+.5>=Math.min(p.x,drag.start.x)&&u.x+.5<=Math.max(p.x,drag.start.x)&&u.y+.5>=Math.min(p.y,drag.start.y)&&u.y+.5<=Math.max(p.y,drag.start.y))selected.add(u.id);tell(selected.size+' villagers selected');ui();}
 else inspectPoint(p,drag.shift);
});
canvas.addEventListener('pointercancel',()=>{cancelInput();ui();});
canvas.addEventListener('lostpointercapture',e=>{if(pointer?.id===e.pointerId){cancelInput();ui();}});
$('stores').onclick=()=>{inspect=game.stores()[0].id;ui();};
$('move').onclick=()=>arm('move');$('gather').onclick=()=>arm('gather');$('assign-build').onclick=()=>arm('build');
$('command-cancel').onclick=()=>{cancelInput();tell('Command cancelled');ui();};
$('placement-confirm').onclick=()=>{if(placement&&isPlacement()&&placement.kind===mode)commitPlacement(placement);};
$('stop').onclick=()=>{if(!ready())return;cancelInput();const workers=actors(),changed=game.command(workers.map(u=>u.id),{kind:'idle'});feedback(hover,stopFeedback(workers,changed));};
for(const b of document.querySelectorAll('[data-build]'))b.onclick=()=>arm(b.dataset.build);
$('train').onclick=()=>{if(blocked)return;const err=game.train();tell(err||'A new villager joins the camp');save();ui();};
$('idle').onclick=()=>{selected=new Set(game.s.units.filter(u=>u.phase==='idle').map(u=>u.id));tell(selected.size+' idle villagers selected');ui();};
$('pause').onclick=togglePause;
function textControl(target){return target instanceof Element&&!!target.closest('input,select,textarea,[contenteditable="true"]');}
function buttonControl(target){return target instanceof Element?target.closest('button,summary'):null;}
function linkControl(target){return target instanceof Element?target.closest('a[href]'):null;}
document.addEventListener('keydown',e=>{
 if(!e.repeat)cancelledNativeKeys.delete(e.code);
 const button=buttonControl(e.target);
 if(button&&(e.code==='Space'||e.code==='Enter')){
  if(e.repeat||nativeKeys.has(e.code)){e.preventDefault();return;}
  nativeKeys.set(e.code,{target:button,cancelled:false});return;
 }
 if(!!document.querySelector('dialog[open]')||textControl(e.target)||linkControl(e.target))return;
 if(e.key==='Escape'){e.preventDefault();cancelInput();tell('Command cancelled');ui();return;}
 if(e.code==='Space'){
  e.preventDefault();if(e.repeat||spaceCycle)return;
  if(pointer||multiTouch||touchContacts.size){cancelInput();ui();return;}
  spaceCycle={consumed:false};observeInput();return;
 }
 if(e.repeat)return;
 if(e.key.toLowerCase()==='m')$('move').click();if(e.key.toLowerCase()==='s')$('stop').click();
},{capture:true});
document.addEventListener('keyup',e=>{
 if(linkControl(e.target)){
  nativeKeys.delete(e.code);cancelledNativeKeys.delete(e.code);
  if(e.code==='Space'){spaceCycle=null;if(pointer?.kind==='space')releasePointer();observeInput();}
  return;
 }
 if(cancelledNativeKeys.has(e.code)){cancelledNativeKeys.delete(e.code);e.preventDefault();return;}
 if(nativeKeys.has(e.code)){const entry=nativeKeys.get(e.code);nativeKeys.delete(e.code);if(entry.cancelled||buttonControl(e.target)!==entry.target)e.preventDefault();return;}
 if(e.code!=='Space')return;
 const cycle=spaceCycle;spaceCycle=null;
 if(!cycle)return;e.preventDefault();if(pointer?.kind==='space')releasePointer();
 if(!cycle.consumed&&!document.hidden&&!!!document.querySelector('dialog[open]')&&!textControl(e.target)&&!buttonControl(e.target))togglePause();else ui();observeInput();
},{capture:true});
document.addEventListener('focusin',e=>{if(e.target!==canvas){const hadPointer=!!pointer;spaceCycle=null;releasePointer();for(const [code,entry] of nativeKeys)if(entry.target!==buttonControl(e.target)){cancelledNativeKeys.add(code);nativeKeys.delete(code);}if(hadPointer||!!document.querySelector('dialog[open]'))clearCommand();observeInput();}});
window.addEventListener('blur',()=>{cancelInput(true,true);ui();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelInput(true,true);ui();}});
window.addEventListener('resize',()=>{cancelInput(true,true);ui();});
function goods(map){return HearthCultivationGuidance.goods(map);}
function thirds(value){const n=Number(value||0)/3000;return n.toFixed(3).replace(/\.?0+$/,'')||'0';}
function missingText(rows){return HearthCultivationGuidance.missingText(rows);}
function quoteText(q){
 if(!q)return 'No quote available.';
 const parts=[];if(q.recipe)parts.push('Recipe: '+goods(q.recipe)+'.');
 if(q.workSlots)parts.push('Planting: '+(q.workSlots/10)+' worker-seconds.');
 if(q.growthTicks)parts.push('Unattended foreground growth: '+(q.growthTicks/10)+' seconds.');
 if(q.harvestSlots)parts.push('Harvest: '+(q.harvestSlots/10)+' worker-seconds.');
 if(q.support)parts.push('Support at Hearth store: '+thirds(q.support.foodThirdMilli)+' food, '+thirds(q.support.waterThirdMilli)+' water; fuel up to '+thirds(q.support.woodThirdMilli)+' wood.');
 if(q.ingredientSources?.length)parts.push('Ingredients: '+q.ingredientSources.map(p=>(p.amount??'')+' '+(p.resource||'')+' at '+(game.store(p.storeId)?.name||p.storeId||'Hearth store')).join('; ')+'.');
 if(q.reason)parts.push(q.reason);
 if(q.missing?.length)parts.push('Missing: '+missingText(q.missing)+'.');
 if(q.notes?.length)parts.push(q.notes.join(' '));
 if(q.action==='Provision this camp'&&!q.ok){const hint=HearthCultivationGuidance.waterTransport(game,q.missing);if(hint)parts.push(HearthCultivationGuidance.transportText(hint));}
 return parts.join(' ');
}
function decision(id){cancelInput();paused=true;acc=0;$(id).showModal();ui();}
function applyCultivation(method,args=[],message='Camp updated'){
 if(blocked||!ownsLock||game.s.version!==7)return false;
 try{
  const candidate=new HearthCultivation.Camp(JSON.parse(game.serialize())),result=candidate[method](...args);
  if(!result?.ok){tell(result?.reason||'The command is unavailable. Previous work kept.');ui();return false;}
  writeCandidate(candidate);clearCommand();tell(result.reason||message);ui();return true;
 }catch(e){blocked=true;paused=true;tell('The change could not be saved. Previous camp kept. '+e.message);ui();return false;}
}
function inspectCultivationPlot(id){
 selectedPlot=id;
 if(game.s.version!==7){$('cultivation-panel').scrollIntoView({block:'nearest'});return;}
 if(id==='pilot'&&!blocked)applyCultivation('discoverPlot',[id],'Pilot plot inspected. The seed cache is a physical source to collect.');
 cancelInput();cultivationUI();$('plot-title').scrollIntoView({block:'nearest'});
}
function cultivationUI(){
 const adopted=game.s.version===7;
 $('cultivation-adopt').hidden=adopted;$('cultivation-controls').hidden=!adopted;
 $('source-export').disabled=sourceRaw===null;$('archives-export').disabled=!archives.length;
 $('import').disabled=blocked||!ownsLock;
 if(!adopted){
  $('cultivation-status').textContent='An isolated continuation of this opening. After the outpost and workshop lesson, inspect a paid crop and woodland option. The original RTS slot remains unchanged.';
  $('cultivation-adopt').disabled=blocked||!game.s.complete;$('recruitment-note').hidden=true;return;
 }
 const s=game.summary(),p=game.inspectPlot(selectedPlot),q=game.quotePlant(selectedPlot,[...selected]);
 $('cultivation-status').textContent=s.active?'Local cultivation is active. First Furrow and Agriculture remain unavailable.':'Cultivation sites are available. Collect supplies and review support before planting.';
 $('cultivation-provision').hidden=s.active;$('cultivation-provision').disabled=blocked;
 $('support-status').textContent=(s.active?'Hearth store supplies demanding work. ':'Support has not started. ')+(s.nextFunded?'Next crop funded. ':'Next crop unfunded. ')+(s.supportReason||'')+(!s.nextFunded&&s.nextMissing?.length?' Missing for the next crop: '+missingText(s.nextMissing)+'.':'');
 if(!s.active||!s.nextFunded){const provision=s.active?null:game.provisionQuote(),hint=(s.active||!provision.ok)?HearthCultivationGuidance.waterTransport(game,s.active?s.nextMissing:provision.missing):null;if(hint)$('support-status').textContent+=' '+HearthCultivationGuidance.transportText(hint);}
 const pantry=Object.entries(s.pantry||{}).map(([r,a])=>r+': '+thirds(a.effectiveThirdMilli)+' owned in pantry, '+thirds((BigInt(a.consumedMilli||'0')*3n+BigInt(a.remainder||'0')).toString())+' used').join(' · ');
 $('support-accounting').textContent='Protected floor: '+goods(s.floors)+'. Protected work support: '+thirds(s.protected?.foodThirdMilli)+' food, '+thirds(s.protected?.waterThirdMilli)+' water, up to '+thirds(s.protected?.woodThirdMilli)+' wood. '+(s.nextFunded?'Next crop also reserves 3 whole recipe water at Hearth store. ':'Next crop recipe water is not yet funded. ')+(s.protected?.seed||0)+' retained seed stay protected in their actual custody. '+pantry+'. Displayed fractions are rounded to three decimals; accounting retains exact remainders.';
 $('pantry-return').disabled=blocked||!s.active;
 $('recruitment-note').hidden=!s.active;$('train').disabled=blocked||s.active||game.s.units.length>=8;
 if(!p)return;
 $('plot-title').textContent=p.label;
 const names=p.assigned.map(id=>game.s.units.find(u=>u.id===id)?.name||id).join(', ')||'none';
 const phase=p.phase==='growing'?'Growing — villagers are free for other work. '+Math.max(0,(p.growthTarget-p.growthTicks)/10)+' foreground seconds remain.':p.phase==='planting'?'Planting '+(p.workSlots/10)+' / '+(p.workTarget/10)+' worker-seconds.':p.phase==='harvest'?'Woodland harvest '+(p.harvestSlots/10)+' / '+(p.harvestTarget/10)+' worker-seconds.':p.phase;
 $('cultivation-plot-details').textContent=(p.unlocked?'':'Unavailable until actual pilot food reaches a store. ')+phase+' Assigned: '+names+'. Reserved: '+goods(p.reserved)+'; carried inputs: '+goods(p.carried)+'; staged: '+goods(p.staged)+'; output here: '+goods(p.output)+'. '+(p.blocked||'');
 $('plot-quote').textContent=quoteText(q);
 $('plot-start').textContent=q.action|| (selectedPlot==='pilot'?'Plant pilot crop':'Plant woodland');
 $('plot-start').disabled=blocked||!selected.size||!q.ok;
 $('plot-resume').textContent=p.phase==='cancelling'?'Recover planting supplies':p.phase==='harvest'?'Harvest woodland':'Resume planting';
 $('plot-resume').disabled=blocked||!selected.size||!['supplying','planting','harvest','cancelling'].includes(p.phase);
 $('plot-collect').textContent=selectedPlot==='pilot'?'Collect crop':'Collect woodland yield';
 $('plot-collect').disabled=blocked||!selected.size||p.phase!=='output'||!Object.values(p.output).some(n=>n>0);
 $('plot-cancel').disabled=blocked||!p.canCancel;
 for(const id of ['water-gather','seed-gather'])$(id).disabled=blocked||!selected.size;
 const water=s.sources.find(v=>v.id==='water'),seed=s.sources.find(v=>v.id==='seed');
 $('seed-gather').disabled||= !seed?.discovered;
 $('cultivation-source-details').textContent='Water source: '+(water?Number(water.poolMilli)/1000:'—')+' / 30; refills 6 per foreground minute. Seed cache: '+(seed?.discovered?seed.remainingWhole+' remaining':'inspect the pilot plot to discover it')+'. Workers collect and deliver these goods; inspection adds no stock.';
}
$('cultivation-adopt').onclick=()=>{if(blocked||game.s.version===7)return;const q=HearthCultivation.quoteAdoption(game.serialize());$('cultivation-adoption-quote').textContent=q.reason||'All original people, paid work and material custody can be preserved.';$('cultivation-confirm').disabled=!q.ok;decision('cultivation-confirm-dialog');};
$('cultivation-confirm').onclick=()=>{
 if(blocked||game.s.version===7)return;
 try{const raw=game.serialize(),candidate=HearthCultivation.adopt(raw),history=mergedArchives(archives,[{kind:'camp-state',raw}],sourceRaw?[{kind:'legacy-source',raw:sourceRaw}]:[]);writeCandidate(candidate,raw,history);tripSession=new HearthFeedback.Session();$('cultivation-confirm-dialog').close();tell('Cultivation adopted and saved. Support remains off until you confirm it.');ui();}
 catch(e){$('cultivation-adoption-quote').textContent='The continuation was not saved. Your previous camp is kept. '+e.message;}
};
$('cultivation-confirm-cancel').onclick=()=>$('cultivation-confirm-dialog').close();
$('cultivation-provision').onclick=()=>{if(blocked||game.s.version!==7)return;const q=game.provisionQuote();$('support-quote').textContent=quoteText(q);$('support-confirm').disabled=!q.ok;decision('support-confirm-dialog');};
$('support-confirm').onclick=()=>{if(applyCultivation('provision',[],'Support confirmed. Protected supplies and work are kept.'))$('support-confirm-dialog').close();};
$('support-cancel').onclick=()=>$('support-confirm-dialog').close();
for(const id of ['cultivation-confirm-dialog','support-confirm-dialog'])$(id).addEventListener('cancel',()=>{paused=true;acc=0;cancelInput();});
for(const id of ['pilot','woodland'])$('plot-'+id).onclick=()=>inspectCultivationPlot(id);
for(const id of ['water','seed']){
 $(id+'-inspect').onclick=()=>{cancelInput();cultivationUI();$('cultivation-source-details').scrollIntoView({block:'nearest'});};
 $(id+'-gather').onclick=()=>{if(ready())applyCultivation('collect',[id,[...selected]],'Collect '+id+' assigned'+returnNote(actors()));};
}
$('plot-start').onclick=()=>{if(ready())applyCultivation('plant',[selectedPlot,[...selected]],'Planting admitted. Workers fetch the actual ingredients.');};
$('plot-resume').onclick=()=>{if(ready())applyCultivation('resume',[selectedPlot,[...selected]],'Paid plot work resumed'+returnNote(actors()));};
$('plot-collect').onclick=()=>{if(ready())applyCultivation('collect',[selectedPlot,[...selected]],'Collect the plot output. Seed first, then the food or wood.');};
$('plot-cancel').onclick=()=>applyCultivation('cancelPlot',[selectedPlot],'Unstarted planting released. Carried or staged inputs return physically.');
$('pantry-return').onclick=()=>{
 if(blocked||game.s.version!==7)return;
 let any=false;
 for(const r of ['food','water','wood']){const a=game.summary().pantry[r],count=Number(BigInt(a.effectiveThirdMilli)/3000n);if(count>0){any=applyCultivation('returnPantry',[r,count],'Whole pantry supplies returned at Hearth store; protection and fractions remain owned.')||any;if(blocked)break;}}
 if(!any&&!blocked)tell('No whole pantry supplies can return yet. Fractional material remains owned here.');
};
function installationText(kind){return (game.s.version===6?'After delivery: ':'')+WORK[kind]+' worker-seconds to install.';}
function fundingText(f){if(!f)return '';const label=f.mode==='opening-pool'?'all opening stores':f.name||game.stores().find(s=>s.id===f.storeId)?.name||'no reachable store';const sources=f.sources?.map(p=>p.amount+' '+p.resource+' at '+(game.store(p.storeId)?.name||p.storeId)).join('; ');return 'Funding source: '+label+'.'+(resources.some(r=>f.missing?.[r]>0)?' Missing here: '+goods(f.missing)+'. Bring supplies to this store.':sources?' Reserve for pickup: '+sources+'. Workers carry supplies to the site.':'');}
function commandUI(){
 let help='Select villagers, then choose a command. Unarmed taps inspect; right-click gives a contextual order.';
 if(mode==='move')help='Move: choose clear, reachable ground. Carried goods move with the villager and stay with them on arrival. Deposits and buildings are blocked targets.';
 else if(mode==='gather')help='Gather: choose a visible deposit that still has resources.';
 else if(mode==='build')help='Build site: choose an unfinished site. Workers fetch its reserved supplies, deliver them, then install. Cancelled sites recover supplies; older prepaid sites keep their original terms.';
 else if(isPlacement()){
  const target=placement||hover,x=Math.floor(target.x),y=Math.floor(target.y);
  help='Place '+mode+' at '+x+', '+y+'. '+installationText(mode)+' '+fundingText(game.funding(mode,x,y));
 }
 $('command-help').textContent=help;
 const preview=!!placement&&isPlacement()&&placement.kind===mode;
 $('placement-controls').hidden=!preview;
 if(preview){const error=game.placement(mode,placement.x,placement.y);$('placement-status').textContent=mode+' at '+placement.x+', '+placement.y+' · '+goods(COST[mode])+'. '+installationText(mode)+' '+(error||'Ready to reserve materials.');$('placement-confirm').disabled=blocked||!actors().length||!!error;}
 else{$('placement-status').textContent='';$('placement-confirm').disabled=true;}
 for(const [id,verb] of [['move','move'],['gather','gather'],['assign-build','build']]){const button=$(id);button.classList.toggle('active',mode===verb);button.setAttribute('aria-pressed',String(mode===verb));button.disabled=blocked||!actors().length;}
 $('command-cancel').disabled=!mode&&!placement&&!pointer&&!spaceCycle;
 for(const button of document.querySelectorAll('[data-build]')){button.classList.toggle('active',mode===button.dataset.build);button.setAttribute('aria-pressed',String(mode===button.dataset.build));button.disabled=blocked;}
 observeInput();
}
function storeUI(box,b){
 if(b.retiring){reclaimUI(box,b);return;}
 if(box.dataset.store!==b.id){box.replaceChildren();box.dataset.craft='';box.dataset.site='';box.dataset.store=b.id;const eyebrow=document.createElement('span');eyebrow.className='eyebrow';eyebrow.textContent='LOCAL SUPPLIES';const title=document.createElement('h3');title.id='store-title';const table=document.createElement('table');table.className='store-table';table.innerHTML='<thead><tr><th>Goods</th><th>Here</th><th>Free</th><th>Reserved</th></tr></thead><tbody>'+resources.map(r=>'<tr><th>'+r+'</th><td id="local-'+r+'"></td><td id="free-'+r+'"></td><td id="reserved-'+r+'"></td></tr>').join('')+'</tbody>';const incoming=document.createElement('p');incoming.id='store-incoming';const note=document.createElement('p');note.className='small-note';note.textContent='Free stock can fund work here. A transfer reserves goods now; a carrier must collect and deliver them.';const labels=document.createElement('div');labels.className='transfer-fields';labels.innerHTML='<label>Send to<select id="store-destination"></select></label><label>Goods<select id="store-resource">'+resources.map(r=>'<option value="'+r+'">'+r+'</option>').join('')+'</select></label>';const quote=document.createElement('p');quote.id='store-quote';quote.setAttribute('role','status');const button=document.createElement('button');button.id='store-transfer';button.textContent='Send selected carriers';button.onclick=()=>{if(blocked)return;const ids=[...selected],destination=$('store-destination').value,resource=$('store-resource').value,q=game.quoteTransfer(ids,b.id,destination,resource),result=game.transfer(ids,b.id,destination,resource);if(result.error)tell(result.error);else tell(q.id?'Transfer already exists · custody and delivery unchanged. Use Move or Stop and Return for carried goods.':'Transfer assigned · '+result.amount+' '+resource+' · one load per carrier');save();ui();};box.append(eyebrow,title,table,incoming,note,labels,quote,button);$('store-destination').onchange=ui;$('store-resource').onchange=ui;}
 const stores=game.stores(),row=stores.find(s=>s.id===b.id);$('store-title').textContent=row.name;for(const r of resources){$('local-'+r).textContent=row.stock[r]||0;$('free-'+r).textContent=row.available[r]||0;$('reserved-'+r).textContent=row.reserved[r]||0;}$('store-incoming').textContent='Incoming: '+goods(row.incoming);const destinations=stores.filter(s=>s.id!==b.id),key=destinations.map(s=>s.id).join(',');if($('store-destination').dataset.options!==key){const current=$('store-destination').value;$('store-destination').replaceChildren(...destinations.map(s=>{const option=document.createElement('option');option.value=s.id;option.textContent=s.name;return option;}));if(destinations.some(s=>s.id===current))$('store-destination').value=current;$('store-destination').dataset.options=key;}
 const quote=game.quoteTransfer([...selected],b.id,$('store-destination').value,$('store-resource').value);$('store-quote').textContent=quote.error||(quote.id?'Existing transfer · original allocation '+quote.amount+' '+quote.resource+' · custody and delivery unchanged.':quote.amount+' '+quote.resource+' · '+quote.workers.length+' carriers · up to 5 each');$('store-transfer').textContent=quote.id?'Check existing transfer':'Send selected carriers';$('store-transfer').disabled=blocked||!!quote.error;
 if(b.kind==='outpost')reclaimControls(box,b);
}
function reclaimControls(box,b){
 if(!$('outpost-reclaim')){const text=document.createElement('p');text.id='reclaim-status';text.setAttribute('role','status');const button=document.createElement('button');button.id='outpost-reclaim';button.onclick=()=>{if(blocked)return;const result=game.reclaim([...selected],b.id);if(result.error){tell(result.error);return;}clearCommand();box.dataset.store='';tell('Recovery assigned · this outpost stops receiving supplies. Workers recover its 60 wood + 20 stone in carried loads until finished or interrupted.'+(paused?' Starts on Resume.':''));save();ui();};box.append(text,button);}
 const q=game.reclaimQuote([...selected],b.id);$('reclaim-status').textContent=q.reason||'Recover 60 wood + 20 stone through pickup and hauling. The footprint stays until every load is returned. Stop or another order interrupts future pickups.';$('outpost-reclaim').textContent=b.retiring?'Resume recovery with selected villagers':'Recover this outpost';$('outpost-reclaim').disabled=blocked||!q.ok;
}
function reclaimUI(box,b){
 if(box.dataset.store!=='reclaim:'+b.id){box.replaceChildren();box.dataset.store='reclaim:'+b.id;box.dataset.site='';box.dataset.craft='';const title=document.createElement('h3');title.textContent='Outpost '+b.id.slice(1)+' · recovery';const capital=document.createElement('p');capital.id='reclaim-capital';box.append(title,capital);}
 const c=game.reclaimClaim(b.id),carried=Object.fromEntries(resources.map(r=>[r,game.s.units.filter(u=>u.reclaim?.claimId===b.id&&u.resource===r).reduce((n,u)=>n+u.cargo,0)]));$('reclaim-capital').textContent='Still in structure: '+goods(c.unreleased)+' | Carried: '+goods(carried)+' | Received: '+goods(c.receipted)+'. This site no longer stores or supplies goods.';reclaimControls(box,b);
}
function workshopUI(box,b){
 if(box.dataset.craft!==b.id){box.replaceChildren();box.dataset.site='';box.dataset.craft=b.id;const eyebrow=document.createElement('span');eyebrow.className='eyebrow';eyebrow.textContent='CRAFT WORKSHOP';const title=document.createElement('h3');title.textContent='Useful edges';const text=document.createElement('p');text.id='craft-effect';text.textContent='Knapped tools use 25% less extraction time per item (33.3% higher extraction rate). Hauling and five-item loads are unchanged, so total delivery gains depend on travel.';const funding=document.createElement('p');funding.id='craft-funding';const status=document.createElement('p');status.id='craft-status';const progress=document.createElement('progress');progress.id='craft-progress';progress.max=12;const button=document.createElement('button');button.id='craft-knapping';button.onclick=()=>{if(blocked)return;const err=game.beginKnapping(b.id,[...selected]);tell(err||'Knapping assigned · workers bring home any carried load first');save();ui();};box.append(eyebrow,title,text,funding,status,progress,button);}
 const p=game.s.knapping,local=p?.workshop===b.id,finished=game.s.tools,workers=game.s.units.filter(u=>(u.next||u.order).kind==='craft'&&(u.next||u.order).target===b.id).length;
 if(game.s.version===7)$('craft-effect').textContent='Inherited tools keep their paid 0.45-second extraction pace when support is funded. At a support shortage or unfunded next crop, gathering continues at 0.60 recovery pace with the same order and cargo. Loads stay at five.';
 $('craft-progress').value=local?p.work:finished?12:0;$('craft-progress').hidden=!p&&!finished;$('craft-status').textContent=finished?(game.s.version===7?'Toolset retained · funded 0.45 / recovery 0.60 seconds per item':'Toolset complete · 0.60 → 0.45 seconds per item'):local?'Materials reserved · '+p.work.toFixed(1)+' / 12 worker-seconds · '+workers+' assigned':'4 wood + 8 stone · 12 worker-seconds';
 $('craft-funding').textContent=(game.s.version===7?'Material funding is shown below; prospective work support may pause this project while crop reserves stay protected. ':'')+(finished?'Materials already used for this completed toolset.':local?'This project’s materials are already reserved.':fundingText(game.knappingFunding(b.id)));
 $('craft-knapping').textContent=finished?'Useful edges crafted':local?'Assign selected villagers':'Reserve materials & assign';$('craft-knapping').disabled=blocked||finished;
}
function unitStatus(u){
 if(!u.cargo)return u.reason;
 const load=cargoLabel(u);
 if(u.phase==='carryMove')return (paused?'Move planned':'Moving')+' · '+load;
 if(u.phase==='idle')return (u.order.kind==='move'?'Move blocked · holding':'Holding')+' · '+load;
 if(u.phase==='return')return (paused?'Return planned':'Returning')+' · '+load;
 if(u.phase==='transfer')return (paused?'Delivery planned':'Delivering')+' · '+load;
 return u.reason+' · '+load;
}
function unitDetail(u){
 if(!u.cargo)return u.reason;
 const load=cargoLabel(u),stores=game.stores(),destination=stores.find(b=>b.id===u.dropoff);let detail;
 if(u.phase==='carryMove')detail=(paused?'Move planned with '+load+'. Starts on Resume.':'Moving with '+load+'.')+' The load stays with this villager on arrival.';
 else if(u.phase==='idle'&&u.order.kind==='move')detail='Move blocked. Holding '+load+'. Choose another Move or Stop and Return.';
 else if(u.phase==='idle'){
  detail=u.reason.startsWith('Holding ')?u.reason:'Holding '+load+'. '+u.reason;
  if(!detail.includes('Stop and Return'))detail+=' · choose Move or Stop and Return';
 }else if(u.phase==='return'||u.phase==='transfer'){
  detail=(u.phase==='return'?(paused?'Return planned':'Returning'):(paused?'Delivery planned':'Delivering'))+' with '+load+(destination?' to '+destination.name:'')+'.';
  if(paused)detail+=' Starts on Resume.';
  if(u.next&&u.next.kind!=='idle')detail+=' The next order starts after delivery.';
 }else detail=u.reason+' · carrying '+load;
 const job=u.transfer&&game.s.storage.transfers.find(j=>j.id===u.transfer);
 if(job){const source=stores.find(b=>b.id===job.from),receiver=stores.find(b=>b.id===job.to);detail+=' Transfer load: '+(source?.name||'source store')+' → '+(receiver?.name||'assigned store')+'.';if(u.phase==='carryMove'||u.phase==='idle')detail+=' This carrier\'s delivery is paused. Stop and Return uses reachable storage.';}
 if(u.reclaim)detail+=' Recovered outpost capital. It becomes spendable only at an actual store receipt; another order ends future recovery pickups.';
 if(u.supply){const c=game.constructionSite(u.supply.siteId),origin=u.supply.origin;detail+=' Construction supplies for '+u.supply.siteId+(origin?' from '+(origin.kind==='hearth'?'Hearth store':'Outpost '+origin.storeId.slice(1)+' store'):' recovered onsite')+'. '+(c?.state==='active'?'A store receipt reserves this load again for the same site.':'A store receipt makes this recovered load available.');}
 return detail;
}
function siteUI(box,b){
 const c=game.constructionSite(b.id),status=game.siteSupply(b.id);
 if(box.dataset.site!==b.id){box.replaceChildren();box.dataset.site=b.id;const title=document.createElement('h3');title.textContent=(b.kind==='outpost'?'Outpost':'Workshop')+' site';const text=document.createElement('p');text.id='site-supply';text.setAttribute('role','status');const progress=document.createElement('progress');progress.id='site-work';progress.max=WORK[b.kind];const cancel=document.createElement('button');cancel.id='site-cancel';cancel.onclick=()=>{if(blocked)return;clearCommand();const changed=game.cancel(b.id);tell(changed?(c?'Cancellation started · unpicked reservations released; onsite and carried supplies return physically.':'Prepaid site cancelled · full refund returned'):'This site is no longer available');save();ui();};const recover=document.createElement('button');recover.id='site-recover';recover.textContent='Resume supply recovery with selected villagers';recover.onclick=()=>{if(!ready())return;const count=game.command([...selected],{kind:'build',target:b.id});tell(count?'Supply recovery assigned · carried loads return first':'No new recovery assignment; check selected villagers and reachable stores');save();ui();};box.append(title,text,progress,cancel,recover);}
 $('site-work').value=b.work;$('site-cancel').textContent=c?(c.state==='active'?'Cancel and recover supplies':'Supplies returning'):'Cancel site · full refund';$('site-cancel').disabled=blocked||c?.state==='cancelling';$('site-recover').hidden=c?.state!=='cancelling';$('site-recover').disabled=blocked||!actors().length;
 if(!c){$('site-supply').textContent='Legacy prepaid materials: '+goods(b.cost)+'. Work '+b.work.toFixed(1)+' / '+WORK[b.kind]+' worker-seconds. Completion needs no second bill or delivery; cancellation returns the full original payment.';return;}
 const sourceNames=status.sources.map(p=>p.amount+' '+p.resource+' at '+(game.store(p.storeId)?.name||p.storeId)).join('; ')||'none',workers=game.s.units.filter(u=>u.order.kind==='build'&&u.order.target===b.id&&!u.next),next=c.state==='cancelling'?'Return carried goods and recover onsite supplies.':resources.some(r=>status.reserved[r])?'Fetch reserved supplies.':resources.some(r=>status.carried[r])?'Wait for deliveries.':'Install the delivered materials.';
 $('site-supply').textContent='Source-reserved: '+goods(status.reserved)+' | En route: '+goods(status.carried)+' | Onsite: '+goods(status.staged)+' | Build work: '+b.work.toFixed(1)+' / '+WORK[b.kind]+' worker-seconds. Sources: '+sourceNames+'. Next: '+next+' '+workers.length+' assigned. Selected: '+(actors().map(u=>u.name+' — '+unitStatus(u)).join('; ')||'none')+(c.state==='cancelling'?' Released: '+goods(status.released)+'; returned: '+goods(status.returned)+'. Move or held cargo keeps its manual order; use Stop and Return.':' Cancel releases unpicked reservations now; onsite and carried supplies still need returning.');
}
function nextOpportunity(){
 if(game.s.version!==7)return HearthFeedback.nextStep(game,tripSession);
 return HearthCultivationGuidance.nextOpportunity(game);
}
function progressionUI(){
 const step=nextOpportunity();
 $('progress-title').textContent=step.title;$('progress-detail').textContent=step.detail;
 $('progress-inspect').textContent=step.actionLabel;$('progress-inspect').disabled=!step.targetId;
 $('camp-warning').hidden=!blocked&&!unreadableSave;
 $('camp-warning').textContent=unreadableSave?readWarning:readOnlyReason|| (blocked?'Progress is paused because saving or recovery needs attention. Open Journey to export your camp before reloading.':'');
 $('toast').hidden=!blocked&&!unreadableSave&&performance.now()>toastUntil;
}
$('progress-inspect').onclick=()=>{
 const step=nextOpportunity();if(!step.targetId)return;
 if(['pilot','woodland'].includes(step.targetId)){inspectCultivationPlot(step.targetId);return;}
 cancelInput();inspect=step.targetId;ui();$('inspect').scrollIntoView({block:'nearest'});$('inspect').focus({preventScroll:true});
};
function tripUI(box,d){
 if(game.s.version===7){let note=box.querySelector('#trip-feedback');if(!note){note=document.createElement('p');note.id='trip-feedback';box.append(note);}note.textContent='Support can change extraction between funded tools and recovery pace. This continuation does not attribute trip times to tools alone. Held loads and current worker actions remain visible.';return;}
 const rows=tripSession.samplesFor(d.id),renderKey=JSON.stringify([d.amount===0,rows]);
 const old=box.querySelector('#trip-feedback');if(old&&old.dataset.key===renderKey)return;
 const restoreHistoryFocus=!!old&&document.activeElement===old.querySelector('#trip-history>summary');
 const panel=document.createElement('section');panel.id='trip-feedback';panel.dataset.key=renderKey;
 const heading=document.createElement('h4');heading.textContent='What a trip delivered';panel.append(heading);
 const status=document.createElement('p');status.id='trip-status';
 status.textContent=rows.length?'Observed this visit · complete five-item delivery cycles.':'No complete cycle observed this visit. '+(d.amount===0?'This source is exhausted.':'A cycle needs two full deliveries by one villager to the same store. A small remaining source may not provide one.');
 panel.append(status);
 let history=null;if(rows.length>2){history=document.createElement('details');history.id='trip-history';history.open=tripHistoryOpen.has(d.id);const summary=document.createElement('summary');summary.textContent='Earlier observed trips ('+(rows.length-2)+')';history.append(summary);history.ontoggle=()=>{if(history.open)tripHistoryOpen.add(d.id);else tripHistoryOpen.delete(d.id);};}
 for(const [index,sample] of rows.entries()){
  const row=document.createElement('div');row.dataset.trip='';row.dataset.source=sample.sourceId;row.dataset.worker=sample.workerId;row.dataset.store=sample.storeId;row.dataset.tools=String(sample.tools);
  const title=document.createElement('p');title.className='trip-title';title.textContent=sample.workerName+' → '+sample.storeName+' · '+(sample.tools?'tools crafted':'tools not yet crafted')+' · '+sample.amount+' '+sample.resource+' in '+sample.seconds.toFixed(1)+'s';
  const parts=document.createElement('p');parts.className='trip-parts';parts.textContent='Extraction '+sample.extractSeconds.toFixed(1)+'s · walking '+sample.travelSeconds.toFixed(1)+'s · handling '+sample.otherSeconds.toFixed(1)+'s';
  const when=document.createElement('p');when.className='trip-when';when.textContent='Observed at '+sample.time.toFixed(1)+'s camp time; '+sample.sourceRemaining+' remained at this source. '+(sample.currentLayout?'Current camp layout.':'Earlier camp layout.');
  row.append(title,parts,when);if(index<rows.length-2&&history)history.append(row);else panel.append(row);
 }
 if(history)panel.append(history);
 const note=document.createElement('p');note.className='small-note';note.textContent='Historical samples, not a forecast. Tools affect extraction; the actual route, drop-off and other villagers also affect the trip. First approaches, partial loads and interrupted cycles are excluded. Observations restart on reload or import.';panel.append(note);if(old)old.replaceWith(panel);else box.append(panel);if(restoreHistoryFocus&&history)history.querySelector('summary').focus({preventScroll:true});
}
function depositUI(box,d){
 if(box.dataset.deposit!==d.id){box.replaceChildren();box.dataset.deposit=d.id;box.dataset.store='';box.dataset.craft='';box.dataset.site='';const label=document.createElement('span');label.className='eyebrow';label.textContent='FINITE RESOURCE';const title=document.createElement('h3');title.textContent=names[d.kind];const amount=document.createElement('div');amount.className='amount';const note=document.createElement('p');note.id='deposit-note';box.append(label,title,amount,note);}
 box.querySelector('.amount').textContent=d.amount+' / '+d.initial;box.querySelector('#deposit-note').textContent=d.amount?'Does not regenerate. Right-click to gather; workers carry 5 per trip.':'Exhausted. Select these workers and send them to another deposit.';tripUI(box,d);
}
function inspectUI(){const box=$('inspect'),u=game.s.units.find(v=>v.id===inspect),d=game.s.deposits.find(v=>v.id===inspect),b=game.s.buildings.find(v=>v.id===inspect);if(d){depositUI(box,d);return;}box.dataset.deposit='';if(!u&&!d&&!b){box.innerHTML='<span class="eyebrow">FIELD NOTES</span><h3>Select a villager, store or deposit</h3><p>Resources enter a store when a worker delivers them.</p>';box.dataset.store='';box.dataset.craft='';box.dataset.site='';return;}if(b&&b.done&&['hearth','outpost'].includes(b.kind)){storeUI(box,b);return;}box.dataset.store='';if(b&&b.done&&b.kind==='workshop'){workshopUI(box,b);return;}box.dataset.craft='';if(b&&!b.done){siteUI(box,b);return;}box.dataset.site='';box.replaceChildren();const eyebrow=document.createElement('span');eyebrow.className='eyebrow';eyebrow.textContent=d?'FINITE RESOURCE':u?'VILLAGER':'CAMP STRUCTURE';box.append(eyebrow);const title=document.createElement('h3');title.textContent=d?names[d.kind]:u?u.name:b.kind==='hearth'?'The hearth':b.kind==='outpost'?'Outpost':'Workshop';box.append(title);const text=document.createElement('p');
 if(d){const amount=document.createElement('div');amount.className='amount';amount.textContent=d.amount+' / '+d.initial;box.append(amount);text.textContent=d.amount?'Does not regenerate. Right-click to gather; workers carry 5 per trip.':'Exhausted. Select these workers and send them to another deposit.';}
 if(u)text.textContent=unitDetail(u);if(b){text.textContent=b.done?(b.kind==='workshop'?'Select villagers to craft useful tools here.':'Workers return loads to the nearest reachable hearth or outpost.'):'Reserved materials · '+Object.entries(b.cost).map(([r,n])=>n+' '+r).join(' · ');if(!b.done){const progress=document.createElement('progress');progress.max=WORK[b.kind];progress.value=b.work;box.append(progress);const cancel=document.createElement('button');cancel.textContent='Cancel site · full refund';cancel.onclick=()=>{if(blocked)return;clearCommand();const removed=game.cancel(b.id);tell(removed?'Site cancelled · materials returned':'This site is no longer available');save();ui();};box.append(cancel);}}box.append(text);if(d)tripUI(box,d);}
function ui(){if(game.s.version!==7)tripSession.notice(game.s);const s=game.s,economy=game.economy();for(const id of selected)if(!s.units.some(u=>u.id===id))selected.delete(id);$('economy').innerHTML=resources.map(r=>'<div class="resource" title="Available across all stores; jobs use their named source"><small>'+r.toUpperCase()+' FREE</small><i>'+icons[r]+'</i>'+Math.floor(economy.available[r]||0)+'</div>').join('');$('economy-flow').textContent='In stores: '+goods(economy.stored)+' | Reserved for pickup: '+goods(economy.reserved)+' | Carried: '+goods(economy.inTransit)+' | Onsite supplies: '+goods(economy.constructionStaged)+' | Gathered: '+goods(economy.produced)+' | Moved between stores: '+goods(economy.transferred)+' | Recovered: '+goods(economy.recovered);$('idle').innerHTML='Idle <b>'+s.units.filter(u=>u.phase==='idle').length+'</b>';$('pause').textContent=paused?'Resume':'Pause';$('paused').hidden=!paused;$('time').textContent=String(Math.floor(s.time/60)).padStart(2,'0')+':'+String(Math.floor(s.time%60)).padStart(2,'0');
 const goals=[[s.depleted>0,'Exhaust a nearby deposit'],[s.buildings.some(b=>b.kind==='outpost'&&b.done&&!b.retiring&&b.x>20),'Build an outpost east of the river'],[s.buildings.some(b=>b.kind==='workshop'&&b.done),'Finish a workshop']];$('goals').innerHTML=goals.map(([done,text])=>'<li class="'+(done?'done':'')+'">'+text+'</li>').join('');$('opening-count').textContent=goals.filter(([done])=>done).length+' / 3';progressionUI();
 if(!$('selection-title')){const label=document.createElement('div');label.className='selection-title';const count=document.createElement('span');count.id='selection-title';label.append(count);const all=document.createElement('button');all.textContent='Select all';all.id='select-all';all.onclick=()=>{selected=new Set(game.s.units.map(u=>u.id));ui();};label.append(all);$('selection').append(label);}
 $('selection-title').textContent=selected.size+' SELECTED / '+s.units.length+' VILLAGERS';
 for(const old of $('selection').querySelectorAll('[data-unit]'))if(!s.units.some(u=>u.id===old.dataset.unit))old.remove();
 for(const u of s.units){let b=$('selection').querySelector('[data-unit="'+u.id+'"]');if(!b){b=document.createElement('button');b.dataset.unit=u.id;const portrait=document.createElement('span');portrait.className='portrait';portrait.textContent='♟';const name=document.createElement('span');name.className='unit-name';const status=document.createElement('small');b.append(portrait,name,status);b.onclick=e=>{if(!e.shiftKey)selected.clear();selected.has(u.id)&&e.shiftKey?selected.delete(u.id):selected.add(u.id);inspect=u.id;ui();};$('selection').append(b);}b.className='unit-card '+(u.phase==='idle'?'idle':'');b.setAttribute('aria-pressed',String(selected.has(u.id)));b.querySelector('.unit-name').textContent=u.name;b.querySelector('small').textContent=unitStatus(u);b.title=unitDetail(u);}
 $('stop').disabled=blocked;$('train').disabled=blocked||s.units.length>=8;$('export').disabled=unreadableSave;inspectUI();commandUI();cultivationUI();}
// All map art is drawn here: layered terrain, finite deposit clusters, buildings and villagers.
const noise=(x,y)=>{const v=Math.sin(x*127.1+y*311.7)*43758.5453;return v-Math.floor(v);};
function poly(points,color,stroke){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();}}
function circle(x,y,r,color){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
function drawSiteSupply(b,x,y,z){const c=game.constructionSite(b.id);if(!c)return;
 // Onsite piles represent delivered goods, separately from installation work.
 const logs=Math.ceil(c.staged.wood/5),stones=Math.ceil(c.staged.stone/5);
 for(let i=0;i<logs;i++){const px=x+10+(i%4)*11,py=y+z-13-Math.floor(i/4)*7;ctx.fillStyle='#ad7c49';ctx.fillRect(px,py,9,5);circle(px+1,py+2.5,2.5,'#d7b37a');}
 for(let i=0;i<stones;i++){const px=x+13+(i%4)*10,py=y+13+Math.floor(i/4)*9;poly([[px-4,py+3],[px-2,py-4],[px+3,py-5],[px+5,py+3]],'#bdc5af','#637369');}
 const total=resources.reduce((n,r)=>n+(c.staged[r]||0),0),bill=Object.values(b.cost).reduce((a,n)=>a+n,0);ctx.fillStyle='#243a31';ctx.fillRect(x,y-10,z,4);ctx.fillStyle=c.state==='cancelling'?'#e1a978':'#b6d49a';ctx.fillRect(x,y-10,z*total/bill,4);ctx.font='bold 9px system-ui';ctx.textAlign='center';ctx.fillStyle='#f0dfb7';ctx.fillText(c.state==='cancelling'?'RETURN SUPPLIES':total+'/'+bill+' ONSITE',x+z/2,y-15);
}
function draw(now){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#101b1b';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.save();ctx.translate(camera.x,camera.y);ctx.scale(camera.scale,camera.scale);const seen=new Set(game.s.seen);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const visible=seen.has(y*W+x);ctx.fillStyle=visible?(game.water(x,y)?'#527d79':noise(x,y)>.5?'#58694b':'#536548'):'#1d302b';ctx.fillRect(x*T,y*T,T+1,T+1);if(visible&&!game.water(x,y)){ctx.fillStyle='#b5bc7540';for(let i=0;i<3;i++)ctx.fillRect((x+noise(x+i,y))*T,(y+noise(y+i,x))*T,2,3);}if(visible&&game.water(x,y)){ctx.strokeStyle='#a0bdb340';ctx.beginPath();ctx.moveTo(x*T+6,y*T+14);ctx.lineTo(x*T+24,y*T+12);ctx.stroke();}}
 // Authored trail through the ford; landmarks remain clear of deposits.
 ctx.strokeStyle='#b6a67b55';ctx.lineWidth=21;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(10*T,13*T);ctx.bezierCurveTo(15*T,15*T,18*T,12*T,26*T,13*T);ctx.stroke();
 for(const d of game.s.deposits){if(!seen.has(d.y*W+d.x))continue;const x=(d.x+.5)*T,y=(d.y+.5)*T;ctx.save();ctx.translate(x,y);if(d.amount===0){circle(0,0,10,'#3c4837');ctx.fillStyle='#a6a085';ctx.fillRect(-5,-4,10,6);}else if(d.kind==='wood'){for(const [a,b,k]of [[-10,3,.8],[10,4,.85],[0,-8,1.1]]){ctx.fillStyle='#725639';ctx.fillRect(a-2,b,4,18*k);poly([[a,b-27*k],[a-15*k,b+7*k],[a+15*k,b+7*k]],'#233f32','#82936b');poly([[a,b-30*k],[a-10*k,b-4*k],[a+10*k,b-4*k]],'#6a8154');}}else if(d.kind==='stone'){poly([[-20,9],[-16,-10],[0,-23],[20,-7],[17,14]],'#a4aa9b','#505f59');poly([[-16,-10],[0,-23],[3,-1],[-20,9]],'#cad0b8');poly([[3,-1],[20,-7],[17,14]],'#7c897d');}else{for(const [a,b]of [[-12,3],[10,2],[0,-8]]){circle(a,b,12,'#3b5935');circle(a-3,b-3,9,'#829159');for(let i=0;i<3;i++)circle(a+i*4-4,b+2,2.5,'#dca982');}}ctx.restore();ctx.fillStyle='#13251eea';ctx.fillRect(x-27,y+24,54,18);ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillStyle=d.amount?'#e8e2c7':'#9aaa96';ctx.fillText(d.amount?d.amount+' '+(d.kind==='wood'?'W':d.kind==='stone'?'S':'F'):'EMPTY',x,y+37);if(d.amount){ctx.fillStyle='#304535';ctx.fillRect(x-25,y+43,50,3);ctx.fillStyle={wood:'#b5c985',stone:'#b7c7bd',food:'#d9b278'}[d.kind];ctx.fillRect(x-25,y+43,50*d.amount/d.initial,3);}}
 for(const b of game.s.buildings){const x=b.x*T,y=b.y*T,z=game.size(b)*T;ctx.fillStyle='#1b322852';ctx.fillRect(x-3,y+8,z+8,z+3);if(!b.done){ctx.strokeStyle='#e7c37e';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.strokeRect(x+3,y+3,z-6,z-6);ctx.setLineDash([]);ctx.fillStyle='#c3b48630';ctx.fillRect(x+4,y+4,z-8,z-8);ctx.fillStyle='#28392d';ctx.fillRect(x,y+z+5,z,5);ctx.fillStyle='#e3c57b';ctx.fillRect(x,y+z+5,z*b.work/WORK[b.kind],5);}else if(b.kind==='hearth'){ctx.fillStyle='#a09367';ctx.fillRect(x+2,y+2,z-4,z-4);poly([[x+3,y+z*.4],[x+z*.5,y-8],[x+z-3,y+z*.4]],'#c7b18a','#7b6b4b');poly([[x+3,y+z*.4],[x+z*.5,y+7],[x+z*.5,y+z*.7],[x+8,y+z-3]],'#8e7954');poly([[x+z*.5,y+7],[x+z-3,y+z*.4],[x+z-8,y+z-3],[x+z*.5,y+z*.7]],'#bba175');circle(x+z*.5,y+z*.72,16,'#43503a');poly([[x+z*.5-10,y+z*.74],[x+z*.5,y+z*.39],[x+z*.5+10,y+z*.74]],'#e79b55');circle(x+z*.5,y+z*.69,5,'#f4d491');}else{ctx.fillStyle='#ad956a';ctx.fillRect(x+6,y+9,z-12,z-14);poly([[x-3,y+15],[x+z/2,y-7],[x+z+3,y+15],[x+z/2,y+30]],b.kind==='outpost'?'#839268':'#c49b65','#505c3e');ctx.fillStyle='#3c4431';ctx.fillRect(x+z/2-7,y+z-24,14,19);if(b.kind==='outpost'){ctx.strokeStyle='#d9c58d';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+z-8,y+10);ctx.lineTo(x+z-8,y-20);ctx.stroke();poly([[x+z-8,y-20],[x+z+12,y-15],[x+z-8,y-8]],'#e0c47d');}}
 if(!b.done)drawSiteSupply(b,x,y,z);
 ctx.fillStyle='#e6e1c8';ctx.textAlign='center';ctx.font='10px system-ui';ctx.fillText(b.kind.toUpperCase()+(b.kind==='workshop'&&game.s.tools?' ✓':''),x+z/2,y+z+22);if(b.kind==='workshop'&&b.done&&game.s.knapping?.workshop===b.id&&!game.s.tools){ctx.fillStyle='#24392d';ctx.fillRect(x,y-18,z,5);ctx.fillStyle='#e3c57b';ctx.fillRect(x,y-18,z*game.s.knapping.work/12,5);}}
 if(game.s.version===7){
  const cultivation=game.summary();
  for(const p of cultivation.plots){if(!game.visible(p.x,p.y))continue;const x=p.x*T,y=p.y*T;
   ctx.fillStyle=p.unlocked?'#715b3c':'#53593b';ctx.fillRect(x+3,y+3,T*2-6,T*2-6);ctx.strokeStyle=selectedPlot===p.id?'#edda9c':'#a79965';ctx.lineWidth=2;ctx.strokeRect(x+3,y+3,T*2-6,T*2-6);
   for(let row=0;row<3;row++){ctx.strokeStyle='#443f2a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+10,y+14+row*15);ctx.lineTo(x+54,y+14+row*15);ctx.stroke();
    if(['growing','harvest','output'].includes(p.phase))for(let col=0;col<3;col++){const a=x+15+col*15,b=y+11+row*15;ctx.strokeStyle='#bfd090';ctx.beginPath();ctx.moveTo(a,b+6);ctx.lineTo(a,b-3);ctx.stroke();poly([[a,b],[a-5,b-5],[a-2,b+2]],p.id==='pilot'?'#cad993':'#a3c77b');}}
   if(p.phase==='output'){circle(x+49,y+47,8,p.id==='pilot'?'#d6a273':'#b28651');circle(x+15,y+46,4,'#e4d095');}
   ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillStyle='#eee1be';ctx.fillText(p.id==='pilot'?'PILOT PLOT':'WOODLAND',x+T,y+T*2+12);
  }
  for(const source of cultivation.sources){if(!source.discovered||!game.visible(source.x,source.y))continue;const x=(source.x+.5)*T,y=(source.y+.5)*T;circle(x,y,11,source.id==='water'?'#a0cccf':'#c7b57e');
   if(source.id==='water'){ctx.strokeStyle='#496f78';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y-2,7,0,Math.PI);ctx.stroke();}else for(let i=0;i<3;i++)circle(x-4+i*4,y,2,'#786844');
   ctx.fillStyle='#f1e8cb';ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillText(source.id==='water'?'WATER '+source.remainingWhole:'SEED '+source.remainingWhole,x,y+24);
  }
 }
 // Selection paths make hauling and command destinations legible.
 for(const u of game.s.units){if(selected.has(u.id)&&u.path.length){ctx.strokeStyle='#d3dda778';ctx.lineWidth=1;ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo((u.x+.5)*T,(u.y+.5)*T);for(const p of u.path)ctx.lineTo((p.x+.5)*T,(p.y+.5)*T);ctx.stroke();ctx.setLineDash([]);}}
 for(const u of game.s.units){const x=(u.x+.5)*T,y=(u.y+.5)*T;circle(x+2,y+5,9,'#21372977');if(selected.has(u.id)){ctx.strokeStyle='#d5e8ab';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y+4,12,7,0,0,Math.PI*2);ctx.stroke();}ctx.fillStyle=u.phase==='idle'?'#c2b392':'#d7bc8a';ctx.fillRect(x-6,y-7,12,14);circle(x,y-11,5,'#d5ae85');ctx.fillStyle='#4b4833';ctx.fillRect(x-6,y+6,4,6);ctx.fillRect(x+2,y+6,4,6);if(u.cargo){ctx.fillStyle={wood:'#b28651',stone:'#bdc8b8',food:'#d6a273',water:'#9bd4d5',seed:'#e4d095'}[u.resource];ctx.fillRect(x+5,y-6,8,8);ctx.font='bold 10px system-ui';ctx.fillStyle='#fff0c4';ctx.textAlign='center';ctx.fillText(u.cargo,x+12,y-9);}if(u.phase==='idle'){circle(x,y-23,3,'#e2c384');}if(selected.has(u.id)&&selected.size===1){ctx.fillStyle='#edf0d9';ctx.font='10px system-ui';ctx.textAlign='center';ctx.fillText(u.name,x,y+26);}}
 if(isPlacement()){const target=placement||hover,x=Math.floor(target.x),y=Math.floor(target.y),err=game.placement(mode,x,y);ctx.fillStyle=err?'#db665866':'#b5daa366';ctx.fillRect(x*T,y*T,2*T,2*T);ctx.strokeStyle=err?'#ec9a81':'#d8eeb6';ctx.lineWidth=2;ctx.strokeRect(x*T,y*T,2*T,2*T);}
 if(pointer&&pointer.kind==='select'&&pointer.moved&&!mode){ctx.fillStyle='#b6e09b25';ctx.strokeStyle='#c8e0a4';ctx.lineWidth=1;const x=pointer.start.x*T,y=pointer.start.y*T,w=(pointer.now.x-pointer.start.x)*T,h=(pointer.now.y-pointer.start.y)*T;ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);}
 rings=rings.filter(r=>now-r.at<900);for(const r of rings){ctx.strokeStyle='#e0eab2';ctx.lineWidth=2;ctx.beginPath();ctx.arc(r.x*T,r.y*T,8+(now-r.at)/60,0,Math.PI*2);ctx.stroke();}
 ctx.restore();
}
$('journey').onclick=()=>{cancelInput();$('dialog').showModal();$('save-status').textContent=unreadableSave?readWarning:readOnlyReason|| (blocked?'Saving is blocked. Export your current camp or reload to recover.':'This is an isolated local continuation. Its exact source opening and outgoing histories are retained. No people or goods transfer into another age.');ui();};$('close').onclick=()=>$('dialog').close();
function download(raw,name){const blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').onclick=()=>{if(unreadableSave)return;try{download(rejected!==null?rejected:envelope(),'hearth-cultivation-camp.json');}catch(e){$('save-status').textContent=e.message;}};
$('source-export').onclick=()=>{if(sourceRaw!==null)download(sourceRaw,'preserved-hearth-opening.json');};
$('archives-export').onclick=()=>download(JSON.stringify(archives),'hearth-cultivation-history.json');
$('import').onclick=()=>$('file').click();$('file').onchange=async e=>{
 const f=e.target.files[0];e.target.value='';if(!f||blocked||!ownsLock)return;let incoming;
 try{if(f.size>MAX_BYTES)throw Error('Camp file exceeds the supported size.');incoming=parseEnvelope(await f.text(),true);}catch(e){$('save-status').textContent=e.message+' No save was changed.';return;}
 if(!confirm('Replace this separate continuation? Its current state will be archived. The original RTS opening save stays unchanged.'))return;
 try{const history=mergedArchives(archives,incoming.archives,[{kind:'camp-state',raw:game.serialize()}],sourceRaw?[{kind:'legacy-source',raw:sourceRaw}]:[]);writeCandidate(incoming.camp,incoming.sourceRaw,history);}catch(e){blocked=true;paused=true;$('save-status').textContent='Import failed to save. The previous live camp is kept. Export it before closing. '+e.message;tell('Import failed to save. Previous camp kept.');ui();return;}
 cancelInput(true,true);tripSession=new HearthFeedback.Session();tripHistoryOpen.clear();messages=[];$('log').replaceChildren();$('toast').textContent='';toastUntil=0;rejected=null;unreadableSave=false;selected.clear();inspect=null;paused=true;$('dialog').close();ui();tell('Camp restored and saved. Resume when ready.');
};
window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue!==lastSave){blocked=true;paused=true;tell('Another tab changed this camp. Reload to continue safely.');ui();}});document.addEventListener('visibilitychange',()=>{last=performance.now();acc=0;if(document.hidden)save();});window.addEventListener('pagehide',()=>{save();if(releaseLock)releaseLock();ownsLock=false;blocked=true;paused=true;});
function frame(now){const dt=Math.min(.1,(now-last)/1000);last=now;if(!paused&&!blocked&&ownsLock&&!document.hidden&&!document.querySelector('dialog[open]')){acc+=dt;while(acc>=.1){if(game.s.version!==7)tripSession.before(game.s);game.tick(.1);if(game.s.version!==7)tripSession.after(game.s);acc-=.1;}}elapsed+=dt;if(elapsed>=2){save();elapsed=0;}if(frameNo++%6===0)ui();draw(now);requestAnimationFrame(frame);}
ui();save();if(unreadableSave)tell(readWarning);else if(readOnlyReason)tell(readOnlyReason);else if(blocked&&rejected!==null)tell('Saved camp could not be loaded. Journey can export the original for recovery.');else if(!blocked&&paused)tell('Separate camp opened paused. Resume the opening or inspect cultivation.');requestAnimationFrame(frame);
})();
