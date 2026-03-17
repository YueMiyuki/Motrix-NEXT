<template>
  <div style="display: none;">
    <img
      id="tray-icon-light-normal"
      :src="trayIconLightNormal"
    >
    <img
      id="tray-icon-light-active"
      :src="trayIconLightActive"
    >
    <img
      id="tray-icon-dark-normal"
      :src="trayIconDarkNormal"
    >
    <img
      id="tray-icon-dark-active"
      :src="trayIconDarkActive"
    >
  </div>
</template>

<script lang="ts">
  import { mapState } from 'vuex'
  import trayIconLightNormal from '@static/mo-tray-light-normal@2x.png'
  import trayIconLightActive from '@static/mo-tray-light-active@2x.png'
  import trayIconDarkNormal from '@static/mo-tray-dark-normal@2x.png'
  import trayIconDarkActive from '@static/mo-tray-dark-active@2x.png'

  import { getInverseTheme } from '@shared/utils'
  import { APP_THEME } from '@shared/constants'

  const cache = {}

  export default {
    name: 'mo-dynamic-tray',
    data () {
      return {
        trayIconLightNormal,
        trayIconLightActive,
        trayIconDarkNormal,
        trayIconDarkActive
      }
    },
    computed: {
      ...(mapState as any)('app', {
        iconStatus: (state: any) => state.stat.numActive > 0 ? 'active' : 'normal',
        theme: (state: any) => state.systemTheme,
        focused: (state: any) => state.trayFocused,
        uploadSpeed: (state: any) => state.stat.uploadSpeed,
        downloadSpeed: (state: any) => state.stat.downloadSpeed,
        speed: (state: any) => state.stat.uploadSpeed + state.stat.downloadSpeed
      }),
      scale () {
        return 2
      },
      currentTheme () {
        const { theme, focused } = this
        if (theme === APP_THEME.DARK) {
          return theme
        }

        return focused ? getInverseTheme(theme) : theme
      },
      iconKey () {
        const { bigSur, iconStatus, currentTheme } = this
        return bigSur ? 'tray-icon-light-normal' : `tray-icon-${currentTheme}-${iconStatus}`
      }
    },
    watch: {
      async speed (val) {
        await this.drawTray()
      },
      async iconKey (val) {
        await this.drawTray()
      }
    },
    mounted () {
      setTimeout(async () => {
        await this.drawTray()
      }, 200)
    },
    methods: {
      async getIcon (key) {
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
      async drawTray () {
        const {
          currentTheme: theme,
          uploadSpeed,
          downloadSpeed,
          scale,
          iconKey
        } = this

        const icon = await this.getIcon(iconKey)
        if (!icon) {
          return
        }

        (global.app as any).trayWorker.postMessage({
          type: 'tray:draw',
          payload: {
            theme,
            icon,
            uploadSpeed,
            downloadSpeed,
            scale
          }
        })
      }
    }
  }
</script>
