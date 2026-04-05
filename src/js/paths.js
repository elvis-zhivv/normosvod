const BASE_URL = import.meta.env.BASE_URL || '/';

function trimTrailingSlash(value) {
  return value.endsWith('/') && value !== '/' ? value.slice(0, -1) : value;
}

function ensureLeadingSlash(value) {
  return value.startsWith('/') ? value : `/${value}`;
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
    return pathname;
  }

  if (/^(?:https?:)?\/\//i.test(pathname)) {
    return pathname;
  }

  return withBase(pathname);
}
