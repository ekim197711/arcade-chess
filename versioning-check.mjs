import assert from 'node:assert/strict';
import { execFileSync,spawnSync } from 'node:child_process';
import { mkdir,mkdtemp,writeFile,readFile,copyFile,chmod,unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const fixture=await mkdtemp(resolve(tmpdir(),'arcade-versioning-check-'));
await mkdir(resolve(fixture,'.githooks'),{recursive:true});await mkdir(resolve(fixture,'scripts'));
for(const file of ['bump-version.mjs','sync-version-index.mjs','install-git-hooks.mjs'])await copyFile('scripts/'+file,resolve(fixture,'scripts',file));
for(const hook of ['pre-commit','pre-merge-commit','post-commit','post-merge']){await copyFile('.githooks/'+hook,resolve(fixture,'.githooks',hook));await chmod(resolve(fixture,'.githooks',hook),0o755);}
const git=(args)=>execFileSync('git',args,{cwd:fixture,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const write=async(path,value)=>writeFile(resolve(fixture,path),JSON.stringify(value,null,2)+'\n');
const read=async path=>JSON.parse(await readFile(resolve(fixture,path),'utf8'));
git(['init','-q']);git(['config','user.name','Versioning test']);git(['config','user.email','versioning-test@example.invalid']);git(['config','commit.gpgsign','false']);git(['config','gc.auto','0']);git(['config','maintenance.auto','false']);git(['config','core.hooksPath','.disabled-hooks']);
const pkg={name:'hook-test',version:'0.1.0',dependencies:{demo:'1.0.0'}};
const lock={name:'hook-test',version:'0.1.0',lockfileVersion:3,packages:{'':{name:'hook-test',version:'0.1.0',dependencies:{demo:'1.0.0'}},'node_modules/demo':{version:'1.0.0'}}};
await write('package.json',pkg);await write('package-lock.json',lock);await writeFile(resolve(fixture,'fixture.txt'),'initial');
git(['add','.']);git(['commit','-qm','Initial fixture']);git(['config','--unset','core.hooksPath']);
execFileSync(process.execPath,['scripts/install-git-hooks.mjs'],{cwd:fixture,stdio:'pipe'});
assert.equal(git(['config','--local','--get','core.hooksPath']),'.githooks');
await write('package.json',{...pkg,dependencies:{demo:'2.0.0'}}); // Deliberately unstaged.
await writeFile(resolve(fixture,'fixture.txt'),'first');git(['add','fixture.txt']);git(['commit','-qm','First versioned commit']);
let committed=JSON.parse(git(['show','HEAD:package.json']));assert.equal(committed.version,'0.1.1');assert.equal(committed.dependencies.demo,'1.0.0','unstaged dependency must not enter the commit');
assert.equal((await read('package.json')).dependencies.demo,'2.0.0');assert.equal((await read('package.json')).version,'0.1.1');
const committedLock=JSON.parse(git(['show','HEAD:package-lock.json']));assert.equal(committedLock.version,'0.1.1');assert.equal(committedLock.packages[''].version,'0.1.1');assert.equal(committedLock.packages['node_modules/demo'].version,'1.0.0');
await writeFile(resolve(fixture,'fixture.txt'),'second');git(['add','fixture.txt']);git(['commit','-qm','Second versioned commit']);assert.equal(JSON.parse(git(['show','HEAD:package.json'])).version,'0.1.2');
await writeFile(resolve(fixture,'.githooks/commit-msg'),'#!/bin/sh\nexit 1\n');await chmod(resolve(fixture,'.githooks/commit-msg'),0o755);
await writeFile(resolve(fixture,'fixture.txt'),'retry');git(['add','fixture.txt']);
assert.notEqual(spawnSync('git',['commit','-qm','Rejected commit'],{cwd:fixture}).status,0);
assert.equal(JSON.parse(git(['show',':package.json'])).version,'0.1.3');
await unlink(resolve(fixture,'.githooks/commit-msg'));git(['commit','-qm','Retry same commit']);assert.equal(JSON.parse(git(['show','HEAD:package.json'])).version,'0.1.3','retry does not double-bump');
const manual=await read('package.json');manual.version='0.2.0';await write('package.json',manual);git(['add','package.json']);git(['commit','-qm','Manual minor bump']);assert.equal(JSON.parse(git(['show','HEAD:package.json'])).version,'0.2.0');assert.equal(JSON.parse(git(['show','HEAD:package-lock.json'])).version,'0.2.0');
git(['commit','--amend','--no-edit','-q']);assert.equal(JSON.parse(git(['show','HEAD:package.json'])).version,'0.2.1','amend creates another versioned revision');
await writeFile(resolve(fixture,'fixture.txt'),'partial commit');await writeFile(resolve(fixture,'later.txt'),'still staged');git(['add','later.txt']);
git(['commit','-qm','Commit only selected path','--only','fixture.txt']);
assert.equal(JSON.parse(git(['show','HEAD:package.json'])).version,'0.2.2');
assert.equal(JSON.parse(git(['show',':package.json'])).version,'0.2.2','partial commit must not leave a staged version rollback');
assert(git(['diff','--cached','--name-only']).includes('later.txt'),'other staged changes survive a partial commit');
git(['config','core.hooksPath','.existing-hooks']);
const protectedHook=spawnSync(process.execPath,['scripts/install-git-hooks.mjs'],{cwd:fixture});assert.notEqual(protectedHook.status,0);assert.equal(git(['config','--get','core.hooksPath']),'.existing-hooks','installer preserves an existing hook chain');

const dist=resolve(fixture,'dist');await mkdir(resolve(dist,'assets'),{recursive:true});
const info={version:'0.2.1',buildId:crypto.randomUUID(),commit:'a'.repeat(40),committedAt:'2026-10-01T10:00:00Z',builtAt:'2026-10-30T10:00:00Z',dirty:false};
await writeFile(resolve(dist,'build-info.json'),JSON.stringify(info));await writeFile(resolve(dist,'index.html'),'<script src="/assets/app.js"></script>');await writeFile(resolve(dist,'assets/app.js'),`window.buildId=${JSON.stringify(info.buildId)};`);
const script=resolve('scripts/deploy.mjs');
const plan=JSON.parse(execFileSync(process.execPath,[script,'--dist',dist,'--dry-run'],{encoding:'utf8'}));assert.equal(plan.version,'0.2.1');assert.match(plan.deployedAt,/S3/);
await writeFile(resolve(dist,'assets/app.js'),'window.stale=true;');const invalid=spawnSync(process.execPath,[script,'--dist',dist,'--dry-run'],{encoding:'utf8'});assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/metadata does not match/);
console.log('PASS versioning: real commits auto-bump package/lock, unstaged edits preserved, rejected-commit retry is idempotent, manual minor bump/amend, existing-hook protection and stale-build deployment rejection. Main repository history untouched.');
