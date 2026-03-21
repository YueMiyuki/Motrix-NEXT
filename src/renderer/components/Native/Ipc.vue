<template>
  <div style="display: none"></div>
</template>

<script lang="ts">
import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { commands } from '@/components/CommandManager/instance'

export default {
  name: 'mo-ipc',
  data() {
    return {
      unlisten: null as UnlistenFn | null,
    }
  },
  methods: {
    async bindIpcEvents() {
      this.unlisten = await listen('command', (event) => {
        const payload = event.payload as any
        if (payload && payload.command) {
          commands.execute(payload.command, ...(payload.args || []))
        } else if (typeof payload === 'string') {
          commands.execute(payload)
        }
      })
    },
    unbindIpcEvents() {
      if (this.unlisten) {
        this.unlisten()
        this.unlisten = null
      }
    },
  },
  created() {
    this.bindIpcEvents()
  },
  beforeUnmount() {
    this.unbindIpcEvents()
  },
}
</script>
