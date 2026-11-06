import { execFileSync } from 'node:child_process';
import { existsSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve,dirname,relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
if(args.includes('--help')){
  console.log('Usage: npm run deploy -- [--profile mikeaa] [--dist path/to/prepared/dist] [--dry-run]\nWithout --dist, builds the app first. Publishes to the existing Arcade Gambit S3/CloudFront site.');
  process.exit(0);
}
let preparedDist,profile=process.env.AWS_PROFILE||'mikeaa',dryRun=false;
for(let index=0;index<args.length;index++){
  if(args[index]==='--dry-run')dryRun=true;
  else if(args[index]==='--dist'||args[index]==='--profile'){
    const key=args[index],value=args[++index];if(!value||value.startsWith('--'))throw new Error(`Missing value for ${key}`);
    if(key==='--dist')preparedDist=resolve(value);else profile=value;
  }else throw new Error(`Unknown deployment option: ${args[index]}`);
}
const runNode=arguments_=>execFileSync(process.execPath,arguments_,{cwd:projectRoot,stdio:'inherit'});
if(!preparedDist){
  runNode([resolve(projectRoot,'node_modules/typescript/bin/tsc'),'-b']);
  runNode([resolve(projectRoot,'node_modules/vite/bin/vite.js'),'build']);
}
const dist=preparedDist??resolve(projectRoot,'dist');
const build=JSON.parse(readFileSync(resolve(dist,'build-info.json'),'utf8'));
if(!/^\d+\.\d+\.\d+$/.test(build.version)||typeof build.buildId!=='string'||!build.buildId
  ||!Number.isFinite(Date.parse(build.builtAt))||typeof build.dirty!=='boolean'
  ||!(build.commit===null||typeof build.commit==='string'&&/^[a-f0-9]{40,64}$/.test(build.commit)))throw new Error('Invalid build-info.json; rebuild before deploying.');
const html=readFileSync(resolve(dist,'index.html'),'utf8');
const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map(match=>match[1]);
if(!assets.some(asset=>asset.endsWith('.js')))throw new Error('No built entry script found.');
let matchingBuild=false;
for(const asset of assets){
  const path=resolve(dist,'.'+asset),pathFromDist=relative(dist,path);
  if(pathFromDist.startsWith('..')||!existsSync(path))throw new Error(`Missing or invalid build asset: ${asset}`);
  if(asset.endsWith('.js')&&readFileSync(path,'utf8').includes(build.buildId))matchingBuild=true;
}
if(!matchingBuild)throw new Error('Build metadata does not match the entry script. Rebuild the complete artifact.');
const bucket='arcadegambit',prefix='production/dist',distribution='E3IVH01CYNGMY8';
if(dryRun){
  console.log(JSON.stringify({version:build.version,buildId:build.buildId,commit:build.commit,dirty:build.dirty,dist,bucket,prefix,distribution,profile,deployedAt:'Assigned from S3 index.html LastModified after publication'},null,2));
  process.exit(0);
}
const aws=(command,capture=false)=>execFileSync('aws',[...command,'--profile',profile],{encoding:'utf8',stdio:capture?['ignore','pipe','inherit']:'inherit',env:{...process.env,AWS_PAGER:''}});
const account=aws(['sts','get-caller-identity','--query','Account','--output','text'],true).trim();
if(account!=='337909745036')throw new Error('AWS profile points to a different account. No files were uploaded.');
const destination=`s3://${bucket}/${prefix}/`;
aws(['s3','sync',dist,destination,'--exclude','index.html','--exclude','build-info.json','--exclude','deployment.json','--size-only','--cache-control','public,max-age=31536000,immutable','--no-progress']);
aws(['s3','cp',resolve(dist,'build-info.json'),destination+'build-info.json','--content-type','application/json','--cache-control','no-cache','--no-progress']);
aws(['s3','cp',resolve(dist,'index.html'),destination+'index.html','--content-type','text/html','--cache-control','no-cache','--no-progress']);
const published=aws(['s3api','head-object','--bucket',bucket,'--key',prefix+'/index.html','--query','LastModified','--output','text'],true).trim();
if(!Number.isFinite(Date.parse(published)))throw new Error('Could not verify the published entry page timestamp.');
const deployment={...build,environment:'production',deployedAt:new Date(published).toISOString()};
writeFileSync(resolve(dist,'deployment.json'),JSON.stringify(deployment,null,2)+'\n');
aws(['s3','cp',resolve(dist,'deployment.json'),destination+'deployment.json','--content-type','application/json','--cache-control','no-cache','--no-progress']);
aws(['cloudfront','create-invalidation','--distribution-id',distribution,'--paths','/','/index.html','/build-info.json','/deployment.json','--query','Invalidation.{Id:Id,Status:Status}','--output','json']);
console.log(`Published v${build.version} (${build.buildId}) at ${deployment.deployedAt}: https://www.arcadegambit.com`);
