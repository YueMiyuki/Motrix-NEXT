# Motrix Contributing Guide

Before you start contributing, make sure you already understand [GitHub flow](https://guides.github.com/introduction/flow/).

## 🌍 Translation Guide

First you need to determine the English abbreviation of a language as **locale**, such as en-US, this locale value should strictly refer to the [Electron's Documentation](https://www.electronjs.org/docs/api/app#appgetlocale) and [Chromium Source Code](https://source.chromium.org/chromium/chromium/src/+/main:ui/base/l10n/l10n_util.cc).

Motrix uses the [i18next](https://www.i18next.com/overview/getting-started) library for internationalization, so you may want a quick look at how to use it.

The locale files are organized by language under `src/shared/locales`, e.g. `src/shared/locales/en-US` and `src/shared/locales/zh-CN`.

Each locale directory contains TypeScript files split by feature area:

- about.ts
- app.ts
- edit.ts
- help.ts
- index.ts
- menu.ts
- preferences.ts
- subnav.ts
- task.ts
- window.ts

Menu translations live in these same files (not in `src/main/menus`).
