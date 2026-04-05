import path from 'node:path';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { hashContent } from './lib/hash-file.mjs';
import { buildStats, readDocumentsManifest, upsertDocumentRecord } from './lib/manifest.mjs';
import { buildSlug } from './lib/slugify.mjs';
import {
  ARCHIVE_DIR,
  DOCS_DIR,
  DOCUMENTS_MANIFEST_PATH,
  INCOMING_DIR,
  SEARCH_INDEX_PATH,
  STATS_PATH
} from './lib/project-paths.mjs';
import { extractViewerMeta, validateViewerHtmlBasic } from './lib/parse-viewer-meta.mjs';
import { writeJsonAtomic } from './lib/write-json.mjs';
import { buildSearchIndex } from './build-search-index.mjs';
import { generatePreviewOrPlaceholder } from './generate-preview.mjs';

function timestampForPath(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function pathExists(targetPath) {
  try {
    await readdir(targetPath);
    return true;
  } catch {
    return false;
  }
}

function ensureNoConflict(manifest, { slug, gostNumber, fileHash }, { replace }) {
  const bySlug = manifest.find((entry) => entry.slug === slug);
  const byGost = manifest.find((entry) => entry.gostNumber === gostNumber);
  const byHash = manifest.find((entry) => entry.fileHash === fileHash);

  if (replace) {
    if (byHash && byHash.slug !== slug) {
      throw new Error(`Найден дубликат по fileHash: ${byHash.slug}. Замена для другого slug запрещена.`);
    }

    if (byGost && byGost.slug !== slug) {
      throw new Error(`Найден конфликт gostNumber с другим slug: ${byGost.slug}.`);
    }

    return { existing: bySlug ?? byGost ?? null };
  }

  if (bySlug) {
    throw new Error(`Документ с slug "${slug}" уже существует. Используйте --replace.`);
  }

  if (byGost) {
    throw new Error(`Документ с номером "${gostNumber}" уже существует. Используйте --replace.`);
  }

  if (byHash) {
    throw new Error(`Viewer с таким fileHash уже импортирован как "${byHash.slug}".`);
  }

  return { existing: null };
}

async function archiveExistingDocument(slug) {
  const sourcePath = path.join(DOCS_DIR, slug);
  const archivePath = path.join(ARCHIVE_DIR, 'replaced', `${timestampForPath()}-${slug}`);
  await mkdir(path.dirname(archivePath), { recursive: true });
  await rename(sourcePath, archivePath);
}

async function archiveImportedSource(sourcePath) {
  const archiveDirectory = path.join(ARCHIVE_DIR, 'imported', timestampForPath());
  await mkdir(archiveDirectory, { recursive: true });
  const destinationPath = path.join(archiveDirectory, path.basename(sourcePath));
  await rename(sourcePath, destinationPath);
}

function buildLocalMeta(meta, slug, fileHash, timestamps, previewFileName = 'preview.html') {
  return {
    id: slug,
    slug,
    gostNumber: meta.gostNumber,
    title: meta.title,
    shortTitle: meta.shortTitle,
    year: meta.year,
    status: meta.status,
    language: meta.language,
    pages: meta.pages,
    viewerUrl: `/docs/${slug}/viewer.html`,
    metaUrl: `/docs/${slug}/meta.json`,
    previewUrl: `/docs/${slug}/${previewFileName}`,
    searchTextUrl: '/data/search-index.json',
    tags: meta.tags,
    sourceType: meta.sourceType,
    importedAt: timestamps.importedAt,
    updatedAt: timestamps.updatedAt,
    fileHash,
    viewerVersion: meta.viewerVersion,
    hasInternalSearch: meta.hasInternalSearch,
    hasThemeToggle: meta.hasThemeToggle,
    hasPrintMode: meta.hasPrintMode,
    hasQuickNav: meta.hasQuickNav,
    hasBackNavigation: meta.hasBackNavigation,
    description: meta.description,
    navItemsCount: meta.navItems.length,
    navItems: meta.navItems
  };
}

export async function importViewer(inputPath, options = {}) {
  const absoluteInputPath = path.resolve(inputPath);
  const html = await readFile(absoluteInputPath, 'utf8');

  validateViewerHtmlBasic(html);

  const parsedMeta = extractViewerMeta({ html, filePath: absoluteInputPath });
  const slug = buildSlug(parsedMeta.gostNumber);
  const fileHash = hashContent(html);
  const manifest = await readDocumentsManifest();
  const { existing } = ensureNoConflict(
    manifest,
    { slug, gostNumber: parsedMeta.gostNumber, fileHash },
    { replace: Boolean(options.replace) }
  );

  const finalDirectory = path.join(DOCS_DIR, slug);
  const stagingDirectory = path.join(DOCS_DIR, `.staging-${slug}-${Date.now()}`);

  if (await pathExists(finalDirectory)) {
    if (!options.replace) {
      throw new Error(`Папка назначения уже существует: ${finalDirectory}`);
    }
  }

  const now = new Date().toISOString();
  const localMeta = buildLocalMeta(parsedMeta, slug, fileHash, {
    importedAt: existing?.importedAt ?? now,
    updatedAt: now
  }, 'preview.html');

  await mkdir(stagingDirectory, { recursive: true });

  try {
    await writeFile(path.join(stagingDirectory, 'viewer.html'), html, 'utf8');
    await generatePreviewOrPlaceholder({
      outputDirectory: stagingDirectory,
      html,
      meta: parsedMeta
    });
    await writeFile(
      path.join(stagingDirectory, 'meta.json'),
      `${JSON.stringify(localMeta, null, 2)}\n`,
      'utf8'
    );

    const nextManifest = upsertDocumentRecord(manifest, localMeta);
    const nextStats = buildStats(nextManifest);
    const nextSearchIndex = await buildSearchIndex(nextManifest, {
      htmlBySlug: new Map([[slug, html]])
    });

    if (options.replace && await pathExists(finalDirectory)) {
      await archiveExistingDocument(slug);
    }

    await rename(stagingDirectory, finalDirectory);

    await Promise.all([
      writeJsonAtomic(DOCUMENTS_MANIFEST_PATH, nextManifest),
      writeJsonAtomic(STATS_PATH, nextStats),
      writeJsonAtomic(SEARCH_INDEX_PATH, nextSearchIndex)
    ]);

    await archiveImportedSource(absoluteInputPath);
    return localMeta;
  } catch (error) {
    await rm(stagingDirectory, { recursive: true, force: true });
    throw error;
  }
}

async function resolveTargets(args) {
  if (args.includes('--all')) {
    const directoryEntries = await readdir(INCOMING_DIR, { withFileTypes: true }).catch(() => []);
    return directoryEntries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
      .map((entry) => path.join(INCOMING_DIR, entry.name));
  }

  return args.filter((argument) => !argument.startsWith('--'));
}

async function main() {
  const args = process.argv.slice(2);
  const replace = args.includes('--replace');
  const targets = await resolveTargets(args);

  if (targets.length === 0) {
    throw new Error('Не указан HTML-viewer для импорта и в incoming нет файлов для --all.');
  }

  let hasErrors = false;

  for (const target of targets) {
    try {
      const meta = await importViewer(target, { replace });
      console.log(`IMPORTED ${meta.slug} (${meta.gostNumber})`);
    } catch (error) {
      hasErrors = true;
      console.error(`FAILED ${target}: ${error.message}`);
    }
  }

  if (hasErrors) {
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
