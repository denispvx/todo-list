# Совместимость инструментов

- Node.js 24 LTS закреплён в `.nvmrc` и `engines`.
- TypeScript 6 используется с typescript-eslint 8: его заявленный peer range — `>=4.8.4 <6.1.0`. Обновление на TypeScript 7 требует обновления линтера.
- Транзитивный minimatch закреплён через npm override на 11.0.1. Это исправленная версия для [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249); Node 24 входит в поддерживаемый диапазон. Зависимость используется инструментами разработки, не попадает в браузерный bundle.

При обновлении ESLint/typescript-eslint нужно проверить, можно ли убрать override. После изменения версий выполняются npm ci, lint, typecheck, тесты и build; обход peer-зависимостей через force/legacy-peer-deps не используется.
