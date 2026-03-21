<template>
  <Transition name="speedometer-panel">
    <div v-if="isTaskPage" class="mo-speedometer" :class="{ stopped: isStopped }">
      <div class="mode" @click="toggleEngineMode">
        <i>
          <Gauge :size="24" />
        </i>
        <em>{{ engineMode }}</em>
      </div>
      <Transition name="speedometer-value" mode="out-in">
        <div class="value" v-if="!isStopped" key="active">
          <em>
            <CloudUpload :size="14" />
            {{ formatBytes(stat.uploadSpeed) }}/s
          </em>
          <span>
            <CloudDownload :size="14" />
            {{ formatBytes(stat.downloadSpeed) }}/s
          </span>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script lang="ts">
import { useAppStore } from '@/store/app'
import { usePreferenceStore } from '@/store/preference'
import { bytesToSize } from '@shared/utils'
import { CloudUpload, CloudDownload, Gauge } from 'lucide-vue-next'

export default {
  name: 'mo-speedometer',
  components: {
    Gauge,
    CloudUpload,
    CloudDownload,
  },
  computed: {
    stat() {
      return useAppStore().stat
    },
    engineMode() {
      return usePreferenceStore().engineMode
    },
    isStopped() {
      return this.stat.numActive === 0
    },
    isTaskPage() {
      const path = this.$router.currentRoute.value?.path
      return !path?.startsWith('/preference')
    },
  },
  methods: {
    toggleEngineMode() {
      usePreferenceStore().toggleEngineMode()
    },
    formatBytes(value) {
      return bytesToSize(value)
    },
  },
}
</script>
