// Spark-only controlled storage faults and invalid-input/old-residue recovery.
// Old residue comes from real UI gathering in hearth-rts-roundtrip.cjs.
const assert=require('node:assert/strict'),fs=require('node:fs'),{spawn}=require('node:child_process'),{once}=require('node:events');
const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright'),{KEY,valid,repairWorkResidue}=require('../../src/hearth-rts/engine.js');
const earned=JSON.parse(fs.readFileSync('artifacts/hearth-rts-earned-camp.json','utf8')),earnedRaw=JSON.stringify(earned);
const bad=JSON.parse(fs.readFileSync('artifacts/hearth-rts-roundtrip-old-subtraction.json','utf8')).checkpoint,badRaw=JSON.stringify(bad,null,2)+'\n',repaired=repairWorkResidue(bad);
assert.ok(repaired&&valid(repaired));assert.equal(valid(bad),false);
const url='http://127.0.0.1:8080/hearth-rts.html';fs.mkdirSync('artifacts',{recursive:true});
(async()=>{const server=spawn(process.execPath,['scripts/serve.cjs'],{stdio:['ignore','pipe','inherit']});let browser;
try{
 await once(server.stdout,'data');browser=await playwright.chromium.launch({headless:true,chromiumSandbox:true});
 const open=async(seed,{readFault=null,writeFault=null}={})=>{
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  await context.addInitScript(({key,seed,readFault,writeFault})=>{
   const nativeStore=window.localStorage,nativeGet=Storage.prototype.getItem,nativeSet=Storage.prototype.setItem;
   if(seed!==null&&nativeGet.call(nativeStore,key)===null)nativeSet.call(nativeStore,key,seed);
   window.__storedOriginal=()=>nativeGet.call(nativeStore,key);
   if(readFault==='method')Storage.prototype.getItem=function(k){if(k===key)throw new DOMException('Controlled persistent KEY-read denial','SecurityError');return nativeGet.call(this,k);};
   if(readFault==='getter')Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('Controlled storage-object access denial','SecurityError');}});
   if(writeFault)Storage.prototype.setItem=function(k,v){if(k===writeFault)throw new DOMException('Controlled backup/main write denial','QuotaExceededError');return nativeSet.call(this,k,v);};
  },{key:KEY,seed,readFault,writeFault});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.goto(url);await page.locator('[data-unit="u0"]').waitFor();await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
  return{context,page,errors};
 };
 const readRaw=page=>page.evaluate(()=>window.__storedOriginal());
 const exportRaw=async(page,name)=>{if(!await page.locator('#dialog').evaluate(node=>node.open))await page.locator('#journey').click();const event=page.waitForEvent('download');await page.locator('#export').click();const download=await event,path='artifacts/'+name+'.json';await download.saveAs(path);return fs.readFileSync(path,'utf8');};
 const evidence=[];
 for(const readFault of ['method','getter']){
  const {context,page,errors}=await open(earnedRaw,{readFault});
  try{
   assert.equal(await page.locator('#pause').innerText(),'Resume');assert.equal(await page.locator('#stop').isDisabled(),true);assert.match(await page.locator('#toast').innerText(),/could not be read|unavailable/i);
   await page.locator('#journey').click();assert.equal(await page.locator('#dialog').evaluate(node=>node.open),true);assert.equal(await page.locator('#export').isDisabled(),true,'Cannot promise an export of bytes the browser could not read');assert.match(await page.locator('#save-status').innerText(),/could not be read|unavailable/i);
   await page.locator('#close').click();assert.equal(await page.locator('#dialog').evaluate(node=>node.open),false);await page.clock.runFor(2500);assert.equal(await readRaw(page),earnedRaw);assert.deepEqual(errors,[]);
   await page.screenshot({path:'artifacts/hearth-rts-read-denied-'+readFault+'.png',fullPage:true});evidence.push({case:'read-denied-'+readFault,bytesPreserved:true,errors});
  }finally{await context.close();}
 }
 for(const raw of ['null','false','0','""','']){
  const {context,page,errors}=await open(raw);
  try{
   assert.equal(await readRaw(page),raw);assert.equal(await page.locator('#stop').isDisabled(),true);assert.equal(await page.locator('#pause').innerText(),'Resume');
   const label=raw===''?'empty-bytes':raw==='""'?'json-empty-string':raw;
   assert.equal(await exportRaw(page,'hearth-rts-invalid-'+label),raw,'Every present rejected payload exports byte-for-byte, including empty bytes');
   await page.clock.runFor(2500);assert.equal(await readRaw(page),raw);assert.deepEqual(errors,[]);evidence.push({case:'present-invalid-'+label,bytesPreserved:true,errors});
  }finally{await context.close();}
 }
 {const {context,page,errors}=await open(null);try{const state=JSON.parse(await readRaw(page));assert.ok(valid(state));assert.equal(await page.locator('#stop').isDisabled(),false);assert.deepEqual(errors,[]);evidence.push({case:'absent-starts-fresh',valid:true,errors});}finally{await context.close();}}
 // The exact generated old residue repairs only after retaining its source bytes.
 for(const fault of ['backup','main',null]){
  const backupKey=KEY+'.before-work-roundoff',writeFault=fault==='backup'?backupKey:fault==='main'?KEY:null;
  const {context,page,errors}=await open(badRaw,{writeFault});
  try{
   assert.equal(await page.locator('#pause').innerText(),'Resume');
   if(fault==='backup'){
    assert.equal(await readRaw(page),badRaw);assert.equal(await page.locator('#stop').isDisabled(),true);assert.equal(await exportRaw(page,'hearth-rts-roundoff-backup-failure'),badRaw);
   }else{
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),backupKey),badRaw);
    if(fault==='main'){assert.equal(await readRaw(page),badRaw);assert.equal(await page.locator('#stop').isDisabled(),true);assert.match(await page.locator('#toast').innerText(),/Saving stopped/);assert.deepEqual(JSON.parse(await exportRaw(page,'hearth-rts-roundoff-main-failure')),repaired);}
    else{assert.deepEqual(JSON.parse(await readRaw(page)),repaired);assert.equal(await page.locator('#stop').isDisabled(),false);await page.reload();await page.locator('[data-unit="u0"]').waitFor();assert.deepEqual(JSON.parse(await readRaw(page)),repaired);assert.equal(await page.evaluate(key=>localStorage.getItem(key),backupKey),badRaw);}
   }
   assert.deepEqual(errors,[]);evidence.push({case:'roundoff-boot-'+(fault||'saved'),errors});
  }finally{await context.close();}
 }
 for(const fault of ['backup','main',null]){
  const {context,page,errors}=await open(earnedRaw),backupKey=KEY+'.import-before-work-roundoff';
  try{
   if(fault){await page.locator('#pause').click();await page.evaluate(key=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Controlled imported-repair write failure','QuotaExceededError');return set.call(this,k,v);};},fault==='backup'?backupKey:KEY);}
   await page.locator('#journey').click();page.once('dialog',dialog=>dialog.accept());await page.locator('#file').setInputFiles({name:'old-generated-roundoff.json',mimeType:'application/json',buffer:Buffer.from(badRaw)});
   if(fault){await page.locator('#save-status').filter({hasText:'Import could not be saved'}).waitFor();assert.equal(await readRaw(page),earnedRaw);assert.deepEqual(JSON.parse(await exportRaw(page,'hearth-rts-roundoff-import-'+fault)),earned);assert.equal(await page.locator('#pause').innerText(),'Resume');}
   else{await page.locator('#dialog').waitFor({state:'hidden'});assert.deepEqual(JSON.parse(await readRaw(page)),repaired);assert.equal(await page.evaluate(key=>localStorage.getItem(key),backupKey),badRaw);assert.equal(await page.locator('#pause').innerText(),'Resume');}
   assert.deepEqual(errors,[]);evidence.push({case:'roundoff-import-'+(fault||'saved'),errors});
  }finally{await context.close();}
 }
 // A falsy JSON import cannot become an implicit fresh-camp reset.
 {const {context,page,errors}=await open(earnedRaw);try{
  let confirmations=0;page.on('dialog',dialog=>{confirmations++;dialog.dismiss();});
  for(const raw of ['null','false','0','""']){
   await page.locator('#journey').click();assert.doesNotMatch(await page.locator('#save-status').innerText(),/not a compatible RTS camp/,'Each upload needs a fresh nonmatching status before waiting for its rejection');
   await page.locator('#file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(raw)});await page.locator('#save-status').filter({hasText:'not a compatible RTS camp'}).waitFor();assert.equal(await readRaw(page),earnedRaw);await page.locator('#close').click();
  }
 assert.equal(confirmations,0);assert.deepEqual(errors,[]);evidence.push({case:'invalid-imports-rejected-before-confirmation',errors});
 }finally{await context.close();}}
 // Actual Tab navigation to the two outside-dialog links must keep native Space
 // handling; those semantic controls cannot arm a map-owned pause gesture.
 {const {context,page,errors}=await open(earnedRaw);try{
  await page.evaluate(()=>{window.__nativeLinkKeys=[];for(const type of ['keydown','keyup'])document.addEventListener(type,event=>{if(event.code==='Space')window.__nativeLinkKeys.push({type,repeat:event.repeat,target:event.target.tagName,href:event.target.getAttribute('href'),defaultPrevented:event.defaultPrevented,spaceOwned:document.getElementById('world').dataset.spaceOwned});});});
  const tabTo=async selector=>{for(let i=0;i<64;i++){if(await page.locator(selector).evaluate(node=>node===document.activeElement))return;await page.keyboard.press('Tab');}throw Error('Tab navigation did not reach '+selector);};
  for(const selector of ['a.brand','footer a'])for(const paused of [true,false]){
   const label=paused?'Resume':'Pause';if(await page.locator('#pause').innerText()!==label)await page.locator('#pause').click();await tabTo(selector);
   await page.keyboard.down('Space');assert.equal(await page.locator('#pause').innerText(),label);assert.equal(await page.locator('#world').getAttribute('data-space-owned'),'false');
   await page.keyboard.down('Space');assert.equal(await page.locator('#pause').innerText(),label);await page.screenshot({path:'artifacts/hearth-rts-native-space-'+(selector==='a.brand'?'brand':'footer')+'-'+(paused?'paused':'running')+'.png',fullPage:true});
   await page.keyboard.up('Space');assert.equal(await page.locator('#pause').innerText(),label);assert.equal(page.url(),url,'Space does not synthesize link activation');
  }
  const events=await page.evaluate(()=>window.__nativeLinkKeys);assert.equal(events.length,12);assert.ok(events.every(event=>event.target==='A'&&!event.defaultPrevented&&event.spaceOwned==='false'));assert.deepEqual(errors,[]);
  fs.writeFileSync('artifacts/hearth-rts-native-link-space.json',JSON.stringify({events,errors},null,2));evidence.push({case:'native-link-space-keeps-pause-state',events:events.length,errors});
  await page.keyboard.press('Enter');await page.waitForURL('**/hearth.html');assert.deepEqual(errors,[],'Native Enter navigation remains available');
 }finally{await context.close();}}
 fs.writeFileSync('artifacts/hearth-rts-bootstrap-report.json',JSON.stringify(evidence,null,2));
 console.log('PASS startup/read-denial and raw retention: absent versus invalid input; exact old-residue backup/repair; failed boot/import writes preserve originals');
}finally{if(browser)await browser.close();server.kill();}})().catch(error=>{console.error(error);process.exitCode=1;});
