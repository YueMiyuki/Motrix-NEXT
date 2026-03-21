<template>
  <div id="app">
    <mo-title-bar v-if="isRenderer" :showActions="showWindowActions" />
    <router-view />
    <mo-engine-client :secret="rpcSecret" />
    <mo-ipc v-if="isRenderer" />
    <mo-dynamic-tray v-if="enableTraySpeedometer" />
    <Teleport to="body">
      <Toaster
        position="top-center"
        :theme="themeClass === 'dark' ? 'dark' : 'light'"
        rich-colors
      />
    </Teleport>
  </div>
</template>

<script lang="ts">
import is from '@/shims/platform'
import { Toaster } from '@/components/ui/sonner'
import { useAppStore } from '@/store/app'
import { usePreferenceStore } from '@/store/preference'
import { APP_RUN_MODE, APP_THEME } from '@shared/constants'
import DynamicTray from '@/components/Native/DynamicTray.vue'
import EngineClient from '@/components/Native/EngineClient.vue'
import Ipc from '@/components/Native/Ipc.vue'
import TitleBar from '@/components/Native/TitleBar.vue'
import { getLanguage } from '@shared/locales'
import { getLocaleManager } from '@/components/Locale'

export default {
  name: 'motrix-app',
  components: {
    [DynamicTray.name]: DynamicTray,
    [EngineClient.name]: EngineClient,
    [Ipc.name]: Ipc,
    [TitleBar.name]: TitleBar,
    Toaster,
  },
  computed: {
    isMac: () => is.macOS(),
    isRenderer: () => is.renderer(),
    systemTheme() {
      return useAppStore().systemTheme
    },
    showWindowActions() {
      return is.windows() || is.linux()
    },
    runMode() {
      return (usePreferenceStore().config as any).runMode
    },
    traySpeedometer() {
      return (usePreferenceStore().config as any).traySpeedometer
    },
    rpcSecret() {
      return (usePreferenceStore().config as any).rpcSecret
    },
    theme() {
      return usePreferenceStore().theme
    },
    locale() {
      return usePreferenceStore().locale
    },
    direction() {
      return usePreferenceStore().direction
    },
    themeClass() {
      const effectiveTheme = this.theme === APP_THEME.AUTO ? this.systemTheme : this.theme
      return effectiveTheme === APP_THEME.DARK ? 'dark' : ''
    },
    i18nClass() {
      return `i18n-${this.locale}`
    },
    directionClass() {
      return `dir-${this.direction}`
    },
    enableTraySpeedometer() {
      const { isMac, isRenderer, traySpeedometer, runMode } = this
      return isMac && isRenderer && traySpeedometer && runMode !== APP_RUN_MODE.HIDE_TRAY
    },
  },
  methods: {
    updateRootClassName() {
      const { themeClass = '', i18nClass = '', directionClass = '' } = this
      const className = `${themeClass} ${i18nClass} ${directionClass}`
      document.documentElement.className = className
    },
  },
  beforeMount() {
    this.updateRootClassName()
  },
  watch: {
    locale(val, oldVal) {
      const lng = getLanguage(val)
      getLocaleManager().changeLanguage(lng)
      if (!oldVal || oldVal === val) {
        return
      }
      // Force a full renderer refresh so all views pick up the new locale.
      window.setTimeout(() => {
        window.location.reload()
      }, 0)
    },
    themeClass() {
      this.updateRootClassName()
    },
    i18nClass() {
      this.updateRootClassName()
    },
    directionClass() {
      this.updateRootClassName()
    },
  },
}
</script>
