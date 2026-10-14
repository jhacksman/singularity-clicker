/* Run unchanged test behavior on a separate loopback port with installed Chrome.
   Instrumentation saves earned progression states for visual comparisons only. */
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const pw=require(process.env.PLAYWRIGHT_MODULE||'/Users/m6mini/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
process.env.PLAYWRIGHT_MODULE=require.resolve(process.env.PLAYWRIGHT_MODULE||'/Users/m6mini/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const launch=pw.chromium.launch.bind(pw.chromium);pw.chromium.launch=async opts=>{const browser=await launch({...opts,channel:'chrome'}),newContext=browser.newContext.bind(browser);browser.newContext=({recordVideo,...options}={})=>newContext(options);return browser;}; // Local screenshots replace optional video; no ffmpeg install.
process.env.PORT=process.env.PORT||'18763';
const file=path.resolve(process.argv[2]),mod=new Module(file,module);mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));let source=fs.readFileSync(file,'utf8').replaceAll('127.0.0.1:8080','127.0.0.1:'+process.env.PORT);
if(file.endsWith('/hearth-progression.cjs')){source=source.replace("if(milestones.length!==lastMilestoneCount){", "if(milestones.length!==lastMilestoneCount){fs.mkdirSync('../evidence/earned',{recursive:true});fs.writeFileSync('../evidence/earned/hearth-'+state.time+'.json',JSON.stringify(state));");}
if(file.endsWith('/agriculture.cjs')){source=source.replace("const next=state.buildings.includes", "if(i===20){fs.mkdirSync('../evidence/earned',{recursive:true});fs.writeFileSync('../evidence/earned/agriculture-mid.json',JSON.stringify(state));}const next=state.buildings.includes");}
mod._compile(source,file);
