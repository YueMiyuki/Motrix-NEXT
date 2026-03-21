<template>
  <div class="mo-task-peers">
    <div v-if="peers.length === 0" class="peers-empty">
      {{ $t('task.no-peers') }}
    </div>
    <div v-else class="peers-list">
      <div class="peer-card" v-for="(row, i) in peers" :key="i">
        <div class="peer-card-header">
          <span class="peer-card-host">{{ row.ip }}:{{ row.port }}</span>
          <span class="peer-card-progress">{{ formatBitfieldPercent(row.bitfield) }}%</span>
        </div>
        <div class="peer-card-client">{{ formatPeerId(row.peerId) }}</div>
        <div class="peer-card-speeds">
          <span class="peer-speed">
            <span class="peer-speed-arrow">↓</span>
            {{ formatBytes(row.downloadSpeed) }}/s
          </span>
          <span class="peer-speed">
            <span class="peer-speed-arrow">↑</span>
            {{ formatBytes(row.uploadSpeed) }}/s
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { bitfieldToPercent, bytesToSize, peerIdParser } from '@shared/utils'

export default {
  name: 'mo-task-peers',
  props: {
    peers: {
      type: Array,
      default: () => [],
    },
  },
  methods: {
    formatBitfieldPercent(bitfield: string) {
      return bitfieldToPercent(bitfield)
    },
    formatBytes(value: any) {
      return bytesToSize(value)
    },
    formatPeerId(peerId: string) {
      return peerIdParser(peerId)
    },
  },
}
</script>
