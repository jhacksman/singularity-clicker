import fs from 'node:fs';
import path from 'node:path';
const root=path.dirname(new URL(import.meta.url).pathname);
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const image=name=>'data:image/svg+xml;base64,'+fs.readFileSync(path.join(root,'assets',name)).toString('base64');
const css=read('src/styles.css').replace('__CAVE_IMAGE__',image('cave.svg')).replace('__ATLAS_IMAGE__',image('objects.svg'));
const people=read('assets/people.svg').replace('<svg ', '<svg aria-hidden="true" ');
const html=read('src/shell.html').replace('<!--__PEOPLE__-->',()=>people).replace('/*__STYLES__*/',()=>css).replace('/*__ENGINE__*/',()=>read('src/engine.js')).replace('/*__VIEW__*/',()=>read('src/view.js'));
fs.mkdirSync(path.join(root,'dist'),{recursive:true});fs.writeFileSync(path.join(root,'dist/index.html'),html);
console.log('Built self-contained cave: '+(Buffer.byteLength(html)/1024/1024).toFixed(2)+' MB');

const hearth=read('src/hearth/shell.html').replace('/*__CSS__*/',()=>read('src/hearth/styles.css')).replace('/*__ENGINE__*/',()=>read('src/hearth/engine.js')).replace('/*__VIEW__*/',()=>read('src/hearth/view.js'));
fs.writeFileSync(path.join(root,'dist/hearth.html'),hearth);
console.log('Built self-contained hearth: '+(Buffer.byteLength(hearth)/1024).toFixed(0)+' KB');
