<template>
  <div class="main panel panel-layout panel-layout--h">
    <aside class="subnav hidden-xs-only subnav-pane">
      <router-view name="subnav" />
    </aside>
    <router-view name="form" v-slot="{ Component, route }">
      <Transition name="page" mode="out-in">
        <component :is="Component" :key="route.path" class="pref-form-view" />
      </Transition>
    </router-view>
  </div>
</template>

<script lang="ts">
import { usePreferenceStore } from '@/store/preference'

export default {
  name: 'mo-content-preference',
  created() {
    usePreferenceStore().fetchPreference()
  },
}
</script>
