// Run on Spark before the reducer suite/build/browser flows. Never imports app code.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),files=['build.mjs'];
function collect(directory){
 for(const entry of fs.readdirSync(path.join(root,directory),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
  const relative=path.join(directory,entry.name);
  if(entry.isDirectory())collect(relative);
  else if(entry.isFile()&&/\.(?:js|cjs|mjs)$/.test(entry.name))files.push(relative);
 }
}
for(const directory of ['src','scripts','tests'])collect(directory);
console.log('Syntax gate: checking '+files.length+' source, script and test files');
for(const file of files){
 const result=spawnSync(process.execPath,['--check',file],{cwd:root,stdio:'inherit'});
 if(result.error||result.status!==0){
  console.error('SYNTAX FAIL: '+file+(result.error?' — '+result.error.message:''));
  process.exit(result.status||1);
 }
}
console.log('PASS syntax gate: '+files.length+' files; application code not executed');
