<template>
  <div ref="webviewViewport" class="webview-viewport">
    <iframe
      class="mo-webview"
      ref="iframe"
      :src="src"
    ></iframe>
  </div>
</template>

<script lang="ts">
  import is from 'electron-is'
  import { webContents } from '@electron/remote'
  import { Loading } from 'element-ui'

  export default {
    name: 'mo-browser',
    components: {
    },
    props: {
      src: {
        type: String,
        default: ''
      }
    },
    data () {
      return {
        loading: null,
        handlers: null
      }
    },
    computed: {
      isRenderer: () => is.renderer()
    },
    mounted () {
      const { iframe } = this.$refs

      this.handlers = {
        loadStart: this.loadStart.bind(this),
        loadStop: this.loadStop.bind(this),
        ready: this.ready.bind(this)
      }

      iframe.addEventListener('did-start-loading', this.handlers.loadStart)
      iframe.addEventListener('did-stop-loading', this.handlers.loadStop)
      iframe.addEventListener('dom-ready', this.handlers.ready)
    },
    beforeUnmount () {
      const { iframe } = this.$refs
      if (!iframe || !this.handlers) {
        return
      }
      iframe.removeEventListener('did-start-loading', this.handlers.loadStart)
      iframe.removeEventListener('did-stop-loading', this.handlers.loadStop)
      iframe.removeEventListener('dom-ready', this.handlers.ready)
      if (this.loading) {
        this.loading.close()
        this.loading = null
      }
    },
    methods: {
      loadStart () {
        const { webviewViewport } = this.$refs
        this.loading = Loading.service({
          target: webviewViewport
        })
      },
      loadStop () {
        this.$nextTick(() => {
          this.loading.close()
        })
      },
      ready () {
        const { iframe } = this.$refs

        const wc = webContents.fromId(iframe.getWebContentsId())
        wc.setWindowOpenHandler(({ url }) => {
          this.$electron.ipcRenderer.send('command', 'application:open-external', url)
          return { action: 'deny' }
        })
      }
    }
  }
</script>

<style lang="scss">
.webview-viewport {
  position: relative;
}
.mo-webview {
  display: inline-flex;;
  flex: 1;
  flex-basis: auto;
}
</style>
