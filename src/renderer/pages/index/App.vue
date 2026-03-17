<template>
  <div id="app">
    <mo-title-bar
      v-if="isRenderer"
      :showActions="showWindowActions"
    />
    <router-view />
    <mo-engine-client
      :secret="rpcSecret"
    />
    <mo-ipc v-if="isRenderer" />
    <mo-dynamic-tray v-if="enableTraySpeedometer" />
  </div>
</template>

<script lang="ts">
  import is from 'electron-is'
  import { mapGetters, mapState } from 'vuex'
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
      [TitleBar.name]: TitleBar
    },
    computed: {
      isMac: () => is.macOS(),
      isRenderer: () => is.renderer(),
      ...(mapState as any)('app', {
        systemTheme: (state: any) => state.systemTheme
      }),
      ...(mapState as any)('preference', {
        showWindowActions: state => {
          return (is.windows() || is.linux()) && state.config.hideAppMenu
        },
        runMode: (state: any) => state.config.runMode,
        traySpeedometer: (state: any) => state.config.traySpeedometer,
        rpcSecret: (state: any) => state.config.rpcSecret
      }),
      ...(mapGetters as any)('preference', [
        'theme',
        'locale',
        'direction'
      ]),
      themeClass () {
        if (this.theme === APP_THEME.AUTO) {
          return `theme-${this.systemTheme}`
        } else {
          return `theme-${this.theme}`
        }
      },
      i18nClass () {
        return `i18n-${this.locale}`
      },
      directionClass () {
        return `dir-${this.direction}`
      },
      enableTraySpeedometer () {
        const { isMac, isRenderer, traySpeedometer, runMode } = this
        return isMac && isRenderer && traySpeedometer && runMode !== APP_RUN_MODE.HIDE_TRAY
      }
    },
    methods: {
      updateRootClassName () {
        const { themeClass = '', i18nClass = '', directionClass = '' } = this
        const className = `${themeClass} ${i18nClass} ${directionClass}`
        document.documentElement.className = className
      }
    },
    beforeMount () {
      this.updateRootClassName()
    },
    watch: {
      locale (val) {
        const lng = getLanguage(val)
        getLocaleManager().changeLanguage(lng)
      },
      themeClass () {
        this.updateRootClassName()
      },
      i18nClass () {
        this.updateRootClassName()
      },
      directionClass () {
        this.updateRootClassName()
      }
    }
  }
</script>

<style>
</style>
