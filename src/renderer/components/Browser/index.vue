<template>
  <div ref="webviewViewport" class="webview-viewport">
    <div v-if="isLoading" class="webview-loading">
      <div class="webview-spinner" />
    </div>
    <iframe class="mo-webview" ref="iframe" :src="src"></iframe>
  </div>
</template>

<script lang="ts">
import is from "electron-is";
import { webContents } from "@electron/remote";

export default {
  name: "mo-browser",
  components: {},
  props: {
    src: {
      type: String,
      default: "",
    },
  },
  data() {
    return {
      isLoading: false,
      handlers: null,
    };
  },
  computed: {
    isRenderer: () => is.renderer(),
  },
  mounted() {
    const { iframe } = this.$refs;

    this.handlers = {
      loadStart: this.loadStart.bind(this),
      loadStop: this.loadStop.bind(this),
      ready: this.ready.bind(this),
    };

    iframe.addEventListener("did-start-loading", this.handlers.loadStart);
    iframe.addEventListener("did-stop-loading", this.handlers.loadStop);
    iframe.addEventListener("dom-ready", this.handlers.ready);
  },
  beforeUnmount() {
    const { iframe } = this.$refs;
    if (!iframe || !this.handlers) {
      return;
    }
    iframe.removeEventListener("did-start-loading", this.handlers.loadStart);
    iframe.removeEventListener("did-stop-loading", this.handlers.loadStop);
    iframe.removeEventListener("dom-ready", this.handlers.ready);
  },
  methods: {
    loadStart() {
      this.isLoading = true;
    },
    loadStop() {
      this.$nextTick(() => {
        this.isLoading = false;
      });
    },
    ready() {
      const { iframe } = this.$refs;

      const wc = webContents.fromId(iframe.getWebContentsId());
      wc.setWindowOpenHandler(({ url }) => {
        this.$electron.ipcRenderer.send(
          "command",
          "application:open-external",
          url,
        );
        return { action: "deny" };
      });
    },
  },
};
</script>
