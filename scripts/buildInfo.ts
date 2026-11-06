import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

export function createBuildInfo(projectRoot: string) {
  const git = (args: string[]) => {
    try { return execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim(); }
    catch { return null; }
  };
  const manifest = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8')) as { version: string };
  const commit = git(['rev-parse','HEAD']);
  const gitRoot = git(['rev-parse','--show-toplevel']);
  const status = git(['status','--porcelain','--untracked-files=normal']);
  return {
    version: manifest.version,
    commit,
    committedAt: commit ? git(['show','-s','--format=%cI','HEAD']) : null,
    builtAt: new Date().toISOString(),
    buildId: randomUUID(),
    // A prepared source copy cannot claim to be a clean Git checkout.
    dirty: !gitRoot || resolve(gitRoot) !== resolve(projectRoot) || status === null || status.length > 0,
  };
}
