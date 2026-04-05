const BASE_URL = import.meta.env?.BASE_URL || '/';
const UNSAFE_PROTOCOL_PATTERN = /^(?:javascript|data|vbscript|file):/i;

function trimTrailingSlash(value) {
  return value.endsWith('/') && value !== '/' ? value.slice(0, -1) : value;
}

function ensureLeadingSlash(value) {
  return value.startsWith('/') ? value : `/${value}`;
}

export function safeDecodePathSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function getBaseUrl() {
  return BASE_URL;
}

export function stripBasePath(pathname) {
  const normalizedBase = trimTrailingSlash(BASE_URL);

  if (!normalizedBase || normalizedBase === '/') {
    return pathname || '/';
  }

  if (pathname === normalizedBase) {
    return '/';
  }

  if (pathname.startsWith(`${normalizedBase}/`)) {
    return pathname.slice(normalizedBase.length) || '/';
  }

  return pathname || '/';
}

export function withBase(pathname) {
  const normalizedPath = ensureLeadingSlash(pathname);

  if (BASE_URL === '/') {
    return normalizedPath;
  }

  return `${trimTrailingSlash(BASE_URL)}${normalizedPath}`;
}

export function normalizeDocumentUrl(pathname) {
  if (!pathname) {
    return 'about:blank';
  }

  const normalizedPath = String(pathname).trim();

  if (UNSAFE_PROTOCOL_PATTERN.test(normalizedPath) || normalizedPath.startsWith('//')) {
    return 'about:blank';
  }

  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath;
  }

  if (/^[?#]/.test(normalizedPath)) {
    return 'about:blank';
  }

  return withBase(normalizedPath);
}

function buildDocumentPath(slug, suffix = '') {
  const safeSlug = encodeURIComponent(String(slug ?? '').trim());
  return `/doc/${safeSlug}${suffix}`;
}

export function buildDocumentRoute(slug, hash = '') {
  return withBase(`${buildDocumentPath(slug)}${hash || ''}`);
}

export function buildDocumentCardRoute(slug) {
  return withBase(`${buildDocumentPath(slug)}?view=card`);
}

export function buildDocumentLegacyRoute(slug, hash = '') {
  return withBase(`${buildDocumentPath(slug, '/legacy')}${hash || ''}`);
}

export function buildDocumentPrintRoute(slug, hash = '') {
  return withBase(`${buildDocumentPath(slug, '/print')}${hash || ''}`);
}
