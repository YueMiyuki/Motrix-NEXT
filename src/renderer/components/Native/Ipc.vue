<template>
  <div style="display: none"></div>
</template>

<script lang="ts">
import { commands } from "@/components/CommandManager/instance";

export default {
  name: "mo-ipc",
  data() {
    return {
      commandHandler: null,
    };
  },
  methods: {
    bindIpcEvents() {
      this.commandHandler = (event, command, ...args) => {
        commands.execute(command, ...args);
      };

      this.$electron.ipcRenderer.on("command", this.commandHandler);
    },
    unbindIpcEvents() {
      if (!this.commandHandler) {
        return;
      }
      this.$electron.ipcRenderer.removeListener("command", this.commandHandler);
      this.commandHandler = null;
    },
  },
  created() {
    this.bindIpcEvents();
  },
  beforeUnmount() {
    this.unbindIpcEvents();
  },
};
</script>
