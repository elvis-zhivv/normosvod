export function canUseDefaultV2Reader(document) {
  if (!document?.canonicalDocumentUrl) {
    return false;
  }

  return document.readerMode === 'v2' || document.readerMode === 'hybrid';
}

export function shouldOpenV2Reader(document, requestedView = '') {
  if (!document?.canonicalDocumentUrl) {
    return false;
  }

  if (requestedView === 'v2') {
    return true;
  }

  if (requestedView === 'card') {
    return false;
  }

  return canUseDefaultV2Reader(document);
}
