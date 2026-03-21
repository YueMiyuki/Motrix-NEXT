<template>
  <div class="mo-task-activity" v-if="task">
    <!-- Piece graphic -->
    <div class="graphic-box" ref="graphicBox">
      <mo-task-graphic
        :outerWidth="graphicWidth"
        :bitfield="task.bitfield"
        v-if="graphicWidth > 0"
      />
    </div>

    <!-- Progress section -->
    <div class="activity-progress">
      <div class="activity-progress-header">
        <span class="activity-progress-percent">{{ percent }}</span>
        <span class="activity-progress-size">
          {{ formatBytes(task.completedLength, 2) }}
          <span v-if="task.totalLength > 0"> / {{ formatBytes(task.totalLength, 2) }}</span>
        </span>
        <span class="activity-progress-remaining" v-if="isActive && remaining > 0">
          {{ remainingText }}
        </span>
      </div>
      <mo-task-progress
        :completed="Number(task.completedLength)"
        :total="Number(task.totalLength)"
        :status="taskStatus"
      />
    </div>

    <!-- Stats grid -->
    <div class="activity-stats">
      <div class="activity-stat-item">
        <span class="activity-stat-label">{{ $t('task.task-download-speed') }}</span>
        <span class="activity-stat-value">{{ formatBytes(task.downloadSpeed) }}/s</span>
      </div>
      <div class="activity-stat-item" v-if="isBT">
        <span class="activity-stat-label">{{ $t('task.task-upload-speed') }}</span>
        <span class="activity-stat-value">{{ formatBytes(task.uploadSpeed) }}/s</span>
      </div>
      <div class="activity-stat-item">
        <span class="activity-stat-label">{{ $t('task.task-connections') }}</span>
        <span class="activity-stat-value">{{ task.connections }}</span>
      </div>
      <div class="activity-stat-item" v-if="isBT">
        <span class="activity-stat-label">{{ $t('task.task-num-seeders') }}</span>
        <span class="activity-stat-value">{{ task.numSeeders }}</span>
      </div>
      <div class="activity-stat-item" v-if="isBT">
        <span class="activity-stat-label">{{ $t('task.task-upload-length') }}</span>
        <span class="activity-stat-value">{{ formatBytes(task.uploadLength) }}</span>
      </div>
      <div class="activity-stat-item" v-if="isBT">
        <span class="activity-stat-label">{{ $t('task.task-ratio') }}</span>
        <span class="activity-stat-value">{{ ratio }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import is from '@/shims/platform'
import {
  bytesToSize,
  calcProgress,
  calcRatio,
  checkTaskIsBT,
  checkTaskIsSeeder,
  timeFormat,
  timeRemaining,
} from '@shared/utils'
import { TASK_STATUS } from '@shared/constants'
import TaskGraphic from '@/components/TaskGraphic/Index.vue'
import TaskProgress from '@/components/Task/TaskProgress.vue'

export default {
  name: 'mo-task-activity',
  components: {
    [TaskGraphic.name]: TaskGraphic,
    [TaskProgress.name]: TaskProgress,
  },
  props: {
    gid: {
      type: String,
    },
    task: {
      type: Object,
    },
    files: {
      type: Array,
      default: function () {
        return []
      },
    },
    peers: {
      type: Array,
      default: function () {
        return []
      },
    },
    visible: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      graphicWidth: 0,
    }
  },
  computed: {
    isRenderer: () => is.renderer(),
    isBT() {
      return checkTaskIsBT(this.task)
    },
    isSeeder() {
      return checkTaskIsSeeder(this.task)
    },
    taskStatus() {
      const { task, isSeeder } = this
      if (isSeeder) {
        return TASK_STATUS.SEEDING
      } else {
        return task.status
      }
    },
    isActive() {
      return this.taskStatus === TASK_STATUS.ACTIVE
    },
    percent() {
      const { totalLength, completedLength } = this.task
      const percent = calcProgress(totalLength, completedLength)
      return `${percent}%`
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
    ratio() {
      if (!this.isBT) {
        return 0
      }

      const { totalLength, uploadLength } = this.task
      const ratio = calcRatio(totalLength, uploadLength)
      return ratio
    },
  },
  mounted() {
    this.$nextTick(() => {
      this.updateGraphicWidth()
    })
  },
  methods: {
    updateGraphicWidth() {
      if (!this.$refs.graphicBox) {
        return
      }
      this.graphicWidth = this.calcInnerWidth(this.$refs.graphicBox)
    },
    calcInnerWidth(ele) {
      if (!ele) {
        return 0
      }

      const style = getComputedStyle(ele, null)
      const width = parseInt(style.width, 10)
      const paddingLeft = parseInt(style.paddingLeft, 10)
      const paddingRight = parseInt(style.paddingRight, 10)
      return width - paddingLeft - paddingRight
    },
    formatBytes(value, precision) {
      return bytesToSize(value, precision)
    },
  },
}
</script>
