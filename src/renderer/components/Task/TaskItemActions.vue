<template>
  <ul :key="task.gid" class="task-item-actions" v-on:dblclick.stop="() => null">
    <li
      v-for="(action, index) in taskActions"
      :key="action"
      class="task-item-action"
      :style="{ '--stagger-index': index }"
    >
      <i v-if="action === 'PAUSE'" @click.stop="onPauseClick">
        <Pause :size="14" />
      </i>
      <i v-if="action === 'STOP'" @click.stop="onStopClick">
        <Square :size="14" />
      </i>
      <i v-if="action === 'RESUME'" @click.stop="onResumeClick">
        <Play :size="14" />
      </i>
      <i v-if="action === 'RESTART'" @click.stop="onRestartClick">
        <RotateCcw :size="14" />
      </i>
      <i v-if="action === 'DELETE'" @click.stop="onDeleteClick">
        <Trash2 :size="14" />
      </i>
      <i v-if="action === 'TRASH'" @click.stop="onTrashClick">
        <Trash :size="14" />
      </i>
      <i v-if="action === 'FOLDER'" @click.stop="onFolderClick">
        <Folder :size="14" />
      </i>
      <i v-if="action === 'LINK'" @click.stop="onLinkClick">
        <Link :size="14" />
      </i>
      <i v-if="action === 'INFO'" @click.stop="onInfoClick">
        <Info :size="14" />
      </i>
    </li>
  </ul>
</template>

<script lang="ts">
import is from '@/shims/platform'
import { useTaskStore } from '@/store/task'

import { commands } from '@/components/CommandManager/instance'
import { TASK_STATUS } from '@shared/constants'
import { checkTaskIsSeeder, getTaskName } from '@shared/utils'
import { getTaskFullPath } from '@/utils/native'
import { Play, Pause, Square, RotateCcw, Trash2, Trash, Folder, Link, Info } from 'lucide-vue-next'

const taskActionsMap = {
  [TASK_STATUS.ACTIVE]: ['PAUSE', 'DELETE'],
  [TASK_STATUS.PAUSED]: ['RESUME', 'DELETE'],
  [TASK_STATUS.WAITING]: ['RESUME', 'DELETE'],
  [TASK_STATUS.ERROR]: ['RESTART', 'TRASH'],
  [TASK_STATUS.COMPLETE]: ['RESTART', 'TRASH'],
  [TASK_STATUS.REMOVED]: ['RESTART', 'TRASH'],
  [TASK_STATUS.SEEDING]: ['STOP', 'DELETE'],
}

export default {
  name: 'mo-task-item-actions',
  components: {
    Play,
    Pause,
    Square,
    RotateCcw,
    Trash2,
    Trash,
    Folder,
    Link,
    Info,
  },
  props: {
    mode: {
      type: String,
      default: 'LIST',
      validator: function (value: string) {
        return ['LIST', 'DETAIL'].indexOf(value) !== -1
      },
    },
    task: {
      type: Object,
      required: true,
    },
  },
  computed: {
    taskName() {
      return getTaskName(this.task)
    },
    path() {
      return getTaskFullPath(this.task)
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
    taskCommonActions() {
      const { mode } = this
      const result = is.renderer() ? ['FOLDER'] : []

      switch (mode) {
        case 'LIST':
          result.push('LINK', 'INFO')
          break
        case 'DETAIL':
          result.push('LINK')
          break
      }

      return result
    },
    taskActions() {
      const { taskStatus, taskCommonActions } = this
      const actions = taskActionsMap[taskStatus] || []
      const result = [...actions, ...taskCommonActions].reverse()
      return result
    },
  },
  methods: {
    onResumeClick() {
      const { task, taskName } = this
      commands.emit('resume-task', {
        task,
        taskName,
      })
    },
    onRestartClick(event) {
      const { task, taskName } = this
      const { status } = task
      const showDialog = status === TASK_STATUS.COMPLETE || !!event.altKey
      commands.emit('restart-task', {
        task,
        taskName,
        showDialog,
      })
    },
    onPauseClick() {
      const { task, taskName } = this
      commands.emit('pause-task', {
        task,
        taskName,
      })
    },
    onStopClick() {
      if (!this.isSeeder) {
        return
      }

      const { task } = this
      commands.emit('stop-task-seeding', { task })
    },
    onDeleteClick(event) {
      const { task, taskName } = this
      const deleteWithFiles = !!event.shiftKey
      commands.emit('delete-task', {
        task,
        taskName,
        deleteWithFiles,
      })
    },
    onTrashClick(event) {
      const { task, taskName } = this
      const deleteWithFiles = !!event.shiftKey
      commands.emit('delete-task-record', {
        task,
        taskName,
        deleteWithFiles,
      })
    },
    onFolderClick() {
      const { path } = this
      commands.emit('reveal-in-folder', { path })
    },
    onLinkClick() {
      const { task } = this
      commands.emit('copy-task-link', { task })
    },
    onInfoClick() {
      const { task } = this
      // Open detail directly to avoid missing UI response when command listeners are not active.
      useTaskStore().showTaskDetail(task)
      commands.emit('show-task-info', { task })
    },
  },
}
</script>
