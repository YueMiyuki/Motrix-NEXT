<template>
  <div class="task-actions">
    <div class="task-total-progress" v-if="showTotalProgress">
      <span class="task-total-progress-size">
        {{ formatBytes(totalCompletedLength, 1) }} / {{ formatBytes(totalLength, 1) }}
      </span>
      <span class="task-total-progress-percent">{{ totalProgressPercent }}%</span>
    </div>
    <ui-tooltip
      class="item"
      effect="dark"
      placement="bottom"
      :content="$t('task.delete-selected-taskss')"
      v-if="currentList !== 'stopped'"
    >
      <i
        class="task-action"
        :class="{ disabled: selectedGidListCount === 0 }"
        @click="onBatchDeleteClick"
      >
        <Trash2 :size="14" />
      </i>
    </ui-tooltip>
    <ui-tooltip class="item" effect="dark" placement="bottom" :content="$t('task.refresh-list')">
      <i class="task-action" @click="onRefreshClick">
        <RefreshCw :size="14" :class="{ 'animate-spin': refreshing }" />
      </i>
    </ui-tooltip>
    <ui-tooltip
      class="item"
      effect="dark"
      placement="bottom"
      :content="$t('task.move-task-up')"
      v-if="currentList !== 'stopped'"
    >
      <i
        class="task-action"
        :class="{ disabled: selectedGidListCount === 0 }"
        @click="onMoveUpClick"
      >
        <ArrowUp :size="14" />
      </i>
    </ui-tooltip>
    <ui-tooltip
      class="item"
      effect="dark"
      placement="bottom"
      :content="$t('task.move-task-down')"
      v-if="currentList !== 'stopped'"
    >
      <i
        class="task-action"
        :class="{ disabled: selectedGidListCount === 0 }"
        @click="onMoveDownClick"
      >
        <ArrowDown :size="14" />
      </i>
    </ui-tooltip>
    <ui-tooltip
      class="item"
      effect="dark"
      placement="bottom"
      :content="hasSelection ? $t('task.resume-selected-tasks') : $t('task.resume-all-task')"
    >
      <i class="task-action" @click="onResumeClick">
        <Play :size="14" />
      </i>
    </ui-tooltip>
    <ui-tooltip
      class="item"
      effect="dark"
      placement="bottom"
      :content="hasSelection ? $t('task.pause-selected-tasks') : $t('task.pause-all-task')"
    >
      <i class="task-action" @click="onPauseClick">
        <Pause :size="14" />
      </i>
    </ui-tooltip>
    <ui-tooltip
      class="item"
      effect="dark"
      placement="bottom"
      :content="$t('task.purge-record')"
      v-if="currentList === 'stopped'"
    >
      <i class="task-action" @click="onPurgeRecordClick">
        <Eraser :size="14" />
      </i>
    </ui-tooltip>
  </div>
</template>

<script lang="ts">
import { toast } from 'vue-sonner'
import { useAppStore } from '@/store/app'
import { useTaskStore } from '@/store/task'

import { commands } from '@/components/CommandManager/instance'
import { ADD_TASK_TYPE } from '@shared/constants'
import { bytesToSize, calcProgress } from '@shared/utils'
import { Trash2, RefreshCw, Play, Pause, Eraser, ArrowUp, ArrowDown } from 'lucide-vue-next'

export default {
  name: 'mo-task-actions',
  components: {
    Trash2,
    RefreshCw,
    Play,
    Pause,
    Eraser,
    ArrowUp,
    ArrowDown,
  },
  props: ['task'],
  data() {
    return {
      refreshing: false,
      t: null as any,
    }
  },
  computed: {
    currentList() {
      return useTaskStore().currentList
    },
    taskList() {
      return useTaskStore().taskList
    },
    selectedGidListCount() {
      return useTaskStore().selectedGidList.length
    },
    hasSelection() {
      return this.selectedGidListCount > 0
    },
    showTotalProgress() {
      return this.currentList !== 'stopped' && this.totalLength > 0
    },
    totalLength() {
      return this.taskList.reduce((sum, task) => sum + Number(task.totalLength || 0), 0)
    },
    totalCompletedLength() {
      return this.taskList.reduce((sum, task) => sum + Number(task.completedLength || 0), 0)
    },
    totalProgressPercent() {
      const result = calcProgress(this.totalLength, this.totalCompletedLength, 1)
      return `${result}`.replace(/\.0$/, '')
    },
  },
  methods: {
    refreshSpin() {
      this.t && clearTimeout(this.t)

      this.refreshing = true
      this.t = setTimeout(() => {
        this.refreshing = false
      }, 500)
    },
    onBatchDeleteClick(event) {
      const deleteWithFiles = !!event.shiftKey
      commands.emit('batch-delete-task', { deleteWithFiles })
    },
    onRefreshClick() {
      this.refreshSpin()
      useTaskStore().fetchList()
    },
    onResumeClick() {
      if (this.hasSelection) {
        useTaskStore()
          .batchResumeSelectedTasks()
          ?.then(() => {
            this.$msg.success(this.$t('task.resume-selected-tasks-success'))
          })
          .catch(({ code }) => {
            if (code === 1) {
              this.$msg.error(this.$t('task.resume-selected-tasks-fail'))
            }
          })
      } else {
        useTaskStore()
          .resumeAllTask()
          .then(() => {
            this.$msg.success(this.$t('task.resume-all-task-success'))
          })
          .catch(({ code }) => {
            if (code === 1) {
              this.$msg.error(this.$t('task.resume-all-task-fail'))
            }
          })
      }
    },
    onPauseClick() {
      if (this.hasSelection) {
        useTaskStore()
          .batchPauseSelectedTasks()
          ?.then(() => {
            this.$msg.success(this.$t('task.pause-selected-tasks-success'))
          })
          .catch(({ code }) => {
            if (code === 1) {
              this.$msg.error(this.$t('task.pause-selected-tasks-fail'))
            }
          })
      } else {
        useTaskStore()
          .pauseAllTask()
          .then(() => {
            this.$msg.success(this.$t('task.pause-all-task-success'))
          })
          .catch(({ code }) => {
            if (code === 1) {
              this.$msg.error(this.$t('task.pause-all-task-fail'))
            }
          })
      }
    },
    onMoveUpClick() {
      useTaskStore()
        .moveSelectedTasks('up', {
          onSyncError: () => {
            toast.error('Syncing priority failed', {
              duration: 1800,
            })
          },
        })
        .then((movedCount) => {
          if (movedCount > 0) {
            this.$msg.success(this.$t('task.move-task-up'))
          }
        })
        .catch(() => {
          this.$msg.error(this.$t('task.move-task-up'))
        })
    },
    onMoveDownClick() {
      useTaskStore()
        .moveSelectedTasks('down', {
          onSyncError: () => {
            toast.error('Syncing priority failed', {
              duration: 1800,
            })
          },
        })
        .then((movedCount) => {
          if (movedCount > 0) {
            this.$msg.success(this.$t('task.move-task-down'))
          }
        })
        .catch(() => {
          this.$msg.error(this.$t('task.move-task-down'))
        })
    },
    onPurgeRecordClick() {
      useTaskStore()
        .purgeTaskRecord()
        .then(() => {
          this.$msg.success(this.$t('task.purge-record-success'))
        })
        .catch(({ code }) => {
          if (code === 1) {
            this.$msg.error(this.$t('task.purge-record-fail'))
          }
        })
    },
    onAddClick() {
      useAppStore().showAddTaskDialog(ADD_TASK_TYPE.URI)
    },
    formatBytes(value, precision = 1) {
      return bytesToSize(value, precision)
    },
  },
}
</script>
