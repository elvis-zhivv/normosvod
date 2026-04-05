import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

function stringifyJson(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

export async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, stringifyJson(data), 'utf8');
}

export async function writeJsonAtomic(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });

  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, stringifyJson(data), 'utf8');
  await rm(filePath, { force: true });
  await rename(tempPath, filePath);
}
