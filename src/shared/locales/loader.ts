import appLocaleEnUS from '@shared/locales/en-US'

const localeLoaders = {
  ar: () => import('@shared/locales/ar'),
  bg: () => import('@shared/locales/bg'),
  ca: () => import('@shared/locales/ca'),
  de: () => import('@shared/locales/de'),
  el: () => import('@shared/locales/el'),
  'en-US': () => import('@shared/locales/en-US'),
  es: () => import('@shared/locales/es'),
  fa: () => import('@shared/locales/fa'),
  fr: () => import('@shared/locales/fr'),
  hu: () => import('@shared/locales/hu'),
  id: () => import('@shared/locales/id'),
  it: () => import('@shared/locales/it'),
  ja: () => import('@shared/locales/ja'),
  ko: () => import('@shared/locales/ko'),
  nb: () => import('@shared/locales/nb'),
  nl: () => import('@shared/locales/nl'),
  pl: () => import('@shared/locales/pl'),
  'pt-BR': () => import('@shared/locales/pt-BR'),
  ro: () => import('@shared/locales/ro'),
  ru: () => import('@shared/locales/ru'),
  th: () => import('@shared/locales/th'),
  tr: () => import('@shared/locales/tr'),
  uk: () => import('@shared/locales/uk'),
  vi: () => import('@shared/locales/vi'),
  'zh-CN': () => import('@shared/locales/zh-CN'),
  'zh-TW': () => import('@shared/locales/zh-TW'),
} as const

export type LocaleKey = keyof typeof localeLoaders

export const getInitialLocaleResources = () => {
  return {
    'en-US': {
      translation: { ...appLocaleEnUS },
    },
  }
}

export const loadLocaleResource = async (locale: string) => {
  const lng = locale in localeLoaders ? (locale as LocaleKey) : 'en-US'
  const loader = localeLoaders[lng]
  const mod = await loader()
  return {
    translation: { ...mod.default },
  }
}
