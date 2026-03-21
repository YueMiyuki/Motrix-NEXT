<template>
  <div class="task-progress-info">
    <div class="task-progress-info-left">
      <div class="task-progress-percent">
        <span>{{ progressPercent }}%</span>
      </div>
      <div v-if="task.completedLength > 0 || task.totalLength > 0">
        <span>{{ formatBytes(task.completedLength, 2) }}</span>
        <span v-if="task.totalLength > 0"> / {{ formatBytes(task.totalLength, 2) }}</span>
      </div>
    </div>
    <div class="task-progress-info-right" v-show="isActive">
      <div class="task-speed-info">
        <div class="task-speed-text" v-if="isBT">
          <i><ArrowUp :size="10" /></i>
          <span>{{ formatBytes(task.uploadSpeed) }}/s</span>
        </div>
        <div class="task-speed-text">
          <i><ArrowDown :size="10" /></i>
          <span>{{ formatBytes(task.downloadSpeed) }}/s</span>
        </div>
        <div class="task-speed-text hidden-sm-and-down" v-if="remaining > 0">
          <span>{{ remainingText }}</span>
        </div>
        <div class="task-speed-text hidden-sm-and-down" v-if="isBT">
          <i><Magnet :size="10" /></i>
          <span>{{ task.numSeeders }}</span>
        </div>
        <div class="task-speed-text hidden-sm-and-down">
          <i><Network :size="10" /></i>
          <span>{{ task.connections }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {
  bytesToSize,
  calcProgress,
  checkTaskIsBT,
  checkTaskIsSeeder,
  timeFormat,
  timeRemaining,
} from '@shared/utils'
import { TASK_STATUS } from '@shared/constants'
import { ArrowUp, ArrowDown, Magnet, Network } from 'lucide-vue-next'

export default {
  name: 'mo-task-progress-info',
  components: {
    ArrowUp,
    ArrowDown,
    Magnet,
    Network,
  },
  props: {
    task: {
      type: Object,
    },
  },
  computed: {
    isActive() {
      return this.task.status === TASK_STATUS.ACTIVE
    },
    isBT() {
      return checkTaskIsBT(this.task)
    },
    isSeeder() {
      return checkTaskIsSeeder(this.task)
    },
    remaining() {
      const { totalLength, completedLength, downloadSpeed } = this.task
      return timeRemaining(totalLength, completedLength, downloadSpeed)
    },
    remainingText() {
      return timeFormat(this.remaining, {
        prefix: this.$t('task.remaining-prefix'),
        i18n: {
          gt1d: this.$t('app.gt1d'),
          hour: this.$t('app.hour'),
          minute: this.$t('app.minute'),
          second: this.$t('app.second'),
        },
      })
    },
    progressPercent() {
      const result = calcProgress(this.task.totalLength, this.task.completedLength, 1)
      return `${result}`.replace(/\.0$/, '')
    },
  },
  methods: {
    formatBytes(value, precision) {
      return bytesToSize(value, precision)
    },
  },
}
</script>
