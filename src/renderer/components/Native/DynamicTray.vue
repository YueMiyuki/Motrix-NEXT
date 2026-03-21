<template>
  <div style="display: none">
    <img id="tray-icon-light-normal" :src="trayIconLightNormal" />
    <img id="tray-icon-light-active" :src="trayIconLightActive" />
    <img id="tray-icon-dark-normal" :src="trayIconDarkNormal" />
    <img id="tray-icon-dark-active" :src="trayIconDarkActive" />
  </div>
</template>

<script lang="ts">
import { useAppStore } from '@/store/app'
import trayIconLightNormal from '@static/mo-tray-light-normal@2x.png'
import trayIconLightActive from '@static/mo-tray-light-active@2x.png'
import trayIconDarkNormal from '@static/mo-tray-dark-normal@2x.png'
import trayIconDarkActive from '@static/mo-tray-dark-active@2x.png'

import { getInverseTheme } from '@shared/utils'
import { APP_THEME } from '@shared/constants'

const cache: Record<string, ImageBitmap> = {}

export default {
  name: 'mo-dynamic-tray',
  data() {
    return {
      trayIconLightNormal,
      trayIconLightActive,
      trayIconDarkNormal,
      trayIconDarkActive,
    }
  },
  computed: {
    iconStatus() {
      return useAppStore().stat.numActive > 0 ? 'active' : 'normal'
    },
    theme() {
      return useAppStore().systemTheme
    },
    focused() {
      return useAppStore().trayFocused
    },
    uploadSpeed() {
      return useAppStore().stat.uploadSpeed
    },
    downloadSpeed() {
      return useAppStore().stat.downloadSpeed
    },
    speed() {
      return useAppStore().stat.uploadSpeed + useAppStore().stat.downloadSpeed
    },
    scale() {
      return 2
    },
    currentTheme() {
      const { theme, focused } = this
      if (theme === APP_THEME.DARK) {
        return theme
      }
      return focused ? getInverseTheme(theme) : theme
    },
    iconKey() {
      const { bigSur, iconStatus, currentTheme } = this
      return bigSur ? 'tray-icon-light-normal' : `tray-icon-${currentTheme}-${iconStatus}`
    },
  },
  watch: {
    async speed() {
      await this.drawTray()
    },
    async iconKey() {
      await this.drawTray()
    },
  },
  mounted() {
    setTimeout(async () => {
      await this.drawTray()
    }, 200)
  },
  methods: {
    async getIcon(key: string): Promise<ImageBitmap | null> {
      if (cache[key]) {
        return cache[key]
      }

      const iconImage = document.getElementById(key) as HTMLImageElement | null
      if (!iconImage) {
        return null
      }

      const result = await createImageBitmap(iconImage)
      cache[key] = result
      return result
    },
    async drawTray() {
      const { currentTheme: theme, uploadSpeed, downloadSpeed, scale, iconKey } = this

      const icon = await this.getIcon(iconKey)
      if (!icon) {
        return
      }

      ;(window as any).__app.trayWorker.postMessage({
        type: 'tray:draw',
        payload: {
          theme,
          icon,
          uploadSpeed,
          downloadSpeed,
          scale,
        },
      })
    },
  },
}
</script>
