import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sYuk3kAAAAASUVORK5CYII=';

export async function generatePreviewOrPlaceholder({ outputDirectory }) {
  await mkdir(outputDirectory, { recursive: true });
  const previewPath = path.join(outputDirectory, 'preview.png');
  const buffer = Buffer.from(PLACEHOLDER_PNG_BASE64, 'base64');
  await writeFile(previewPath, buffer);
  return previewPath;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('Этот скрипт используется как модуль генерации placeholder preview.');
}
