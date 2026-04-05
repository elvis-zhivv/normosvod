const CYRILLIC_MAP = new Map([
  ['а', 'a'], ['б', 'b'], ['в', 'v'], ['г', 'g'], ['д', 'd'], ['е', 'e'], ['ё', 'e'],
  ['ж', 'zh'], ['з', 'z'], ['и', 'i'], ['й', 'i'], ['к', 'k'], ['л', 'l'], ['м', 'm'],
  ['н', 'n'], ['о', 'o'], ['п', 'p'], ['р', 'r'], ['с', 's'], ['т', 't'], ['у', 'u'],
  ['ф', 'f'], ['х', 'h'], ['ц', 'c'], ['ч', 'ch'], ['ш', 'sh'], ['щ', 'sch'], ['ъ', ''],
  ['ы', 'y'], ['ь', ''], ['э', 'e'], ['ю', 'yu'], ['я', 'ya']
]);

function transliterate(input) {
  return Array.from(String(input ?? ''))
    .map((character) => CYRILLIC_MAP.get(character) ?? character)
    .join('');
}

export function buildSlug(value) {
  const transliterated = transliterate(String(value ?? '').toLowerCase().replace(/№/g, ''));

  return transliterated
    .replace(/[—–−]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
