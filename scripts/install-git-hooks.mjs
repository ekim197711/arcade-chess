import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

if (!process.env.CI) {
  let root;
  try { root=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(); }
  catch (error) {
    if(error.code==='EPERM'||error.code==='EACCES')throw error;
    console.log('Git hooks skipped: this checkout has no Git repository.');
  }
  if (root && resolve(root)===resolve(process.cwd())) {
    let current='';
    try { current=execFileSync('git',['config','--get','core.hooksPath'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(); } catch { /* Git exits 1 when the setting is absent. */ }
    if(current && current!=='.githooks')throw new Error(`Existing Git hooksPath (${current}) was preserved. Add the version hook to that hook chain explicitly.`);
    const hooks=['pre-commit','pre-merge-commit','post-commit','post-merge'];
    if(!current && hooks.some(hook=>existsSync(resolve(root,execFileSync('git',['rev-parse','--git-path',`hooks/${hook}`],{encoding:'utf8'}).trim()))))throw new Error('Existing commit hooks were preserved. Add the version hooks to that hook chain explicitly.');
    for(const hook of hooks)chmodSync(resolve(root,'.githooks',hook),0o755);
    execFileSync('git',['config','--local','core.hooksPath','.githooks'],{stdio:'inherit'});
    console.log('Installed commit versioning hooks (.githooks).');
  }
}
