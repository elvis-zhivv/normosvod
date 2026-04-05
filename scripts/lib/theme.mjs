function normalizeThemeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е');
}

const THEME_RULES = [
  {
    id: 'coatings',
    patterns: [
      'лакокрас',
      'покрыт',
      'цвет',
      'метамери',
      'укрывист',
      'испытан'
    ]
  },
  {
    id: 'fire-safety',
    patterns: [
      'пожар',
      'огне',
      'эвакуац',
      'горюч',
      'дым'
    ]
  },
  {
    id: 'construction',
    patterns: [
      'строит',
      'инженер',
      'конструкц',
      'монтаж',
      'проект',
      'здание'
    ]
  },
  {
    id: 'regulation',
    patterns: [
      'стандартиз',
      'регулирован',
      'норматив',
      'правил',
      'порядок',
      'применени',
      'федерал',
      'закон'
    ]
  }
];

export function inferThemeId(document) {
  const haystack = normalizeThemeText([
    document?.gostNumber,
    document?.title,
    document?.shortTitle,
    document?.description,
    ...(document?.tags ?? [])
  ].join(' '));

  for (const rule of THEME_RULES) {
    if (rule.patterns.some((pattern) => haystack.includes(pattern))) {
      return rule.id;
    }
  }

  return 'regulation';
}
