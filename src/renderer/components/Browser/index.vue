<template>
  <div ref="webviewViewport" class="webview-viewport">
    <div v-if="isLoading" class="webview-loading">
      <div class="webview-spinner" />
    </div>
    <iframe class="mo-webview" ref="iframe" :src="src" @load="onLoad"></iframe>
  </div>
</template>

<script lang="ts">
export default {
  name: 'mo-browser',
  props: {
    src: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      isLoading: true,
    }
  },
  methods: {
    onLoad() {
      this.isLoading = false
    },
  },
}
</script>
