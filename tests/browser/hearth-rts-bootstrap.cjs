// Spark-only controlled storage faults and invalid-input/old-residue recovery.
// Old residue comes from real UI gathering in hearth-rts-roundtrip.cjs.
const assert=require('node:assert/strict'),fs=require('node:fs'),{spawn}=require('node:child_process'),{once}=require('node:events');
const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright'),{Camp,KEY,valid,repairWorkResidue}=require('../../src/hearth-rts/engine.js');
const earned=JSON.parse(fs.readFileSync('artifacts/hearth-rts-earned-camp.json','utf8')),earnedRaw=JSON.stringify(earned);
assert.equal(earned.version,6);
const emptyConstruction={profile:'accepted-opening.physical-construction.v1',sites:[]};assert.deepEqual(earned.construction,emptyConstruction);
const legacyEvidence=JSON.parse(fs.readFileSync('artifacts/hearth-rts-roundtrip-legacy-v3-old-subtraction.json','utf8'));
const bad=legacyEvidence.checkpoint,badRaw=fs.readFileSync('artifacts/hearth-rts-roundtrip-legacy-v3-old-subtraction-download.json','utf8'),repaired=repairWorkResidue(bad);
assert.equal(legacyEvidence.seedProjection,'controlled projection: version 6 to 3 and omit v5 reclaim and v6 construction authority');
assert.equal(legacyEvidence.source.sha256,'4fa74911ae0a0650885355e5e20b4cd2b532c83e4b8bed496a50866a09a63b0a');
assert.deepEqual(JSON.parse(badRaw),bad);assert.equal(bad.version,3);assert.equal(valid(bad),false);assert.ok(repaired&&valid(repaired));assert.equal(repaired.version,3);
const independentlyRepaired=structuredClone(bad);assert.equal(independentlyRepaired.units[0].work,-5.551115123125783e-17);assert.equal(independentlyRepaired.units[0].cargo,2);independentlyRepaired.units[0].work=0;
assert.deepEqual(repaired,independentlyRepaired,'Legacy repair may change only the observed worker residue');
assert.equal(bad.reclaim,undefined);assert.ok(bad.buildings.every(b=>b.retiring===undefined));assert.ok(bad.units.every(u=>u.reclaim===undefined),'The controlled legacy source carries no v5 reclaim authority');
assert.equal(bad.construction,undefined);assert.ok(bad.buildings.every(b=>b.supplyProfile===undefined));assert.ok(bad.units.every(u=>u.supply===undefined&&u.supplyPickup===undefined),'The pinned v3 source carries no v6 construction authority');
assert.deepEqual(bad.storage.payments,[{kind:'recruitment',target:null,sources:[{storeId:'b0',resource:'food',amount:25}],refunded:false}],'The pinned v3 gathering retains the earned camp\'s single recruitment payment');
assert.deepEqual(bad.storage.reservations,{});assert.equal(bad.buildings.filter(b=>b.kind==='outpost').length,1);
const adopted=new Camp(repaired).s;
assert.equal(adopted.version,6);assert.match(adopted.reclaim.sourceIdentity,/^canonical-v3-snapshot-[0-9a-f]{8}$/);
const expectedReclaim={profile:'accepted-opening.outpost-reclaim.v1',sourceIdentity:adopted.reclaim.sourceIdentity,claims:bad.buildings.filter(b=>b.kind==='outpost').map(b=>({id:b.id,buildingId:b.id,unreleased:{wood:60,stone:20,food:0},receipted:{wood:0,stone:0,food:0},assigned:[],basis:{rule:'legacy-state-consistency',origin:'payment-origin-unrecorded',sourceIdentity:adopted.reclaim.sourceIdentity,recipe:'accepted-opening.outpost-reclaim.v1'},origin:[]})),recovered:{wood:0,stone:0,food:0},settled:{wood:0,stone:0,food:0},settledSites:0,closedPayments:1};
assert.deepEqual(adopted.reclaim,expectedReclaim,'Adoption issues full-bill claims without inventing the absent outpost payment origin and closes exactly the one recruitment row');
assert.deepEqual(adopted,{...independentlyRepaired,version:6,storage:{...independentlyRepaired.storage,payments:[]},reclaim:expectedReclaim,construction:emptyConstruction},'Independently checked adoption preserves all gameplay and local custody fields; only the version, new certificates and closed payment history change');
assert.deepEqual(bad,JSON.parse(badRaw),'Candidate preparation never changes the exact legacy source');
const currentBad=JSON.parse(fs.readFileSync('artifacts/hearth-rts-roundtrip-old-subtraction.json','utf8')).checkpoint,currentBadRaw=fs.readFileSync('artifacts/hearth-rts-roundtrip-old-subtraction-download.json','utf8');
assert.deepEqual(JSON.parse(currentBadRaw),currentBad);assert.equal(currentBad.version,6);assert.equal(valid(currentBad),false);assert.equal(repairWorkResidue(currentBad),null);assert.throws(()=>new Camp(currentBad),/compatible RTS/);
const legacyV5={...structuredClone(adopted),version:5};delete legacyV5.construction;
const legacyV5Raw=' \n'+JSON.stringify(legacyV5)+'\n';assert.ok(valid(legacyV5));assert.deepEqual(new Camp(legacyV5).s,adopted,'A controlled certified v5 snapshot adds only the empty construction ledger and schema6');
const legacyV5Bad=structuredClone(legacyV5);legacyV5Bad.units[0].work=-Number.EPSILON;
const malformedConstruction={...structuredClone(earned),construction:{profile:'unsupported-construction-profile',sites:[]}},future={...structuredClone(earned),version:7};
const rejectedSources=[{label:'current-v6-negative',raw:currentBadRaw},{label:'legacy-v5-negative',raw:JSON.stringify(legacyV5Bad)},{label:'current-v6-malformed-construction',raw:JSON.stringify(malformedConstruction)},{label:'future-v7',raw:JSON.stringify(future)}];
for(const {raw} of rejectedSources){const state=JSON.parse(raw);assert.equal(valid(state),false);assert.equal(repairWorkResidue(state),null);assert.throws(()=>new Camp(state),/compatible RTS/);}
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
 {const {context,page,errors}=await open(null);try{const state=JSON.parse(await readRaw(page));assert.ok(valid(state));assert.equal(state.version,6);assert.deepEqual(state.construction,emptyConstruction);assert.equal(await page.locator('#stop').isDisabled(),false);assert.deepEqual(errors,[]);evidence.push({case:'absent-starts-fresh',valid:true,errors});}finally{await context.close();}}
 // Current/old-v5 residue, malformed v6 authority and future7 remain rejected;
 // none may borrow the legacy v3 residue repair or normalize into a fresh camp.
 for(const {label,raw} of rejectedSources){const {context,page,errors}=await open(raw);try{
  assert.equal(await readRaw(page),raw);assert.equal(await page.locator('#pause').innerText(),'Resume');assert.equal(await page.locator('#stop').isDisabled(),true);
  assert.equal(await exportRaw(page,'hearth-rts-'+label+'-boot-rejected'),raw,'Rejected bytes remain available through the real download');
  for(const suffix of ['.before-work-roundoff','.before-v4','.before-v5','.before-v6'])assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY+suffix),null);
  await page.clock.runFor(2500);assert.equal(await readRaw(page),raw);assert.deepEqual(errors,[]);evidence.push({case:label+'-boot-rejected-unrepaired',errors});
 }finally{await context.close();}}
 for(const {label,raw} of rejectedSources){const {context,page,errors}=await open(earnedRaw);try{
  const before=await exportRaw(page,'hearth-rts-'+label+'-import-before');assert.deepEqual(JSON.parse(before),earned);await page.locator('#close').click();
  let confirmations=0;page.on('dialog',dialog=>{confirmations++;dialog.dismiss();});await page.locator('#journey').click();
  assert.doesNotMatch(await page.locator('#save-status').innerText(),/not a compatible RTS camp/);
  await page.locator('#file').setInputFiles({name:label+'.json',mimeType:'application/json',buffer:Buffer.from(raw)});await page.locator('#save-status').filter({hasText:'not a compatible RTS camp'}).waitFor();
  assert.equal(confirmations,0);assert.equal(await readRaw(page),earnedRaw);assert.equal(await exportRaw(page,'hearth-rts-'+label+'-import-after'),before,'Rejected import leaves the previous camp in memory exactly');
  for(const suffix of ['.import-before-work-roundoff','.import-before-v4','.import-before-v5','.outgoing-before-import-v5','.stored-before-import-v5','.import-before-v6','.outgoing-before-import-v6','.stored-before-import-v6','.rejected-before-import-v6'])assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY+suffix),null);
  assert.deepEqual(errors,[]);evidence.push({case:label+'-import-rejected-before-confirmation',errors});
 }finally{await context.close();}}
 // This labeled v5 projection retains the old certificate and exact gameplay;
 // it exercises only the new boundary, without replaying old migrations.
 for(const fault of ['v6-backup','main',null]){
  const v6Key=KEY+'.before-v6',{context,page,errors}=await open(legacyV5Raw,{writeFault:fault==='v6-backup'?v6Key:fault==='main'?KEY:null});
  try{
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),v6Key),fault==='v6-backup'?null:legacyV5Raw);
   for(const suffix of ['.before-v2','.before-v3','.before-v4','.before-v5','.before-work-roundoff'])assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY+suffix),null,'Certified v5 must not repeat an older migration');
   assert.equal(await page.locator('#pause').innerText(),'Resume');assert.equal(await page.locator('#stop').isDisabled(),fault!==null);
   if(fault){assert.equal(await readRaw(page),legacyV5Raw);assert.equal(await exportRaw(page,'hearth-rts-v5-adoption-'+fault),legacyV5Raw);}
   else{assert.deepEqual(JSON.parse(await readRaw(page)),adopted);assert.deepEqual(JSON.parse(await exportRaw(page,'hearth-rts-v5-adoption-saved')),adopted);}
   await page.clock.runFor(2500);assert.equal(await readRaw(page),fault?legacyV5Raw:JSON.stringify(adopted));assert.deepEqual(errors,[]);evidence.push({case:'controlled-v5-adoption-'+(fault||'saved'),errors});
  }finally{await context.close();}
 }
 for(const fault of ['v6-backup','outgoing-backup','main',null]){
  const {context,page,errors}=await open(earnedRaw),v6Key=KEY+'.import-before-v6',outgoingKey=KEY+'.outgoing-before-import-v6';
  try{
   if(fault)await page.evaluate(key=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Controlled v5 adoption write failure','QuotaExceededError');return set.call(this,k,v);};},fault==='v6-backup'?v6Key:fault==='outgoing-backup'?outgoingKey:KEY);
   await page.locator('#journey').click();page.once('dialog',dialog=>dialog.accept());await page.locator('#file').setInputFiles({name:'controlled-certified-v5.json',mimeType:'application/json',buffer:Buffer.from(legacyV5Raw)});
   if(fault){await page.locator('#save-status').filter({hasText:'Import could not be saved'}).waitFor();assert.equal(await readRaw(page),earnedRaw);assert.equal(await exportRaw(page,'hearth-rts-v5-import-'+fault),earnedRaw);}
   else{await page.locator('#dialog').waitFor({state:'hidden'});assert.deepEqual(JSON.parse(await readRaw(page)),adopted);assert.deepEqual(JSON.parse(await exportRaw(page,'hearth-rts-v5-import-saved')),adopted);}
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),v6Key),fault==='v6-backup'?null:legacyV5Raw);
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),outgoingKey),fault===null||fault==='main'?earnedRaw:null);
   for(const suffix of ['.import-before-v3','.import-before-v4','.import-before-v5','.import-before-work-roundoff','.stored-before-import-v6','.rejected-before-import-v6'])assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY+suffix),null);
   await page.locator('#close').click();await page.clock.runFor(2500);assert.equal(await page.locator('#pause').innerText(),'Resume');assert.equal(await readRaw(page),fault?earnedRaw:JSON.stringify(adopted));assert.deepEqual(errors,[]);evidence.push({case:'controlled-v5-import-'+(fault||'saved'),errors});
  }finally{await context.close();}
 }
 // Real UI gathering in the pinned v3 page produced these bytes. The v6, v5,
 // residue and v4 backups, then the main write, must succeed before adoption.
 for(const fault of ['v6-backup','v5-backup','roundoff-backup','version-backup','main',null]){
  const v6Key=KEY+'.before-v6',v5Key=KEY+'.before-v5',backupKey=KEY+'.before-work-roundoff',versionKey=KEY+'.before-v4',writeFault=fault==='v6-backup'?v6Key:fault==='v5-backup'?v5Key:fault==='roundoff-backup'?backupKey:fault==='version-backup'?versionKey:fault==='main'?KEY:null;
  const {context,page,errors}=await open(badRaw,{writeFault});
  try{
   assert.equal(await page.locator('#pause').innerText(),'Resume');
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),v6Key),fault==='v6-backup'?null:badRaw);
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),v5Key),['v6-backup','v5-backup'].includes(fault)?null:badRaw);
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),backupKey),['v6-backup','v5-backup','roundoff-backup'].includes(fault)?null:badRaw);
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),versionKey),['v6-backup','v5-backup','roundoff-backup','version-backup'].includes(fault)?null:badRaw);
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY+'.before-v3'),null,'A v3 save must not take pooled-storage migration');
   if(fault){
    assert.equal(await readRaw(page),badRaw);assert.equal(await page.locator('#stop').isDisabled(),true);assert.match(await page.locator('#toast').innerText(),/could not be loaded/);assert.equal(await exportRaw(page,'hearth-rts-roundoff-'+fault+'-failure'),badRaw,'No failed startup write may expose the repaired candidate as the active export');
   }else{
    assert.deepEqual(JSON.parse(await readRaw(page)),adopted);assert.equal(await page.locator('#stop').isDisabled(),false);assert.deepEqual(JSON.parse(await exportRaw(page,'hearth-rts-roundoff-boot-adopted')),adopted);await page.reload();await page.locator('[data-unit="u0"]').waitFor();assert.deepEqual(JSON.parse(await readRaw(page)),adopted);for(const key of [v6Key,v5Key,backupKey,versionKey])assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),badRaw);
   }
   await page.clock.runFor(2500);assert.equal(await page.locator('#pause').innerText(),'Resume');assert.deepEqual(JSON.parse(await readRaw(page)),fault?bad:adopted);if(fault)assert.equal(await readRaw(page),badRaw);
   assert.deepEqual(errors,[]);evidence.push({case:'roundoff-boot-'+(fault||'saved'),errors});
  }finally{await context.close();}
 }
 for(const fault of ['v6-backup','v5-backup','roundoff-backup','version-backup','outgoing-backup','main',null]){
  const {context,page,errors}=await open(earnedRaw),v6Key=KEY+'.import-before-v6',v5Key=KEY+'.import-before-v5',backupKey=KEY+'.import-before-work-roundoff',versionKey=KEY+'.import-before-v4',outgoingKey=KEY+'.outgoing-before-import-v6';
  try{
   if(fault){await page.locator('#pause').click();await page.evaluate(key=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Controlled imported-repair write failure','QuotaExceededError');return set.call(this,k,v);};},fault==='v6-backup'?v6Key:fault==='v5-backup'?v5Key:fault==='roundoff-backup'?backupKey:fault==='version-backup'?versionKey:fault==='outgoing-backup'?outgoingKey:KEY);}
   await page.locator('#journey').click();page.once('dialog',dialog=>dialog.accept());await page.locator('#file').setInputFiles({name:'old-generated-roundoff.json',mimeType:'application/json',buffer:Buffer.from(badRaw)});
   if(fault){await page.locator('#save-status').filter({hasText:'Import could not be saved'}).waitFor();assert.equal(await readRaw(page),earnedRaw);assert.deepEqual(JSON.parse(await exportRaw(page,'hearth-rts-roundoff-import-'+fault)),earned);assert.equal(await page.locator('#pause').innerText(),'Resume');}
   else{await page.locator('#dialog').waitFor({state:'hidden'});assert.deepEqual(JSON.parse(await readRaw(page)),adopted);assert.deepEqual(JSON.parse(await exportRaw(page,'hearth-rts-roundoff-import-adopted')),adopted);assert.equal(await page.locator('#pause').innerText(),'Resume');}
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),v6Key),fault==='v6-backup'?null:badRaw);
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),v5Key),['v6-backup','v5-backup'].includes(fault)?null:badRaw);
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),backupKey),['v6-backup','v5-backup','roundoff-backup'].includes(fault)?null:badRaw);
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),versionKey),['v6-backup','v5-backup','roundoff-backup','version-backup'].includes(fault)?null:badRaw);
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),outgoingKey),fault===null||fault==='main'?earnedRaw:null,'The outgoing verified live camp is retained before the main write');
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY+'.stored-before-import-v6'),null,'This scenario has identical outgoing live and stored bytes');
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY+'.rejected-before-import-v6'),null,'This scenario has no rejected startup source');
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY+'.import-before-v3'),null);
   await page.locator('#close').click();await page.clock.runFor(2500);assert.deepEqual(JSON.parse(await readRaw(page)),fault?earned:adopted);assert.equal(await page.locator('#pause').innerText(),'Resume');
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
 console.log('PASS startup/read-denial and raw retention: absent versus invalid input; generated legacy-v3 residue repairs into v6 after exact source backups and durable main write; current-v6 and old-v5 negatives, malformed construction and future7 stay rejected; failed boot/import writes preserve original exports');
}finally{if(browser)await browser.close();server.kill();}})().catch(error=>{console.error(error);process.exitCode=1;});
