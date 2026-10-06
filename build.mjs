import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const image=name=>'data:image/svg+xml;base64,'+fs.readFileSync(path.join(root,'assets',name)).toString('base64');
const css=read('src/styles.css').replace('__CAVE_IMAGE__',image('cave.svg')).replace('__ATLAS_IMAGE__',image('objects.svg'))+'\n'+read('src/campaign-navigation/styles.css');
const people=read('assets/people.svg').replace('<svg ', '<svg aria-hidden="true" ');
const html=read('src/shell.html').replace('<!--__PEOPLE__-->',()=>people).replace('/*__STYLES__*/',()=>css).replace('/*__ENGINE__*/',()=>read('src/engine.js')).replace('/*__RTS_ENGINE__*/',()=>read('src/hearth-rts/engine.js')).replace('/*__NAVIGATION_POLICY__*/',()=>read('src/campaign-navigation/adapter.cjs')).replace('/*__NAVIGATION_VIEW__*/',()=>read('src/campaign-navigation/browser.js')).replace('/*__VIEW__*/',()=>read('src/view.js'));
fs.mkdirSync(path.join(root,'dist'),{recursive:true});fs.writeFileSync(path.join(root,'dist/index.html'),html);
console.log('Built self-contained cave: '+(Buffer.byteLength(html)/1024/1024).toFixed(2)+' MB');

const hearth=read('src/hearth/shell.html').replace('/*__CSS__*/',()=>read('src/hearth/styles.css')).replace('/*__ENGINE__*/',()=>read('src/hearth/engine.js')).replace('/*__VIEW__*/',()=>read('src/hearth/view.js'));
fs.writeFileSync(path.join(root,'dist/hearth.html'),hearth);
console.log('Built self-contained hearth: '+(Buffer.byteLength(hearth)/1024).toFixed(0)+' KB');

const agriculture=read('src/agriculture/shell.html').replace('/*__CSS__*/',()=>read('src/agriculture/styles.css')).replace('/*__HEARTH__*/',()=>read('src/hearth/engine.js')).replace('/*__ENGINE__*/',()=>read('src/agriculture/engine.js')).replace('/*__VIEW__*/',()=>read('src/agriculture/view.js'));
fs.writeFileSync(path.join(root,'dist/agriculture.html'),agriculture);
console.log('Built self-contained Agriculture slice: '+(Buffer.byteLength(agriculture)/1024).toFixed(0)+' KB');

const rts=read('src/hearth-rts/shell.html').replace('/*__CSS__*/',()=>read('src/hearth-rts/styles.css')).replace('/*__ENGINE__*/',()=>read('src/hearth-rts/engine.js')).replace('/*__FEEDBACK__*/',()=>read('src/hearth-rts/feedback.js')).replace('/*__VIEW__*/',()=>read('src/hearth-rts/view.js'));
fs.writeFileSync(path.join(root,'dist/hearth-rts.html'),rts);
console.log('Built self-contained Hearth RTS core: '+(Buffer.byteLength(rts)/1024).toFixed(0)+' KB');

const cultivation=read('src/hearth-cultivation/shell.html')
 .replace('/*__CSS__*/',()=>read('src/hearth-cultivation/styles.css'))
 .replace('/*__LEGACY_ENGINE__*/',()=>read('src/hearth-rts/engine.js'))
 .replace('/*__CULTIVATION_LEDGER__*/',()=>read('src/hearth-cultivation/ledger.js'))
 .replace('/*__CULTIVATION_JOBS__*/',()=>read('src/hearth-cultivation/jobs.js'))
 .replace('/*__ENGINE__*/',()=>read('src/hearth-cultivation/engine.js'))
 .replace('/*__FEEDBACK__*/',()=>read('src/hearth-rts/feedback.js'))
 .replace('/*__CULTIVATION_GUIDANCE__*/',()=>read('src/hearth-cultivation/guidance.js'))
 .replace('/*__VIEW__*/',()=>read('src/hearth-cultivation/view.js'));
fs.writeFileSync(path.join(root,'dist/hearth-cultivation.html'),cultivation);
console.log('Built self-contained local cultivation preview: '+(Buffer.byteLength(cultivation)/1024).toFixed(0)+' KB');
