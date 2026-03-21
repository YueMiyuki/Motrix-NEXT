import LocaleManager from '@shared/locales/LocaleManager'
import { getInitialLocaleResources, loadLocaleResource } from '@shared/locales/loader'

const localeManager = new LocaleManager({
  resources: getInitialLocaleResources(),
  loadResource: loadLocaleResource,
})

export function getLocaleManager() {
  return localeManager
}
