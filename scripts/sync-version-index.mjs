import { execFileSync } from 'node:child_process';
import { existsSync,readFileSync,unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

// `git commit --only` uses a temporary index for the commit and a second index
// for the staged work it preserves. Synchronize just version fields afterward.
const env={...process.env};delete env.GIT_INDEX_FILE;
const git=(args,input)=>execFileSync('git',args,{encoding:'utf8',env,input,stdio:['pipe','pipe','pipe']});
const root=git(['rev-parse','--show-toplevel']).trim();process.chdir(root);
const pendingPath=resolve(root,git(['rev-parse','--git-path','app-version-state.json']).trim());
if(existsSync(pendingPath)){
  const {previous,next}=JSON.parse(readFileSync(pendingPath,'utf8'));
  const head=JSON.parse(git(['show','HEAD:package.json']));
  if(head.version===next){
    const records=[];
    for(const path of ['package.json','package-lock.json']){
      let original;try{original=git(['show',`:${path}`]);}catch{continue;}
      const data=JSON.parse(original);let changed=false;
      if(data.version===previous){data.version=next;changed=true;}
      if(path==='package-lock.json'&&data.packages?.['']?.version===previous){data.packages[''].version=next;changed=true;}
      if(!changed)continue;
      const indent=original.match(/\n([ \t]+)"/)?.[1]??'  ';
      let updated=JSON.stringify(data,null,indent)+(original.endsWith('\n')?'\n':'');
      if(original.includes('\r\n'))updated=updated.replace(/\n/g,'\r\n');
      const mode=git(['ls-files','--stage','--',path]).split(' ')[0];
      const blob=git(['hash-object','-w','--stdin'],updated).trim();records.push(`${mode} ${blob}\t${path}\n`);
    }
    if(records.length)git(['update-index','--index-info'],records.join(''));
  }
  unlinkSync(pendingPath);
}
