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

const updateTrayMenuLabels = (i18n: any) => {
  const labels = {
    'tray-new-task': i18n.t('task.new-task'),
    'tray-new-bt-task': i18n.t('task.new-bt-task'),
    'tray-open-file': i18n.t('task.open-file'),
    'tray-show': i18n.t('app.show'),
    'tray-manual': i18n.t('help.manual'),
    'tray-check-updates': i18n.t('app.check-for-updates'),
    'tray-task-list': i18n.t('app.task-list'),
    'tray-preferences': i18n.t('app.preferences'),
    'tray-quit': i18n.t('app.quit'),
  }

  invoke('update_tray_menu_labels', { labels }).catch((err) => {
    logger.warn('[Motrix] update_tray_menu_labels failed:', err)
  })
}

const updateAppMenuLabels = (i18n: any) => {
  const labels = {
    'menu-app': i18n.t('menu.app'),
    'menu-file': i18n.t('menu.file'),
    'menu-task': i18n.t('menu.task'),
    'menu-edit': i18n.t('menu.edit'),
    'menu-window': i18n.t('menu.window'),
    'menu-help': i18n.t('menu.help'),
    about: i18n.t('app.about'),
    preferences: i18n.t('app.preferences'),
    'check-for-updates': i18n.t('app.check-for-updates'),
    'show-window': i18n.t('app.show'),
    quit: i18n.t('app.quit'),
    reload: i18n.t('window.reload'),
    front: i18n.t('window.front'),
    'new-task': i18n.t('task.new-task'),
    'new-bt-task': i18n.t('task.new-bt-task'),
    'open-file': i18n.t('task.open-file'),
    'task-list': i18n.t('app.task-list'),
    'pause-task': i18n.t('task.pause-task'),
    'resume-task': i18n.t('task.resume-task'),
    'delete-task': i18n.t('task.delete-task'),
    'move-task-up': i18n.t('task.move-task-up'),
    'move-task-down': i18n.t('task.move-task-down'),
    'pause-all-task': i18n.t('task.pause-all-task'),
    'resume-all-task': i18n.t('task.resume-all-task'),
    'select-all-task': i18n.t('task.select-all-task'),
    'clear-recent-tasks': i18n.t('task.clear-recent-tasks'),
    'official-website': i18n.t('help.official-website'),
    manual: i18n.t('help.manual'),
    'release-notes': i18n.t('help.release-notes'),
    'report-problem': i18n.t('help.report-problem'),
    'toggle-dev-tools': i18n.t('help.toggle-dev-tools'),
  }

  invoke('update_app_menu_labels', { labels }).catch((err) => {
    logger.warn('[Motrix] update_app_menu_labels failed:', err)
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
  updateAppMenuLabels(i18n)
  updateTrayMenuLabels(i18n)

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

  router.isReady().then(async () => {
    ;(window as any).__app = app.mount('#app') as any
    ;(window as any).__app.commands = commands
    ;(window as any).__app.trayWorker = initTrayWorker()

    // Show the window after mount to avoid a white flash.
    // Skip showing if launched at login (auto-start).
    const isOpenedAtLogin = await invoke('is_opened_at_login').catch(() => false)
    if (!isOpenedAtLogin) {
      getCurrentWebviewWindow()
        .show()
        .catch(() => {})
    }
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
