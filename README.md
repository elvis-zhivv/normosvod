# GOST Catalog Site

Сайт-каталог автономных HTML-viewer документов ГОСТ.

## Что реализовано

- каталог и главная страница работают от `public/data/documents.json`, `stats.json` и `search-index.json`;
- карточка документа доступна по маршруту `/doc/:slug`;
- viewer публикуются как отдельные автономные HTML по `/docs/:slug/viewer.html`;
- полнотекстовый поиск работает по `public/data/search-index.json` с ранжированием результатов и переходом к лучшему совпадению;
- есть режим открытия в новой вкладке и встроенный просмотр через `iframe`;
- импорт нового viewer выполняется через `scripts/import-viewer.mjs`;
- локальные `meta.json`, общий `documents.json`, `stats.json` и `search-index.json` обновляются автоматически.

## Команды

```bash
npm install
npm run dev
npm run build
npm run build:reg
npm run build:pages
npm run deploy:pack
npm run deploy:ssh
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

Базовая публикация изменений в git:

```bash
git add .
git commit -m "your message"
git push origin main
```

## Деплой на Reg.ru

Для обычного Linux-хостинга Reg.ru с `ispmanager` проект публикуется как статический сайт:

1. Соберите сайт под корень домена:

```bash
npm run build:reg
```

2. Загрузите содержимое папки `dist` в корень сайта `normosvod.ru` через `Менеджер файлов` или FTP.
3. Файл `dist/.htaccess` нужно загрузить вместе с остальными файлами. Он включает rewrite для маршрутов `/catalog` и `/doc/:slug`.

### Вариант 1. Архив для файлового менеджера

```bash
npm run deploy:pack
```

Команда:

- собирает `dist`;
- создаёт zip-архив в `archive/deploy/`;
- этот архив можно загрузить в `www/<домен>/` через `ispmanager` и распаковать на сервере.

### Вариант 2. Выкладка по SSH/SCP

1. Скопируйте `.env.example` в `.env`.
2. Заполните параметры:

```bash
REG_HOST=server204.hosting.reg.ru
REG_PORT=22
REG_USER=ваш_логин_хостинга
REG_REMOTE_PATH=www/normosvod.ru
```

3. Запустите:

```bash
npm run deploy:ssh
```

Команда:

- собирает `dist`;
- подключается по `ssh`;
- создаёт удалённую папку, если её ещё нет;
- загружает `assets`, `data`, `docs`, `index.html`, `404.html` и `.htaccess` по `scp`.

### Вариант 3. Автодеплой из GitHub Actions

В проект добавлен workflow [deploy-reg-ru.yml](d:/normosvod/.github/workflows/deploy-reg-ru.yml). Он запускается по `push` в `main` и выкладывает сайт на Reg.ru.

Перед этим нужно добавить в `GitHub -> Settings -> Secrets and variables -> Actions` следующие secrets:

```text
REG_HOST=server204.hosting.reg.ru
REG_PORT=22
REG_USER=u3474399
REG_REMOTE_PATH=www/normosvod.ru
REG_SSH_KEY=<приватный SSH-ключ для деплоя>
```

Рекомендуемый порядок:

1. Создать отдельный SSH-ключ для GitHub Actions.
2. Добавить его публичную часть в `~/.ssh/authorized_keys` на хостинге Reg.ru.
3. Приватную часть сохранить в `REG_SSH_KEY`.
4. После этого каждый `git push origin main` будет автоматически запускать деплой.

Важно:

- загружать нужно содержимое `dist`, а не саму папку `dist`;
- при публикации на корень домена базовый путь должен быть `/`, это уже режим по умолчанию для `build:reg`;
- viewer-файлы из `dist/docs/...` должны копироваться без изменений.
- `.env` уже исключён из git и подходит для хранения локальных настроек выкладки.

## Деплой на GitHub Pages

В проекте уже добавлен workflow [deploy-pages.yml](d:/normosvod/.github/workflows/deploy-pages.yml), рассчитанный на публикацию репозитория `normosvod` как GitHub Pages project site.

Что нужно включить в GitHub:

1. `Settings -> Pages`
2. `Source: GitHub Actions`

После этого каждый push в `main` будет публиковать `dist` на Pages. Для Pages используется базовый путь `/normosvod/`, он задаётся переменной `BASE_PATH` в workflow.

## Замечания по маршрутам

Каталог использует client-side routing для `/`, `/catalog` и `/doc/:slug`.
Viewer документов не встраиваются в runtime каталога и остаются отдельными HTML-файлами.
