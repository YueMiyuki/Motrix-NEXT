<template>
  <div class="mo-task-peers">
    <div class="mo-table-wrapper">
      <el-table
        stripe
        ref="peerTable"
        class="mo-peer-table"
        :data="peers"
      >
        <el-table-column
          :label="`${$t('task.task-peer-host')}: `"
          min-width="140">
          <template #default="{ row }">
            {{ `${row.ip}:${row.port}` }}
          </template>
        </el-table-column>
        <el-table-column
          :label="`${$t('task.task-peer-client')}: `"
          min-width="125">
          <template #default="{ row }">
            {{ formatPeerId(row.peerId) }}
          </template>
        </el-table-column>
        <el-table-column
          :label="`%`"
          align="right"
          width="55">
          <template #default="{ row }">
            {{ formatBitfieldPercent(row.bitfield) }}%
          </template>
        </el-table-column>
        <el-table-column
          :label="`↑`"
          align="right"
          width="90">
          <template #default="{ row }">
            {{ formatBytes(row.uploadSpeed) }}/s
          </template>
        </el-table-column>
        <el-table-column
          :label="`↓`"
          align="right"
          width="90">
          <template #default="{ row }">
            {{ formatBytes(row.downloadSpeed) }}/s
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script lang="ts">
  import {
    bitfieldToPercent,
    bytesToSize,
    peerIdParser
  } from '@shared/utils'

  export default {
    name: 'mo-task-peers',
    props: {
      peers: {
        type: Array,
        default: function () {
          return []
        }
      }
    },
    methods: {
      formatBitfieldPercent (bitfield) {
        return bitfieldToPercent(bitfield)
      },
      formatBytes (value) {
        return bytesToSize(value)
      },
      formatPeerId (peerId) {
        return peerIdParser(peerId)
      }
    }
  }
</script>

<style lang="scss">
.el-table.mo-peer-table .cell {
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}
</style>
