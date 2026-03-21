import i18next from 'i18next'
import { getLanguage } from '@shared/locales'

export default class LocaleManager {
  private options: any

  constructor(options: any = {}) {
    this.options = options

    i18next.init({
      fallbackLng: 'en-US',
      resources: options.resources || {},
      initImmediate: false,
    })
  }

  async ensureLanguageResource(lng: string) {
    if (i18next.hasResourceBundle(lng, 'translation')) {
      return
    }

    const loadResource = this.options.loadResource
    if (typeof loadResource !== 'function') {
      return
    }

    const resource = await loadResource(lng)
    if (!resource || !resource.translation) {
      return
    }

    i18next.addResourceBundle(lng, 'translation', resource.translation, true, true)
  }

  async changeLanguage(lng: string) {
    await this.ensureLanguageResource(lng)
    return i18next.changeLanguage(lng)
  }

  async changeLanguageByLocale(locale: string) {
    const lng = getLanguage(locale)
    return this.changeLanguage(lng)
  }

  getI18n() {
    return i18next
  }
}
