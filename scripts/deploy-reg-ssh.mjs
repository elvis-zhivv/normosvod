import path from 'node:path';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { loadProjectEnv } from './lib/load-env.mjs';

const env = loadProjectEnv();

const host = env.REG_HOST;
const user = env.REG_USER;
const remotePath = env.REG_REMOTE_PATH;
const port = env.REG_PORT || '22';

const required = [
  ['REG_HOST', host],
  ['REG_USER', user],
  ['REG_REMOTE_PATH', remotePath]
];

const missing = required.filter(([, value]) => !value).map(([key]) => key);

if (missing.length > 0) {
  console.error(
    `Missing deployment settings: ${missing.join(', ')}. Copy .env.example to .env and fill the values.`
  );
  process.exit(1);
}

const distDir = path.resolve(process.cwd(), 'dist');

if (!existsSync(distDir)) {
  console.error('dist directory not found. Run "npm run build:reg" first.');
  process.exit(1);
}

const remoteTarget = `${user}@${host}:${remotePath.replace(/\\/g, '/')}`;
const sshTarget = `${user}@${host}`;

const uploadEntries = [
  'assets',
  'data',
  'docs',
  'index.html',
  '404.html',
  '.htaccess'
].map((entry) => path.join(distDir, entry));

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false
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

await run('ssh', ['-p', String(port), sshTarget, `mkdir -p ${remotePath}`]);
await run('scp', ['-P', String(port), '-r', ...uploadEntries, remoteTarget]);
await run('ssh', [
  '-p',
  String(port),
  sshTarget,
  `find ${remotePath} -type d -exec chmod 755 {} \\; && find ${remotePath} -type f -exec chmod 644 {} \\;`
]);

console.log(`Deployment uploaded to ${remoteTarget}`);
