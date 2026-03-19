import resources from '@shared/locales/app'
import LocaleManager from '@shared/locales/LocaleManager'

const localeManager = new LocaleManager({
  resources,
})

export const setupLocaleManager = (locale) => {
  localeManager.changeLanguageByLocale(locale)

  return localeManager
}

export const getI18n = () => {
  return localeManager.getI18n()
}
