<template>
  <div class="title-bar">
    <div
      class="title-bar-dragger"
      data-tauri-drag-region
      @mousedown.left.prevent="handleStartDragging"
    ></div>
    <ul v-if="showActions" class="window-actions">
      <li @click="handleMinimize">
        <Minus :size="12" />
      </li>
      <li @click="handleMaximize">
        <Maximize2 :size="12" />
      </li>
      <li @click="handleClose" class="win-close-btn">
        <X :size="12" />
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { Minus, Maximize2, X } from 'lucide-vue-next'

const appWindow = getCurrentWebviewWindow()

export default {
  name: 'mo-title-bar',
  components: {
    Minus,
    Maximize2,
    X,
  },
  props: {
    showActions: {
      type: Boolean,
    },
  },
  methods: {
    handleStartDragging() {
      appWindow.startDragging().catch(() => {})
    },
    handleMinimize() {
      appWindow.minimize()
    },
    async handleMaximize() {
      const maximized = await appWindow.isMaximized()
      if (maximized) {
        appWindow.unmaximize()
      } else {
        appWindow.maximize()
      }
    },
    handleClose() {
      appWindow.hide()
    },
  },
}
</script>
