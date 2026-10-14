(function(){
'use strict';
const {Camp,W,H,KEY,COST,WORK,repairWorkResidue}=HearthRTS,$=id=>document.getElementById(id),canvas=$('world'),ctx=canvas.getContext('2d'),T=32;
let game,paused=false,blocked=false,rejected=null,selected=new Set(),inspect=null,mode=null,pointer=null,hover={x:0,y:0},rings=[],messages=[],lastSave=null,elapsed=0,last=performance.now(),acc=0,frameNo=0;
const camera={x:0,y:0,scale:1},touchContacts=new Set(),nativeKeys=new Map(),cancelledNativeKeys=new Set();
let placement=null,spaceCycle=null,multiTouch=false,suppressTouchClick=false;
const DRAG_PX=4,LONG_PRESS_MS=550;
let originalRaw=null,readCompleted=false,unreadableSave=false,recoveredWork=false;
const readWarning='Saved camp could not be read. No save was changed. Reload when browser storage is available.';
function preserveBeforeWrite(entries,expectedRaw,serialized){
 const writes=new Map();
 for(const [suffix,raw]of entries){if(raw===null)continue;for(let i=0;;i++){const key=KEY+suffix+(i?'.'+i:''),prior=writes.has(key)?writes.get(key):localStorage.getItem(key);if(prior===raw)break;if(prior===null){writes.set(key,raw);break;}}}
 // Resolve every required read first. Backups never replace a distinct source.
 if(localStorage.getItem(KEY)!==expectedRaw)throw Error('Another tab changed the camp');
 for(const[key,raw]of writes){const current=localStorage.getItem(key);if(current!==null&&current!==raw)throw Error('A recovery record changed');if(current===null)localStorage.setItem(key,raw);}
 if(localStorage.getItem(KEY)!==expectedRaw)throw Error('Another tab changed the camp');
 localStorage.setItem(KEY,serialized);
}
function sourceBackups(state,raw,repaired,importing=false){const prefix=importing?'.import-before-':'.before-',entries=[[prefix+'v6',raw]];if(state.version<5)entries.push([prefix+'v5',raw]);if(repaired)entries.push([prefix+'work-roundoff',raw]);if(!importing&&state.version===1)entries.push(['.before-v2',raw]);if(state.version<3)entries.push([prefix+'v3',raw]);if(state.version<4)entries.push([prefix+'v4',raw]);return entries;}
function parseCamp(raw){const state=JSON.parse(raw);if(!state||typeof state!=='object'||Array.isArray(state))throw Error('Not a compatible RTS camp');return state;}
try{
 originalRaw=localStorage.getItem(KEY);readCompleted=true;
 if(originalRaw===null)game=new Camp();
 else{
  const state=parseCamp(originalRaw),repaired=repairWorkResidue(state),incoming=new Camp(repaired||state);
  const serialized=incoming.serialize();preserveBeforeWrite(state.version<6?sourceBackups(state,originalRaw,repaired):[],originalRaw,serialized);
  game=incoming;lastSave=serialized;paused=true;recoveredWork=!!repaired;
 }
}catch(e){rejected=originalRaw;unreadableSave=!readCompleted;game=new Camp();blocked=true;paused=true;}
const resources=['wood','stone','food'];
const icons={wood:'♧',stone:'◆',food:'✦'},names={wood:'Timber stand',stone:'Stone deposit',food:'Foraging patch'};
let tripSession=new HearthFeedback.Session(),toastUntil=performance.now()+7000;
const tripHistoryOpen=new Set();
function tell(text){toastUntil=performance.now()+7000;$('toast').hidden=false;$('toast').textContent=text;messages.unshift(text);messages=messages.slice(0,3);$('log').replaceChildren(...messages.map(v=>{const p=document.createElement('div');p.textContent='› '+v;return p;}));}
function save(){if(blocked)return false;try{const raw=game.serialize();localStorage.setItem(KEY,raw);lastSave=raw;return true;}catch(e){blocked=true;paused=true;tell('Saving stopped. Export this camp before closing.');ui();return false;}}
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
function contextualOrder(p){const {d,b}=hit(p);return dispatch(p,d&&d.amount?'gather':b&&!b.done?'build':b&&b.kind==='workshop'&&game.s.knapping?.workshop===b.id&&!game.s.knapping.done?'craft':'move');}
function commitPlacement(p){
 if(!isPlacement()||!ready())return;
 const kind=mode,result=game.build(kind,Math.floor(p.x),Math.floor(p.y),actors().map(u=>u.id));
 if(result.error){tell(result.error);ui();return;}
 inspect=result.id;clearCommand();feedback(p,game.constructionSite(result.id)?'Site reserved · builders fetch and deliver supplies, then install '+kind+' · carried loads return first':'Prepaid site reserved · builders will construct '+kind+' · carried loads return first');
}
function inspectPoint(p,shift=false,onlyInspect=false){
 const {u,d,b}=hit(p);
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
 if($('dialog').open||textControl(e.target)||linkControl(e.target))return;
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
 if(!cycle.consumed&&!document.hidden&&!$('dialog').open&&!textControl(e.target)&&!buttonControl(e.target))togglePause();else ui();observeInput();
},{capture:true});
document.addEventListener('focusin',e=>{if(e.target!==canvas){const hadPointer=!!pointer;spaceCycle=null;releasePointer();for(const [code,entry] of nativeKeys)if(entry.target!==buttonControl(e.target)){cancelledNativeKeys.add(code);nativeKeys.delete(code);}if(hadPointer||$('dialog').open)clearCommand();observeInput();}});
window.addEventListener('blur',()=>{cancelInput(true,true);ui();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelInput(true,true);ui();}});
window.addEventListener('resize',()=>{cancelInput(true,true);ui();});
function goods(map){return resources.filter(r=>map?.[r]>0).map(r=>Math.round(map[r]*100)/100+' '+r).join(' · ')||'none';}
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
 const stores=game.stores(),row=stores.find(s=>s.id===b.id);$('store-title').textContent=row.name;for(const r of resources){$('local-'+r).textContent=row.stock[r];$('free-'+r).textContent=row.available[r];$('reserved-'+r).textContent=row.reserved[r];}$('store-incoming').textContent='Incoming: '+goods(row.incoming);const destinations=stores.filter(s=>s.id!==b.id),key=destinations.map(s=>s.id).join(',');if($('store-destination').dataset.options!==key){const current=$('store-destination').value;$('store-destination').replaceChildren(...destinations.map(s=>{const option=document.createElement('option');option.value=s.id;option.textContent=s.name;return option;}));if(destinations.some(s=>s.id===current))$('store-destination').value=current;$('store-destination').dataset.options=key;}
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
 if(box.dataset.craft!==b.id){box.replaceChildren();box.dataset.site='';box.dataset.craft=b.id;const eyebrow=document.createElement('span');eyebrow.className='eyebrow';eyebrow.textContent='CRAFT WORKSHOP';const title=document.createElement('h3');title.textContent='Useful edges';const text=document.createElement('p');text.textContent='Knapped tools use 25% less extraction time per item (33.3% higher extraction rate). Hauling and five-item loads are unchanged, so total delivery gains depend on travel.';const funding=document.createElement('p');funding.id='craft-funding';const status=document.createElement('p');status.id='craft-status';const progress=document.createElement('progress');progress.id='craft-progress';progress.max=12;const button=document.createElement('button');button.id='craft-knapping';button.onclick=()=>{if(blocked)return;const err=game.beginKnapping(b.id,[...selected]);tell(err||'Knapping assigned · workers bring home any carried load first');save();ui();};box.append(eyebrow,title,text,funding,status,progress,button);}
 const p=game.s.knapping,local=p?.workshop===b.id,finished=game.s.tools,workers=game.s.units.filter(u=>(u.next||u.order).kind==='craft'&&(u.next||u.order).target===b.id).length;
 $('craft-progress').value=local?p.work:finished?12:0;$('craft-progress').hidden=!p&&!finished;$('craft-status').textContent=finished?'Toolset complete · 0.60 → 0.45 seconds per item':local?'Materials reserved · '+p.work.toFixed(1)+' / 12 worker-seconds · '+workers+' assigned':'4 wood + 8 stone · 12 worker-seconds';
 $('craft-funding').textContent=finished?'Materials already used for this completed toolset.':local?'This project’s materials are already reserved.':fundingText(game.knappingFunding(b.id));
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
function progressionUI(){
 const step=HearthFeedback.nextStep(game,tripSession);
 $('progress-title').textContent=step.title;$('progress-detail').textContent=step.detail;
 $('progress-inspect').textContent=step.actionLabel;$('progress-inspect').disabled=!step.targetId;
 $('camp-warning').hidden=!blocked&&!unreadableSave;
 $('camp-warning').textContent=unreadableSave?readWarning:blocked?'Progress is paused because saving or recovery needs attention. Open Journey to export your camp before reloading.':'';
 $('toast').hidden=!blocked&&!unreadableSave&&performance.now()>toastUntil;
}
$('progress-inspect').onclick=()=>{
 const step=HearthFeedback.nextStep(game,tripSession);if(!step.targetId)return;
 cancelInput();inspect=step.targetId;ui();$('inspect').scrollIntoView({block:'nearest'});$('inspect').focus({preventScroll:true});
};
function tripUI(box,d){
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
function ui(){tripSession.notice(game.s);const s=game.s,economy=game.economy();for(const id of selected)if(!s.units.some(u=>u.id===id))selected.delete(id);$('economy').innerHTML=resources.map(r=>'<div data-resource="'+r+'" class="resource" title="Available across all stores; jobs use their named source"><small>'+r.toUpperCase()+' FREE</small>'+SettlementArt.icon(r)+Math.floor(economy.available[r])+'</div>').join('');$('economy-flow').textContent='In stores: '+goods(economy.stored)+' | Reserved for pickup: '+goods(economy.reserved)+' | Carried: '+goods(economy.inTransit)+' | Onsite supplies: '+goods(economy.constructionStaged)+' | Gathered: '+goods(economy.produced)+' | Moved between stores: '+goods(economy.transferred)+' | Recovered: '+goods(economy.recovered);$('idle').innerHTML='Idle <b>'+s.units.filter(u=>u.phase==='idle').length+'</b>';$('pause').textContent=paused?'Resume':'Pause';$('paused').hidden=!paused;$('time').textContent=String(Math.floor(s.time/60)).padStart(2,'0')+':'+String(Math.floor(s.time%60)).padStart(2,'0');
 const goals=[[s.depleted>0,'Exhaust a nearby deposit'],[s.buildings.some(b=>b.kind==='outpost'&&b.done&&!b.retiring&&b.x>20),'Build an outpost east of the river'],[s.buildings.some(b=>b.kind==='workshop'&&b.done),'Finish a workshop']];$('goals').innerHTML=goals.map(([done,text])=>'<li class="'+(done?'done':'')+'">'+text+'</li>').join('');$('opening-count').textContent=goals.filter(([done])=>done).length+' / 3';progressionUI();
 if(!$('selection-title')){const label=document.createElement('div');label.className='selection-title';const count=document.createElement('span');count.id='selection-title';label.append(count);const all=document.createElement('button');all.textContent='Select all';all.id='select-all';all.onclick=()=>{selected=new Set(game.s.units.map(u=>u.id));ui();};label.append(all);$('selection').append(label);}
 $('selection-title').textContent=selected.size+' SELECTED / '+s.units.length+' VILLAGERS';
 for(const old of $('selection').querySelectorAll('[data-unit]'))if(!s.units.some(u=>u.id===old.dataset.unit))old.remove();
 for(const u of s.units){let b=$('selection').querySelector('[data-unit="'+u.id+'"]');if(!b){b=document.createElement('button');b.dataset.unit=u.id;const portrait=document.createElement('span');portrait.className='portrait';portrait.textContent='♟';const name=document.createElement('span');name.className='unit-name';const status=document.createElement('small');b.append(portrait,name,status);b.onclick=e=>{if(!e.shiftKey)selected.clear();selected.has(u.id)&&e.shiftKey?selected.delete(u.id):selected.add(u.id);inspect=u.id;ui();};$('selection').append(b);}b.className='unit-card '+(u.phase==='idle'?'idle':'');b.setAttribute('aria-pressed',String(selected.has(u.id)));b.querySelector('.unit-name').textContent=u.name;b.querySelector('small').textContent=unitStatus(u);b.title=unitDetail(u);}
 $('stop').disabled=blocked;$('train').disabled=blocked||s.units.length>=8;$('export').disabled=unreadableSave;inspectUI();commandUI();}
// All map art is drawn here: layered terrain, finite deposit clusters, buildings and villagers.
const noise=(x,y)=>{const v=Math.sin(x*127.1+y*311.7)*43758.5453;return v-Math.floor(v);};
function poly(points,color,stroke){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();}}
function circle(x,y,r,color){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
function drawSiteSupply(b,x,y,z){const c=game.constructionSite(b.id);if(!c)return;
 // Onsite piles represent delivered goods, separately from installation work.
 const logs=Math.ceil(c.staged.wood/5),stones=Math.ceil(c.staged.stone/5);
 for(let i=0;i<logs;i++){const px=x+10+(i%4)*11,py=y+z-13-Math.floor(i/4)*7;ctx.fillStyle='#ad7c49';ctx.fillRect(px,py,9,5);circle(px+1,py+2.5,2.5,'#d7b37a');}
 for(let i=0;i<stones;i++){const px=x+13+(i%4)*10,py=y+13+Math.floor(i/4)*9;poly([[px-4,py+3],[px-2,py-4],[px+3,py-5],[px+5,py+3]],'#bdc5af','#637369');}
 const total=resources.reduce((n,r)=>n+c.staged[r],0),bill=Object.values(b.cost).reduce((a,n)=>a+n,0);ctx.fillStyle='#243a31';ctx.fillRect(x,y-10,z,4);ctx.fillStyle=c.state==='cancelling'?'#e1a978':'#b6d49a';ctx.fillRect(x,y-10,z*total/bill,4);ctx.font='bold 9px system-ui';ctx.textAlign='center';ctx.fillStyle='#5a4e46';ctx.fillText(c.state==='cancelling'?'RETURN SUPPLIES':total+'/'+bill+' ONSITE',x+z/2,y-15);
}
function draw(now){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);const a=SettlementArt.painter(ctx);a.rect(0,0,canvas.width,canvas.height,0,'#d9dce8');ctx.save();ctx.translate(camera.x,camera.y);ctx.scale(camera.scale,camera.scale);const seen=new Set(game.s.seen),visible=(x,y)=>seen.has(y*W+x)&&x>=0&&x<W&&y>=0&&y<H;
 // Rounded banks and continuous land preserve the original cell coordinate system.
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(!visible(x,y))continue;const water=game.water(x,y),corners=[[[-1,0],[0,-1]],[[1,0],[0,-1]],[[1,0],[0,1]],[[-1,0],[0,1]]].map(pair=>pair.every(([dx,dy])=>!visible(x+dx,y+dy))?12:0);ctx.beginPath();ctx.roundRect(x*T,y*T,T+1,T+1,corners);ctx.fillStyle=water?'#47bbd9':noise(x,y)>.5?'#d2e488':'#d0e286';ctx.fill();if(water)a.line([[x*T+8,y*T+15],[x*T+21,y*T+15]],'#b9eef0',2);else if(noise(x,y)>.82){a.ellipse(x*T+8,y*T+10,2,1,'#afc865');a.ellipse(x*T+13,y*T+8,2,1,'#afc865');}}
 ctx.save();ctx.beginPath();for(const cell of seen){const x=cell%W,y=Math.floor(cell/W);ctx.rect(x*T,y*T,T,T);}ctx.clip();ctx.strokeStyle='#f3db99';ctx.lineWidth=24;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(10*T,13*T);ctx.bezierCurveTo(15*T,15*T,18*T,12*T,26*T,13*T);ctx.stroke();ctx.restore();
 for(const d of game.s.deposits){if(!seen.has(d.y*W+d.x))continue;const x=(d.x+.5)*T,y=(d.y+.5)*T;
  if(d.amount===0){a.ellipse(x,y,12,6,'#b9c47d');a.rect(x-5,y-6,10,8,3,'#bc915d');}
  else if(d.kind==='wood'){a.tree(x-12,y+2,.62,0);a.tree(x+14,y,.7,1);a.tree(x,y-6,.85,0);}else if(d.kind==='stone'){a.rock(x-8,y,.9);a.rock(x+14,y+4,.58);}else a.bush(x,y,1,true);
  a.badge(d.amount?d.amount+' '+(d.kind==='wood'?'W':d.kind==='stone'?'S':'F'):'EMPTY',x,y+33);
  if(d.amount){a.rect(x-23,y+45,46,3,1.5,'#a2bc70');a.rect(x-23,y+45,46*d.amount/d.initial,3,1.5,{wood:'#298f66',stone:'#ad7761',food:'#a670ba'}[d.kind]);}
 }
 for(const b of game.s.buildings){const x=b.x*T,y=b.y*T,z=game.size(b)*T;
  if(!b.done){a.rect(x+2,y+2,z-4,z-4,9,'#eccd8588');ctx.strokeStyle='#ac8149';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.strokeRect(x+3,y+3,z-6,z-6);ctx.setLineDash([]);a.line([[x+6,y+z-6],[x+6,y+8],[x+z-6,y+8],[x+z-6,y+z-6]],'#b98b53',4);a.rect(x,y+z+5,z,5,2,'#ddc492');a.rect(x,y+z+5,z*b.work/WORK[b.kind],5,2,'#9b72c7');drawSiteSupply(b,x,y,z);}
  else if(b.kind==='hearth'){a.ellipse(x+z/2,y+z/2,z*.7,z*.42,'#e7cc80');a.tent(x+z*.31,y+z*.45,.85,true);a.tent(x+z*.76,y+z*.44,.7);a.fire(x+z*.5,y+z*.81,.75,paused||matchMedia('(prefers-reduced-motion: reduce)').matches?0:now/1000);a.jar(x+z*.03,y+z*.85,.7,'#8167b5',b.stock?.food||0);}
  else a.house(x+z*.5,y+z*.62,z/65,b.kind);
  a.badge(b.kind.toUpperCase()+(b.kind==='workshop'&&game.s.tools?' ✓':''),x+z/2,y+z+24);
  if(b.kind==='workshop'&&b.done&&game.s.knapping?.workshop===b.id&&!game.s.tools){a.rect(x,y-18,z,5,2,'#e7c78b');a.rect(x,y-18,z*game.s.knapping.work/12,5,2,'#9b72c7');}
 }
 // Selection paths make hauling and command destinations legible.
 for(const u of game.s.units){if(selected.has(u.id)&&u.path.length){ctx.strokeStyle='#7956b5aa';ctx.lineWidth=1;ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo((u.x+.5)*T,(u.y+.5)*T);for(const p of u.path)ctx.lineTo((p.x+.5)*T,(p.y+.5)*T);ctx.stroke();ctx.setLineDash([]);}}
 for(const u of game.s.units){const x=(u.x+.5)*T,y=(u.y+.5)*T;if(selected.has(u.id)){ctx.strokeStyle='#8057b8';ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(x,y+4,13,7,0,0,Math.PI*2);ctx.stroke();}a.person(x,y+9,.9,u.id,!paused&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&u.phase!=='idle',now/1000);if(u.cargo){a.rect(x+6,y-9,9,10,3,{wood:'#c78a4c',stone:'#ad7f70',food:'#f0a151',water:'#41bed9',seed:'#dec36c'}[u.resource]);a.badge(String(u.cargo),x+17,y-17);}if(u.phase==='idle')circle(x,y-29,3,'#e5af45');if(selected.has(u.id)&&selected.size===1)a.badge(u.name,x,y+29);}

 if(isPlacement()){const target=placement||hover,x=Math.floor(target.x),y=Math.floor(target.y),err=game.placement(mode,x,y);ctx.fillStyle=err?'#db665866':'#b5daa366';ctx.fillRect(x*T,y*T,2*T,2*T);ctx.strokeStyle=err?'#ec9a81':'#d8eeb6';ctx.lineWidth=2;ctx.strokeRect(x*T,y*T,2*T,2*T);}
 if(pointer&&pointer.kind==='select'&&pointer.moved&&!mode){ctx.fillStyle='#b6e09b25';ctx.strokeStyle='#c8e0a4';ctx.lineWidth=1;const x=pointer.start.x*T,y=pointer.start.y*T,w=(pointer.now.x-pointer.start.x)*T,h=(pointer.now.y-pointer.start.y)*T;ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);}
 rings=rings.filter(r=>now-r.at<900);for(const r of rings){ctx.strokeStyle='#8057b8';ctx.lineWidth=2;ctx.beginPath();ctx.arc(r.x*T,r.y*T,8+(now-r.at)/60,0,Math.PI*2);ctx.stroke();}
 ctx.restore();
}
$('journey').onclick=()=>{cancelInput();$('dialog').showModal();$('save-status').textContent=unreadableSave?readWarning:blocked?'Saving is blocked. Export your current camp or reload to recover.':game.reclaimIssue?'Legacy camp remains playable and exportable. Optional outpost recovery unavailable: '+game.reclaimIssue+'.':'This RTS camp has a separate save slot. Your previous Hearth remains intact. Original imports and outgoing live camps are retained before replacement.';ui();};$('close').onclick=()=>$('dialog').close();
$('export').onclick=()=>{if(unreadableSave)return;const blob=new Blob([rejected!==null?rejected:game.serialize()],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='hearth-rts-camp.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('import').onclick=()=>$('file').click();$('file').onchange=async e=>{
 const f=e.target.files[0];e.target.value='';if(!f)return;let raw,state,incoming,repaired;
 try{if(f.size>2e6)throw Error();raw=await f.text();state=parseCamp(raw);repaired=repairWorkResidue(state);incoming=new Camp(repaired||state);}catch(e){$('save-status').textContent='This is not a compatible RTS camp. No save was changed.';return;}
 if(!confirm('Replace only this RTS camp? Previous Hearth saves stay unchanged.'))return;
 const serialized=incoming.serialize();
 try{const prior=localStorage.getItem(KEY),outgoing=rejected===null&&!unreadableSave?game.serialize():null,entries=sourceBackups(state,raw,repaired,true);if(outgoing!==null){if(!HearthRTS.valid(parseCamp(outgoing)))throw Error('The outgoing camp could not be verified');entries.push(['.outgoing-before-import-v6',outgoing]);}if(prior!==null&&prior!==outgoing)entries.push(['.stored-before-import-v6',prior]);if(rejected!==null&&rejected!==prior&&rejected!==outgoing)entries.push(['.rejected-before-import-v6',rejected]);preserveBeforeWrite(entries,prior,serialized);}catch(e){blocked=true;paused=true;$('save-status').textContent=unreadableSave?'Import could not be saved. The original saved camp is still unavailable. Reload when storage access is restored; keep the import file to retry.':'Import could not be saved. Your previous camp remains open and its saved copy is unchanged. Export it before closing; keep the import file to retry.';tell('Import failed to save. Previous camp kept.');ui();return;}
 cancelInput(true,true);game=incoming;tripSession=new HearthFeedback.Session();tripHistoryOpen.clear();messages=[];$('log').replaceChildren();$('toast').textContent='';toastUntil=0;lastSave=serialized;blocked=false;rejected=null;unreadableSave=false;selected.clear();inspect=null;paused=true;$('dialog').close();ui();tell(repaired?'RTS camp restored and saved · work-rounding residue repaired; exact original kept':'RTS camp restored and saved');
};
window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue!==lastSave){blocked=true;paused=true;tell('Another tab changed this camp. Reload to continue safely.');ui();}});document.addEventListener('visibilitychange',()=>{last=performance.now();acc=0;if(document.hidden)save();});window.addEventListener('pagehide',save);
function frame(now){const dt=Math.min(.1,(now-last)/1000);last=now;if(!paused&&!blocked&&!document.hidden&&!$('dialog').open){acc+=dt;while(acc>=.1){tripSession.before(game.s);game.tick(.1);tripSession.after(game.s);acc-=.1;}}elapsed+=dt;if(elapsed>=2){save();elapsed=0;}if(frameNo++%6===0)ui();draw(now);requestAnimationFrame(frame);}
ui();save();if(unreadableSave)tell(readWarning);else if(blocked&&rejected!==null)tell('Saved camp could not be loaded. Journey can export the original for recovery.');else if(!blocked&&paused)tell(recoveredWork?'Camp recovered and paused · work-rounding residue repaired; exact original kept.':'Camp restored and paused. Resume when you are ready.');requestAnimationFrame(frame);
})();
