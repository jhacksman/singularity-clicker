// Behavioral regressions from the independent 2026-10-09 art review.
// Uses ordinary controls and observes the actual painted badge bounds, not renderer formulas.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/m6mini/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(process.env.ART_REVIEW_DIST||'dist'),out=path.resolve(process.env.ART_REVIEW_OUT||'../evidence/review-fixes');fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const luminance=hex=>{const rgb=hex.match(/[a-f\d]{2}/gi).slice(0,3).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
(async()=>{
 const server=http.createServer((req,res)=>{const file=path.join(root,path.basename(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(file)||!file.endsWith('.html')){res.writeHead(404);res.end();return;}res.setHeader('Content-Type','text/html');res.end(fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true}),results=[],errors=[];let failed;
 const open=async(name,width=1440)=>{const c=await browser.newContext({viewport:{width,height:844},hasTouch:true,reducedMotion:'reduce'});await c.addInitScript(()=>{
  const C=CanvasRenderingContext2D.prototype,fillText=C.fillText,roundRect=C.roundRect,setTransform=C.setTransform,clearRect=C.clearRect,fill=C.fill,stroke=C.stroke;
  window.__paintedText={};
  const reset=ctx=>{window.__paintedText[ctx.canvas.id]=[];ctx.__paintSeq=0;};
  C.fill=function(...a){this.__paintSeq=(this.__paintSeq||0)+1;return fill.apply(this,a);};
  C.stroke=function(...a){this.__paintSeq=(this.__paintSeq||0)+1;return stroke.apply(this,a);};
  C.setTransform=function(...a){if(this.canvas.id==='farm')reset(this);return setTransform.apply(this,a);};
  C.clearRect=function(...a){reset(this);return clearRect.apply(this,a);};
  C.roundRect=function(x,y,w,h,...a){const t=this.getTransform(),p=t.transformPoint({x,y}),q=t.transformPoint({x:x+w,y:y+h});this.__lastBadge={x:p.x,y:p.y,width:q.x-p.x,height:q.y-p.y};return roundRect.call(this,x,y,w,h,...a);};
  C.fillText=function(text,x,y,...a){const p=this.getTransform().transformPoint({x,y});this.__paintSeq=(this.__paintSeq||0)+1;(window.__paintedText[this.canvas.id]??=[]).push({text:String(text),x:p.x,y:p.y,color:this.fillStyle,bounds:this.__lastBadge,sequence:this.__paintSeq});return fillText.call(this,text,x,y,...a);};
 });const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port+'/'+name+'.html');return{c,p};};
 try{
  const {c,p}=await open('agriculture',390);await p.locator('#begin').click();await p.locator('#pause').click();
  for(let i=0;i<3;i++){await p.locator('[data-field="'+i+'"]').click();await p.locator('#crop').selectOption('grain');await p.locator('#field-more').click();}
  await p.evaluate(()=>{for(let n=0;n<100;n++)document.querySelector('#step').click();});
  const raw=await p.evaluate(()=>localStorage.getItem('singularity-clicker.agriculture.v1'));fs.writeFileSync(path.join(out,'agriculture-ripe-earned.json'),raw);assert.ok(JSON.parse(raw).fields.filter(f=>f.phase==='ripe').length>=2,'Adjacent ripe fields earned through controls');
  for(const width of [320,390,600,768,1440]){
   await p.setViewportSize({width,height:844});await p.locator('#farm').scrollIntoViewIfNeeded();await p.waitForTimeout(80);
   const labels=await p.evaluate(()=>window.__paintedText.farm.filter(t=>/^[1-6](?: ✓| · READY)?$/.test(t.text)));assert.equal(labels.length,6);
   // Labels must be the final text painted: later field art cannot cover them.
   assert.deepEqual(await p.evaluate(()=>window.__paintedText.farm.slice(-6).map(t=>t.text)),labels.map(t=>t.text));
   for(let i=1;i<labels.length;i++)assert.equal(labels[i].sequence-labels[i-1].sequence,2,'Only badge background/text may follow the preceding badge');
   assert.equal(await p.evaluate(()=>document.querySelector('#farm').getContext('2d').__paintSeq),labels.at(-1).sequence,'No scene artwork paints over the final badge');
   for(const label of labels){const id=Number(label.text[0]);for(const edge of ['left','right','top','bottom']){
    await p.locator('[data-field="'+(id%6)+'"]').evaluate(b=>b.click());await p.locator('#farm').scrollIntoViewIfNeeded();
    const b=await p.locator('#farm').boundingBox(),r=label.bounds,scale=await p.evaluate(()=>document.querySelector('#farm').width/document.querySelector('#farm').getBoundingClientRect().width);
    const x=(r.x+(edge==='left'?1:edge==='right'?r.width-1:r.width/2))/scale,y=(r.y+(edge==='top'?1:edge==='bottom'?r.height-1:r.height/2))/scale;
    await p.touchscreen.tap(b.x+x,b.y+y);assert.match(await p.locator('#field-title').innerText(),new RegExp('^Field '+id+' ·'),`Field ${id} ${edge} badge edge at ${width}px`);
   }}
   results.push({test:'All six painted field badges select their owners at all four edges',width,taps:24});
   if(width===390||width===1440)await p.locator('#farm').screenshot({path:path.join(out,'agriculture-ripe-'+width+'.png')});
  }await c.close();
  for(const width of [768,1000,1024,1080,1100,1180,1181,1200,1440]){const {c,p}=await open('hearth-cultivation',width);const bounds=await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,journeyRight:document.querySelector('#journey').getBoundingClientRect().right,headerRight:document.querySelector('header').getBoundingClientRect().right}));assert.equal(bounds.scroll,width,`Document fits ${width}px`);assert.ok(bounds.journeyRight<=width,`Journey fits ${width}px`);results.push({test:'Cultivation header and Journey fit',width,...bounds});if([1024,1080].includes(width))await p.screenshot({path:path.join(out,'cultivation-'+width+'.png')});await c.close();}
  for(const width of [390,1440]){const {c,p}=await open('hearth',width);await p.locator('#pause').click();await p.locator('#map-toggle').click();await p.waitForTimeout(80);
   const counts=await p.evaluate(()=>{const c=document.querySelector('#world'),ctx=c.getContext('2d');return window.__paintedText.world.filter(t=>/^\d+$/.test(t.text)).map(t=>{const pixel=ctx.getImageData(Math.round(t.x),Math.round(t.y+2),1,1).data;return{...t,background:'#'+[...pixel].slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('')};});});assert.ok(counts.length);
   for(const count of counts){const l=[luminance(count.color),luminance(count.background)].sort((a,b)=>b-a),contrast=(l[0]+.05)/(l[1]+.05);assert.ok(contrast>=4.5,`Resident count contrast ${contrast.toFixed(2)} at ${width}px`);results.push({test:'Actual map resident count contrast',width,text:count.text,color:count.color,background:count.background,contrast});}
   await p.locator('#world').screenshot({path:path.join(out,'hearth-map-'+width+'.png')});await c.close();
  }
  const {c:hc,p:hp}=await open('hearth');await hp.locator('#pause').click();const cues=[];
  for(const job of ['wood','water','idle']){await hp.locator(job==='idle'?'#rest':'[data-job="'+job+'"]').click();await hp.waitForTimeout(80);const bytes=await hp.locator('#world').screenshot({path:path.join(out,'hearth-job-'+job+'.png')});cues.push({job,hash:sha(bytes),card:await hp.locator('[data-person="0"]').innerText()});}
  assert.equal(new Set(cues.map(c=>c.hash)).size,3,'Wood, water and resting canvas cues are distinct');
  await hp.locator('[data-job="wood"]').click();let worked=false;for(let n=0;n<100;n++){await hp.locator('#step').click();const s=await hp.evaluate(()=>JSON.parse(localStorage.getItem('singularity-clicker.hearth.v1')));if(s.people[0].phase==='work'){worked=true;break;}}assert.ok(worked,'Woodcutter reached stationary work through controls');await hp.waitForTimeout(80);await hp.locator('#world').screenshot({path:path.join(out,'hearth-job-working.png')});results.push({test:'Distinct paused job/rest cues and earned stationary work',cues});await hc.close();
  assert.deepEqual(errors,[]);console.log('PASS review regressions: 120 badge edge taps / 5 widths, 9 cultivation header widths, actual map contrast at 2 widths, distinct job/rest and stationary-work cues; zero browser errors');
 }catch(e){failed=e;console.error(e);process.exitCode=1;}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({results,errors,failure:failed?.message||null},null,2));await browser.close();await new Promise(r=>server.close(r));}
})();
