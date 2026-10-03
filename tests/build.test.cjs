const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
test('self-contained builds work in encoded paths and retain stage navigation',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'clicker build # '));
 try{
  for(const name of ['src','assets','build.mjs'])fs.cpSync(path.join(__dirname,'..',name),path.join(root,name),{recursive:true});
  execFileSync(process.execPath,[path.join(root,'build.mjs')],{cwd:os.tmpdir()});
  for(const [file,link] of [['index.html','hearth.html'],['hearth.html','index.html']]){
   const html=fs.readFileSync(path.join(root,'dist',file),'utf8');
   assert.ok(html.includes('href="'+link+'"'));assert.doesNotMatch(html,/\/\*__(?:ENGINE|VIEW|CSS|STYLES)__\*\//);
  }
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
