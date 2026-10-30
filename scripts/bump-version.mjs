import { execFileSync } from 'node:child_process';
import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';

if(!process.argv.includes('--staged'))throw new Error('Use --staged from the Git commit hook.');
const git=(args,input)=>execFileSync('git',args,{encoding:'utf8',input,stdio:['pipe','pipe','pipe']});
const root=git(['rev-parse','--show-toplevel']).trim();
process.chdir(root);
const staged=path=>{try{return git(['show',`:${path}`]);}catch{return null;}};
const source=staged('package.json');
if(!source)throw new Error('Stage package.json before committing so the app version can be recorded.');
const manifest=JSON.parse(source);
if(!/^\d+\.\d+\.\d+$/.test(manifest.version))throw new Error('App version must use major.minor.patch numbers.');
let previous;
try{previous=JSON.parse(git(['show','HEAD:package.json'])).version;}catch{previous=manifest.version;}
const parts=manifest.version.split('.').map(Number);
if(parts.some(part=>!Number.isSafeInteger(part))||!Number.isSafeInteger(parts[2]+1))throw new Error('Invalid app version number.');
if(previous && /^\d+\.\d+\.\d+$/.test(previous)){
  const before=previous.split('.').map(Number);
  const order=parts.map((part,index)=>part-before[index]).find(difference=>difference!==0)??0;
  if(order<0)throw new Error('The staged version is older than HEAD. Re-stage the current version files or run node scripts/sync-version-index.mjs.');
}
const next=manifest.version===previous?`${parts[0]}.${parts[1]}.${parts[2]+1}`:manifest.version;
const serialize=(data,original)=>{
  const indent=original.match(/\n([ \t]+)"/)?.[1]??'  ';
  const text=JSON.stringify(data,null,indent)+(original.endsWith('\n')?'\n':'');
  return original.includes('\r\n')?text.replace(/\n/g,'\r\n'):text;
};
const edit=(text,path,from)=>{
  const data=JSON.parse(text);
  // Preserve an intentionally different, unstaged version as well as dependency edits.
  if(from===undefined || data.version===from)data.version=next;
  if(path==='package-lock.json' && data.packages?.[''] && (from===undefined || data.packages[''].version===from))data.packages[''].version=next;
  return serialize(data,text);
};
const files=[];
for(const path of ['package.json','package-lock.json']){
  const original=staged(path);if(original===null)continue;
  const data=JSON.parse(original);
  const updated=edit(original,path);
  const mode=git(['ls-files','--stage','--',path]).split(' ')[0];
  const blob=git(['hash-object','-w','--stdin'],updated).trim();
  const workingPath=resolve(root,path);
  const working=existsSync(workingPath)?readFileSync(workingPath,'utf8'):null;
  files.push({path,mode,blob,workingPath,working,updatedWorking:working===null?null:edit(working,path,data.version)});
}
try{
  for(const file of files)if(file.updatedWorking!==null && file.updatedWorking!==file.working)writeFileSync(file.workingPath,file.updatedWorking);
  // Update only the staged manifest blobs. Never stage unrelated working-copy edits.
  git(['update-index','--index-info'],files.map(file=>`${file.mode} ${file.blob}\t${file.path}\n`).join(''));
  const pendingPath=resolve(root,git(['rev-parse','--git-path','app-version-state.json']).trim());
  writeFileSync(pendingPath,JSON.stringify({previous,next})+'\n');
}catch(error){
  for(const file of files)if(file.working!==null && existsSync(file.workingPath) && readFileSync(file.workingPath,'utf8')===file.updatedWorking)writeFileSync(file.workingPath,file.working);
  throw error;
}
console.log(`App version for this commit: ${next}`);
