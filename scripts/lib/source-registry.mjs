const SOURCE_REGISTRY = {
  'html-viewer': {
    id: 'html-viewer',
    label: 'Legacy HTML viewer',
    category: 'legacy',
    allowsImplicitLegacyViewer: true,
    supportsCanonicalDocument: false,
    supportsPackageManifest: false,
    supportsEditions: false,
    supportsAttachments: false,
    supportsAssets: false
  },
  'canonical-document': {
    id: 'canonical-document',
    label: 'Canonical document',
    category: 'canonical',
    allowsImplicitLegacyViewer: false,
    supportsCanonicalDocument: true,
    supportsPackageManifest: false,
    supportsEditions: false,
    supportsAttachments: false,
    supportsAssets: false
  },
  'document-package': {
    id: 'document-package',
    label: 'Document package',
    category: 'package',
    allowsImplicitLegacyViewer: false,
    supportsCanonicalDocument: true,
    supportsPackageManifest: true,
    supportsEditions: true,
    supportsAttachments: true,
    supportsAssets: true
  }
};

export function normalizeSourceType(value) {
  return SOURCE_REGISTRY[value] ? value : 'html-viewer';
}

export function getSourceProfile(sourceType) {
  return SOURCE_REGISTRY[normalizeSourceType(sourceType)];
}

export function applySourceProfile(record) {
  const profile = getSourceProfile(record?.sourceType);

  return {
    ...record,
    sourceType: profile.id,
    sourceLabel: record?.sourceLabel || profile.label,
    sourceCategory: record?.sourceCategory || profile.category,
    supportsCanonicalDocument: record?.supportsCanonicalDocument ?? profile.supportsCanonicalDocument,
    supportsPackageManifest: record?.supportsPackageManifest ?? profile.supportsPackageManifest,
    supportsEditions: record?.supportsEditions ?? profile.supportsEditions,
    supportsAttachments: record?.supportsAttachments ?? profile.supportsAttachments,
    supportsAssets: record?.supportsAssets ?? profile.supportsAssets
  };
}
