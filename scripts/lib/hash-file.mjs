import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export function hashContent(content, algorithm = 'sha256') {
  const hash = createHash(algorithm).update(content, 'utf8').digest('hex');
  return `${algorithm}-${hash}`;
}

export async function hashFile(filePath, algorithm = 'sha256') {
  const content = await readFile(filePath, 'utf8');
  return hashContent(content, algorithm);
}
