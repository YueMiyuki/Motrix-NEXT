<template>
  <div class="subnav-switch">
    <h4 class="subnav-title">{{ title }}</h4>
    <div class="subnav-select-wrap">
      <select
        class="subnav-select"
        :value="currentRoute"
        @change="handleRoute($event.target.value)"
      >
        <option v-for="sn in subnavs" :key="sn.key" :value="sn.route">
          {{ sn.title }}
        </option>
      </select>
      <ChevronDown :size="14" class="subnav-select-arrow" />
    </div>
  </div>
</template>

<script lang="ts">
import { ChevronDown } from 'lucide-vue-next'

export default {
  name: 'mo-subnav-switcher',
  components: {
    ChevronDown,
  },
  props: {
    title: {
      type: String,
    },
    subnavs: {
      type: Array,
    },
  },
  computed: {
    currentRoute() {
      const route = this.$route?.path
      const exists = this.subnavs.find((item) => item.route === route)
      return exists ? route : this.subnavs[0]?.route || '/'
    },
  },
  methods: {
    handleRoute(route) {
      if (!route) {
        return
      }
      this.$router
        .push({
          path: route,
        })
        .catch(() => {})
    },
  },
}
</script>
