<template>
  <div
    :key="task.gid"
    class="task-item"
    :class="{ 'is-active': shouldPulse, 'is-complete': isComplete }"
    v-on:dblclick="onDbClick"
  >
    <div class="task-status-indicator" :class="`status-${taskStatus}`"></div>
    <div class="task-content">
      <div class="task-header">
        <div class="task-name" :title="taskFullName">
          <span>{{ taskFullName }}</span>
        </div>
        <mo-task-item-actions mode="LIST" :task="task" />
      </div>
      <div class="task-progress">
        <mo-task-progress
          :completed="Number(task.completedLength)"
          :total="Number(task.totalLength)"
          :status="taskStatus"
        />
        <mo-task-progress-info :task="task" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { useTaskStore } from '@/store/task'
import { checkTaskIsSeeder, getTaskName } from '@shared/utils'
import { TASK_STATUS } from '@shared/constants'
import { openItem, getTaskFullPath } from '@/utils/native'
import TaskItemActions from './TaskItemActions.vue'
import TaskProgress from './TaskProgress.vue'
import TaskProgressInfo from './TaskProgressInfo.vue'

export default {
  name: 'mo-task-item',
  components: {
    [TaskItemActions.name]: TaskItemActions,
    [TaskProgress.name]: TaskProgress,
    [TaskProgressInfo.name]: TaskProgressInfo,
  },
  props: {
    task: {
      type: Object,
    },
  },
  computed: {
    taskFullName() {
      return getTaskName(this.task, {
        defaultName: this.$t('task.get-task-name'),
        maxLen: -1,
      })
    },
    taskName() {
      return getTaskName(this.task, {
        defaultName: this.$t('task.get-task-name'),
      })
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
    shouldPulse() {
      if (!this.isActive) {
        return false
      }

      const downloadSpeed = Number(this.task.downloadSpeed || 0)
      const uploadSpeed = Number(this.task.uploadSpeed || 0)
      return downloadSpeed > 0 || uploadSpeed > 0
    },
    isComplete() {
      return this.taskStatus === TASK_STATUS.COMPLETE
    },
  },
  methods: {
    onDbClick() {
      const { status } = this.task
      const { COMPLETE, WAITING, PAUSED } = TASK_STATUS
      if (status === COMPLETE) {
        this.openTask()
      } else if ([WAITING, PAUSED].includes(status)) {
        this.toggleTask()
      }
    },
    async openTask() {
      const { taskName } = this
      this.$msg.info(this.$t('task.opening-task-message', { taskName }))
      const fullPath = getTaskFullPath(this.task)
      const result = await openItem(fullPath)
      if (result) {
        this.$msg.error(this.$t('task.file-not-exist'))
      }
    },
    toggleTask() {
      useTaskStore().toggleTask(this.task)
    },
  },
}
</script>
