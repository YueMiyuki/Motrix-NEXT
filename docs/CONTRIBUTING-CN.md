# Motrix 贡献指南

开始贡献之前，确保你已经理解了 [GitHub 的协作流程](https://guides.github.com/introduction/flow/)。

## 🌍 翻译指南

首先你要确定一个语言的英文简写作为 **locale**，如 en-US，这个 locale 值请严格参考 [Electron 的 Locales 文档](https://www.electronjs.org/docs/api/app#appgetlocale) 和 [Chromium 源代码](https://source.chromium.org/chromium/chromium/src/+/main:ui/base/l10n/l10n_util.cc)。

Motrix 使用 [i18next](https://www.i18next.com/overview/getting-started) 作为翻译支持库，所以你可能需要简单了解一下它的使用方法。

配置文件按照语言 (**locale**) 划分目录：`src/shared/locales`，如：`src/shared/locales/en-US` 和 `src/shared/locales/zh-CN`。

每个语言目录下按功能模块划分 TypeScript 文件：

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

菜单的国际化已经打散到了以上文件里，不再需要复制 `src/main/menus` 里的配置。
