import path from 'node:path';
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { hashContent } from './lib/hash-file.mjs';
import { readDocumentsManifest } from './lib/manifest.mjs';
import { buildMetaFromCanonicalPackage, normalizeCanonicalPackage } from './lib/canonical-package.mjs';
import { normalizeDocType } from './lib/doc-type.mjs';
import {
  normalizeDocumentPackageManifest,
  PACKAGE_MANIFEST_FILENAME,
  resolvePackagePath
} from './lib/document-package.mjs';
import { enrichDocumentRecord } from './lib/document-record.mjs';
import { buildSlug } from './lib/slugify.mjs';
import {
  ARCHIVE_DIR,
  CONTENT_DOCS_DIR,
  DOCS_DIR,
  INCOMING_DIR,
} from './lib/project-paths.mjs';
import { extractViewerMeta, validateViewerHtmlBasic } from './lib/parse-viewer-meta.mjs';
import { rebuildManifest } from './rebuild-manifest.mjs';

function timestampForPath(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
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

async function archiveExistingCanonicalSource(slug) {
  const sourcePath = path.join(CONTENT_DOCS_DIR, slug);
  const archivePath = path.join(ARCHIVE_DIR, 'replaced-canonical', `${timestampForPath()}-${slug}`);
  await mkdir(path.dirname(archivePath), { recursive: true });
  await rename(sourcePath, archivePath);
}

async function archiveImportedSource(sourcePath) {
  const archiveDirectory = path.join(ARCHIVE_DIR, 'imported', timestampForPath());
  await mkdir(archiveDirectory, { recursive: true });
  const destinationPath = path.join(archiveDirectory, path.basename(sourcePath));
  await rename(sourcePath, destinationPath);
}

async function readPackageManifestFromDirectory(packageDirectoryPath) {
  const manifestPath = path.join(packageDirectoryPath, PACKAGE_MANIFEST_FILENAME);
  const manifestSource = await readFile(manifestPath, 'utf8').catch(() => '');

  if (!manifestSource) {
    return {
      manifestPath,
      source: '',
      manifest: normalizeDocumentPackageManifest({}, { documentPath: 'document.json' })
    };
  }

  return {
    manifestPath,
    source: manifestSource,
    manifest: normalizeDocumentPackageManifest(JSON.parse(manifestSource))
  };
}

async function collectPackageFileEntries(directoryPath, {
  baseRelativeDirectory,
  idPrefix,
  fallbackKind
}, state = { index: 0 }) {
  const directoryEntries = await readdir(directoryPath, { withFileTypes: true }).catch(() => []);
  const entries = [];

  for (const entry of directoryEntries) {
    const absolutePath = path.join(directoryPath, entry.name);
    const relativePath = path.posix.join(baseRelativeDirectory, entry.name);

    if (entry.isDirectory()) {
      entries.push(...await collectPackageFileEntries(absolutePath, {
        baseRelativeDirectory: relativePath,
        idPrefix,
        fallbackKind
      }, state));
      continue;
    }

    state.index += 1;
    if (!entry.isFile()) {
      continue;
    }

    entries.push({
      id: `${idPrefix}-${state.index}`,
      path: relativePath,
      label: entry.name,
      kind: path.extname(entry.name).replace(/^\./, '') || fallbackKind
    });
  }

  return entries;
}

function buildLocalMeta(meta, slug, fileHash, timestamps) {
  return enrichDocumentRecord({
    id: slug,
    slug,
    gostNumber: meta.gostNumber,
    title: meta.title,
    shortTitle: meta.shortTitle,
    docType: normalizeDocType(meta.docType, meta),
    year: meta.year,
    status: meta.status,
    language: meta.language,
    pages: meta.pages,
    viewerUrl: `/docs/${slug}/viewer.html`,
    printUrl: `/docs/${slug}/print.html`,
    metaUrl: `/docs/${slug}/meta.json`,
    canonicalDocumentUrl: `/data/canonical/${slug}.json`,
    v2DocumentUrl: `/data/canonical/${slug}.json`,
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
  });
}

export async function importViewer(inputPath, options = {}) {
  const absoluteInputPath = path.resolve(inputPath);
  const targetStat = await stat(absoluteInputPath);

  if (targetStat.isDirectory()) {
    return importDocumentPackageDirectory(absoluteInputPath, options);
  }

  const source = await readFile(absoluteInputPath, 'utf8');
  const extension = path.extname(absoluteInputPath).toLowerCase();

  if (extension === '.json') {
    return importJsonInput(absoluteInputPath, source, options);
  }

  const html = source;

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
  });

  await mkdir(stagingDirectory, { recursive: true });

  try {
    await writeFile(path.join(stagingDirectory, 'viewer.html'), html, 'utf8');
    await writeFile(
      path.join(stagingDirectory, 'meta.json'),
      `${JSON.stringify(localMeta, null, 2)}\n`,
      'utf8'
    );

    if (options.replace && await pathExists(finalDirectory)) {
      await archiveExistingDocument(slug);
    }

    await rename(stagingDirectory, finalDirectory);
    await rebuildManifest();

    await archiveImportedSource(absoluteInputPath);
    return localMeta;
  } catch (error) {
    await rm(stagingDirectory, { recursive: true, force: true });
    throw error;
  }
}

async function importJsonInput(absoluteInputPath, source, options = {}) {
  const rawPayload = JSON.parse(source);

  if (rawPayload?.kind === 'normosvod-document-package') {
    return importDocumentPackage(
      path.dirname(absoluteInputPath),
      normalizeDocumentPackageManifest(rawPayload),
      source,
      options,
      path.dirname(absoluteInputPath)
    );
  }

  return importCanonicalPackage(absoluteInputPath, source, options);
}

async function importCanonicalPackage(absoluteInputPath, source, options = {}) {
  const rawPackage = JSON.parse(source);
  const canonicalPackage = normalizeCanonicalPackage(rawPackage);
  const slug = canonicalPackage.slug;
  const fileHash = hashContent(source);
  const manifest = await readDocumentsManifest();
  const { existing } = ensureNoConflict(
    manifest,
    { slug, gostNumber: canonicalPackage.meta.gostNumber, fileHash },
    { replace: Boolean(options.replace) }
  );
  const now = new Date().toISOString();
  const localMeta = enrichDocumentRecord(buildMetaFromCanonicalPackage(canonicalPackage, {
    fileHash,
    importedAt: existing?.importedAt ?? now,
    updatedAt: now
  }));
  const finalDirectory = path.join(DOCS_DIR, slug);
  const stagingDirectory = path.join(DOCS_DIR, `.staging-${slug}-${Date.now()}`);
  const finalCanonicalDirectory = path.join(CONTENT_DOCS_DIR, slug);
  const stagingCanonicalDirectory = path.join(CONTENT_DOCS_DIR, `.staging-${slug}-${Date.now()}`);

  await mkdir(stagingDirectory, { recursive: true });
  await mkdir(stagingCanonicalDirectory, { recursive: true });

  try {
    await writeFile(
      path.join(stagingDirectory, 'meta.json'),
      `${JSON.stringify(localMeta, null, 2)}\n`,
      'utf8'
    );
    await writeFile(
      path.join(stagingCanonicalDirectory, 'document.json'),
      `${JSON.stringify(canonicalPackage, null, 2)}\n`,
      'utf8'
    );

    if (options.replace && await pathExists(finalDirectory)) {
      await archiveExistingDocument(slug);
    }

    if (options.replace && await pathExists(finalCanonicalDirectory)) {
      await archiveExistingCanonicalSource(slug);
    }

    await rename(stagingDirectory, finalDirectory);
    await rename(stagingCanonicalDirectory, finalCanonicalDirectory);
    await rebuildManifest();
    await archiveImportedSource(absoluteInputPath);
    return localMeta;
  } catch (error) {
    await rm(stagingDirectory, { recursive: true, force: true });
    await rm(stagingCanonicalDirectory, { recursive: true, force: true });
    throw error;
  }
}

async function importDocumentPackageDirectory(packageDirectoryPath, options = {}) {
  const { source, manifest } = await readPackageManifestFromDirectory(packageDirectoryPath);
  return importDocumentPackage(packageDirectoryPath, manifest, source, options, packageDirectoryPath);
}

async function importDocumentPackage(packageDirectoryPath, packageManifest, manifestSource, options = {}, importSourcePath = '') {
  const documentPath = resolvePackagePath(packageDirectoryPath, packageManifest.documentPath);
  const canonicalSource = await readFile(documentPath, 'utf8');
  const canonicalPackage = normalizeCanonicalPackage(JSON.parse(canonicalSource));
  const slug = canonicalPackage.slug;
  const fileHash = hashContent(JSON.stringify({
    packageManifest,
    canonicalDocument: canonicalPackage
  }));
  const manifest = await readDocumentsManifest();
  const { existing } = ensureNoConflict(
    manifest,
    { slug, gostNumber: canonicalPackage.meta.gostNumber, fileHash },
    { replace: Boolean(options.replace) }
  );
  const now = new Date().toISOString();
  const legacyViewerPath = packageManifest.legacyViewerPath
    ? resolvePackagePath(packageDirectoryPath, packageManifest.legacyViewerPath)
    : '';
  const legacyViewerHtml = legacyViewerPath ? await readFile(legacyViewerPath, 'utf8') : '';
  const attachmentSourceDirectory = packageManifest.attachmentsDir
    ? resolvePackagePath(packageDirectoryPath, packageManifest.attachmentsDir)
    : '';
  const assetsSourceDirectory = packageManifest.assetsDir
    ? resolvePackagePath(packageDirectoryPath, packageManifest.assetsDir)
    : '';
  const packageAttachments = packageManifest.attachments.length
    ? packageManifest.attachments
    : (attachmentSourceDirectory && await pathExists(attachmentSourceDirectory)
      ? await collectPackageFileEntries(attachmentSourceDirectory, {
        baseRelativeDirectory: 'attachments',
        idPrefix: 'attachment',
        fallbackKind: 'attachment'
      })
      : []);
  const packageAssets = packageManifest.assets.length
    ? packageManifest.assets
    : (assetsSourceDirectory && await pathExists(assetsSourceDirectory)
      ? await collectPackageFileEntries(assetsSourceDirectory, {
        baseRelativeDirectory: 'assets',
        idPrefix: 'asset',
        fallbackKind: 'asset'
      })
      : []);
  const localMeta = enrichDocumentRecord({
    ...buildMetaFromCanonicalPackage(canonicalPackage, {
      fileHash,
      importedAt: existing?.importedAt ?? now,
      updatedAt: now
    }),
    sourceType: 'document-package',
    packageManifestUrl: `/docs/${slug}/package.json`,
    attachmentCount: packageAttachments.length,
    assetCount: packageAssets.length,
    editionCount: packageManifest.editions.length,
    editions: packageManifest.editions,
    attachments: packageAttachments,
    assets: packageAssets,
    attachmentsBaseUrl: packageAttachments.length ? `/docs/${slug}/attachments/` : '',
    assetsBaseUrl: packageAssets.length ? `/docs/${slug}/assets/` : '',
    hasLegacyViewer: Boolean(legacyViewerHtml),
    ...(legacyViewerHtml ? {
      viewerUrl: `/docs/${slug}/viewer.html`,
      legacyViewerUrl: `/docs/${slug}/viewer.html`
    } : {})
  });
  const finalDirectory = path.join(DOCS_DIR, slug);
  const stagingDirectory = path.join(DOCS_DIR, `.staging-${slug}-${Date.now()}`);
  const finalCanonicalDirectory = path.join(CONTENT_DOCS_DIR, slug);
  const stagingCanonicalDirectory = path.join(CONTENT_DOCS_DIR, `.staging-${slug}-${Date.now()}`);

  await mkdir(stagingDirectory, { recursive: true });
  await mkdir(stagingCanonicalDirectory, { recursive: true });

  try {
    await writeFile(
      path.join(stagingDirectory, 'meta.json'),
      `${JSON.stringify(localMeta, null, 2)}\n`,
      'utf8'
    );
    await writeFile(
      path.join(stagingDirectory, 'package.json'),
      `${JSON.stringify({ ...packageManifest, attachments: packageAttachments, assets: packageAssets }, null, 2)}\n`,
      'utf8'
    );
    if (legacyViewerHtml) {
      await writeFile(path.join(stagingDirectory, 'viewer.html'), legacyViewerHtml, 'utf8');
    }
    if (attachmentSourceDirectory && await pathExists(attachmentSourceDirectory)) {
      await cp(attachmentSourceDirectory, path.join(stagingDirectory, 'attachments'), { recursive: true });
    }
    if (assetsSourceDirectory && await pathExists(assetsSourceDirectory)) {
      await cp(assetsSourceDirectory, path.join(stagingDirectory, 'assets'), { recursive: true });
    }
    await writeFile(
      path.join(stagingCanonicalDirectory, 'document.json'),
      `${JSON.stringify(canonicalPackage, null, 2)}\n`,
      'utf8'
    );
    await writeFile(
      path.join(stagingCanonicalDirectory, 'package.json'),
      `${JSON.stringify({ ...packageManifest, attachments: packageAttachments, assets: packageAssets }, null, 2)}\n`,
      'utf8'
    );

    if (options.replace && await pathExists(finalDirectory)) {
      await archiveExistingDocument(slug);
    }

    if (options.replace && await pathExists(finalCanonicalDirectory)) {
      await archiveExistingCanonicalSource(slug);
    }

    await rename(stagingDirectory, finalDirectory);
    await rename(stagingCanonicalDirectory, finalCanonicalDirectory);
    await rebuildManifest();
    await archiveImportedSource(importSourcePath || packageDirectoryPath);
    return localMeta;
  } catch (error) {
    await rm(stagingDirectory, { recursive: true, force: true });
    await rm(stagingCanonicalDirectory, { recursive: true, force: true });
    throw error;
  }
}

async function resolveTargets(args) {
  if (args.includes('--all')) {
    const directoryEntries = await readdir(INCOMING_DIR, { withFileTypes: true }).catch(() => []);
    return directoryEntries
      .filter((entry) => (entry.isFile() && /\.(html|json)$/i.test(entry.name)) || entry.isDirectory())
      .map((entry) => path.join(INCOMING_DIR, entry.name));
  }

  return args.filter((argument) => !argument.startsWith('--'));
}

async function main() {
  const args = process.argv.slice(2);
  const replace = args.includes('--replace');
  const targets = await resolveTargets(args);

  if (targets.length === 0) {
    throw new Error('Не указан входной документ для импорта и в incoming нет файлов или пакетов для --all.');
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
