import { invoke } from '@tauri-apps/api/core'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import logger from '@shared/utils/logger'
import { createApp } from 'vue'
import axios from 'axios'
import VueVirtualScroller from 'vue-virtual-scroller'

import App from './App.vue'
import router from '@/router'
import store from '@/store'
import { getLocaleManager } from '@/components/Locale'
import Msg from '@/components/Msg'
import { commands } from '@/components/CommandManager/instance'
import { usePreferenceStore } from '@/store/preference'
import UiRow from '@/components/ui/Row.vue'
import UiCol from '@/components/ui/Col.vue'
import UiProgress from '@/components/ui/compat/UiProgress.vue'
import UiTooltip from '@/components/ui/compat/UiTooltip.vue'
import UiCheckbox from '@/components/ui/compat/UiCheckbox.vue'
import UiSwitch from '@/components/ui/compat/UiSwitch.vue'
import UiButton from '@/components/ui/compat/UiButton.vue'
import TrayWorker from '@/workers/tray.worker?worker'
import './commands'

import '@/styles/app.css'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import 'vue-sonner/style.css'

const updateTray = (payload: any) => {
  const { rgba, width, height } = payload
  if (!rgba) return

  invoke('update_tray', { imageData: rgba, width, height }).catch((err) => {
    logger.warn('[Motrix] update_tray failed:', err)
  })
}
function initTrayWorker() {
  const worker = new TrayWorker()

  worker.addEventListener('message', (event) => {
    const { type, payload } = event.data

    switch (type) {
      case 'initialized':
      case 'log':
        logger.log('[Motrix] Log from Tray Worker: ', payload)
        break
      case 'tray:drawed':
        updateTray(payload)
        break
      default:
        logger.warn('[Motrix] Tray Worker unhandled message type:', type, payload)
    }
  })

  return worker
}

async function init(config: any) {
  const locale = (config && config.locale) || 'en-US'
  const localeManager = getLocaleManager()
  await localeManager.changeLanguageByLocale(locale)
  const i18n = localeManager.getI18n()

  const app = createApp(App)
  app.use(store)
  app.use(router)
  app.use(VueVirtualScroller)
  app.use(Msg, {
    showClose: true,
  })
  app.component('ui-row', UiRow)
  app.component('ui-col', UiCol)
  app.component('ui-progress', UiProgress)
  app.component('ui-tooltip', UiTooltip)
  app.component('ui-checkbox', UiCheckbox)
  app.component('ui-switch', UiSwitch)
  app.component('ui-button', UiButton)
  app.config.globalProperties.$http = axios
  app.config.globalProperties.$t = (key: string, value?: any) => i18n.t(key, value)

  router.isReady().then(() => {
    ;(window as any).__app = app.mount('#app') as any
    ;(window as any).__app.commands = commands
    ;(window as any).__app.trayWorker = initTrayWorker()

    // Show the window after mount to avoid a white flash.
    getCurrentWebviewWindow()
      .show()
      .catch(() => {})
  })
}

usePreferenceStore()
  .fetchPreference()
  .then((config) => {
    logger.info('[Motrix] load preference:', config)
    init(config)
  })
  .catch((err) => {
    alert(err)
  })
