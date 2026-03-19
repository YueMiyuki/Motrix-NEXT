<template>
  <div class="title-bar">
    <div class="title-bar-dragger"></div>
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
import { getCurrentWindow } from "@electron/remote";
import { Minus, Maximize2, X } from "lucide-vue-next";

export default {
  name: "mo-title-bar",
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
  computed: {
    win() {
      return getCurrentWindow();
    },
  },
  methods: {
    handleMinimize() {
      this.win.minimize();
    },
    handleMaximize() {
      if (this.win.isMaximized()) {
        this.win.unmaximize();
      } else {
        this.win.maximize();
      }
    },
    handleClose() {
      this.win.close();
    },
  },
};
</script>
