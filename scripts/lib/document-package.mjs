import path from 'node:path';

const PACKAGE_KIND = 'normosvod-document-package';
export const PACKAGE_MANIFEST_FILENAME = 'normosvod-package.json';

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return String(value ?? '').trim();
}

function toPosixRelativePath(value) {
  return normalizeString(value).replace(/\\/g, '/');
}

export function resolvePackagePath(baseDirectory, relativePath) {
  const normalized = toPosixRelativePath(relativePath);

  if (!normalized) {
    return '';
  }

  const resolved = path.resolve(baseDirectory, normalized);
  const relativeToBase = path.relative(baseDirectory, resolved);

  if (relativeToBase.startsWith('..') || path.isAbsolute(relativeToBase)) {
    throw new Error(`Package path выходит за пределы пакета: ${relativePath}`);
  }

  return resolved;
}

function normalizeEdition(item, index) {
  const label = normalizeString(item?.label || item?.title || item?.id || `Редакция ${index + 1}`);

  return {
    id: normalizeString(item?.id || `edition-${index + 1}`),
    label,
    status: normalizeString(item?.status || 'reference'),
    effectiveDate: normalizeString(item?.effectiveDate || item?.date || ''),
    notes: normalizeString(item?.notes || item?.description || '')
  };
}

function normalizeAttachment(item, index) {
  const filePath = toPosixRelativePath(item?.path || item?.file || '');

  if (!filePath) {
    throw new Error(`Attachment ${index + 1} не содержит path.`);
  }

  return {
    id: normalizeString(item?.id || `attachment-${index + 1}`),
    path: filePath,
    label: normalizeString(item?.label || path.basename(filePath)),
    kind: normalizeString(item?.kind || 'attachment')
  };
}

function normalizeAsset(item, index) {
  const filePath = toPosixRelativePath(item?.path || item?.file || '');

  if (!filePath) {
    throw new Error(`Asset ${index + 1} не содержит path.`);
  }

  return {
    id: normalizeString(item?.id || `asset-${index + 1}`),
    path: filePath,
    label: normalizeString(item?.label || path.basename(filePath)),
    kind: normalizeString(item?.kind || path.extname(filePath).replace(/^\./, '') || 'asset')
  };
}

export function normalizeDocumentPackageManifest(rawManifest, defaults = {}) {
  const manifest = rawManifest && typeof rawManifest === 'object' ? rawManifest : {};
  const kind = normalizeString(manifest.kind || PACKAGE_KIND);

  if (kind !== PACKAGE_KIND) {
    throw new Error(`Package manifest должен иметь kind="${PACKAGE_KIND}".`);
  }

  const documentPath = toPosixRelativePath(manifest.documentPath || defaults.documentPath || 'document.json');

  if (!documentPath) {
    throw new Error('Package manifest не содержит documentPath.');
  }

  const legacyViewerPath = toPosixRelativePath(manifest.legacyViewerPath || defaults.legacyViewerPath || '');
  const attachmentsDir = toPosixRelativePath(manifest.attachmentsDir || defaults.attachmentsDir || '');
  const assetsDir = toPosixRelativePath(manifest.assetsDir || defaults.assetsDir || '');
  const attachments = normalizeArray(manifest.attachments).map(normalizeAttachment);
  const assets = normalizeArray(manifest.assets).map(normalizeAsset);
  const editions = normalizeArray(manifest.editions).map(normalizeEdition);

  return {
    kind: PACKAGE_KIND,
    version: normalizeString(manifest.version || '0.1.0'),
    packageId: normalizeString(manifest.packageId || defaults.packageId || ''),
    slug: normalizeString(manifest.slug || defaults.slug || ''),
    documentPath,
    legacyViewerPath,
    attachmentsDir,
    assetsDir,
    attachments,
    assets,
    editions,
    description: normalizeString(manifest.description || '')
  };
}
