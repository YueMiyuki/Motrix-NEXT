<template>
  <div class="content panel panel-layout panel-layout--v">
    <header class="panel-header">
      <h4 class="hidden-xs-only">{{ title }}</h4>
      <mo-subnav-switcher :title="title" :subnavs="subnavs" class="hidden-sm-and-up" />
    </header>
    <mo-browser v-if="isRenderer" class="lab-webview" :src="url" />
  </div>
</template>

<script lang="ts">
import is from '@/shims/platform'
import { useAppStore } from '@/store/app'
import { usePreferenceStore } from '@/store/preference'

import { APP_THEME } from '@shared/constants'
import SubnavSwitcher from '@/components/Subnav/SubnavSwitcher.vue'
import Browser from '@/components/Browser/index.vue'

export default {
  name: 'mo-preference-lab',
  components: {
    [SubnavSwitcher.name]: SubnavSwitcher,
    [Browser.name]: Browser,
  },
  data() {
    const locale = ((usePreferenceStore().config as any) || {}).locale || 'en-US'
    return {
      locale,
    }
  },
  computed: {
    isRenderer: () => is.renderer(),
    systemTheme() {
      return useAppStore().systemTheme
    },
    config() {
      return usePreferenceStore().config
    },
    theme() {
      return (usePreferenceStore().config as any).theme
    },
    currentTheme() {
      if (this.theme === APP_THEME.AUTO) {
        return this.systemTheme
      } else {
        return this.theme
      }
    },
    url() {
      const { currentTheme, locale } = this
      const result = `https://motrix.app/lab?lite=true&theme=${currentTheme}&lang=${locale}`
      return result
    },
    title() {
      return this.$t('preferences.lab')
    },
    subnavs() {
      return [
        {
          key: 'basic',
          title: this.$t('preferences.basic'),
          route: '/preference/basic',
        },
        {
          key: 'advanced',
          title: this.$t('preferences.advanced'),
          route: '/preference/advanced',
        },
        {
          key: 'lab',
          title: this.$t('preferences.lab'),
          route: '/preference/lab',
        },
      ]
    },
  },
}
</script>
