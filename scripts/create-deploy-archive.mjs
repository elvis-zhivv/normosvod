import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const archiveDir = path.resolve(process.cwd(), 'archive', 'deploy');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const archivePath = path.join(archiveDir, `normosvod-dist-${timestamp}.zip`);

const entries = [
  'index.html',
  '404.html',
  '.htaccess',
  'assets',
  'data',
  'docs'
];

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      ...options
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

await mkdir(archiveDir, { recursive: true });

await run('tar', ['-a', '-c', '-f', archivePath, ...entries], {
  cwd: path.resolve(process.cwd(), 'dist')
});

console.log(`Deploy archive created: ${archivePath}`);

