# GOST Catalog Site

Сайт-каталог автономных HTML-viewer документов ГОСТ.

## Что реализовано

- каталог и главная страница работают только от `public/data/documents.json`;
- карточка документа доступна по маршруту `/doc/:slug`;
- viewer публикуются как отдельные автономные HTML по `/docs/:slug/viewer.html`;
- есть режим открытия в новой вкладке и встроенный просмотр через `iframe`;
- импорт нового viewer выполняется через `scripts/import-viewer.mjs`;
- локальные `meta.json`, общий `documents.json`, `stats.json` и `search-index.json` обновляются автоматически.

## Команды

```bash
npm install
npm run dev
npm run build
npm run import:all
```

Импорт одного файла:

```bash
node scripts/import-viewer.mjs ./incoming/gost-8784-75.html
```

Импорт всех файлов из `incoming`:

```bash
node scripts/import-viewer.mjs --all
```

## Замечания по маршрутам

Каталог использует client-side routing для `/`, `/catalog` и `/doc/:slug`.
Viewer документов не встраиваются в runtime каталога и остаются отдельными HTML-файлами.
