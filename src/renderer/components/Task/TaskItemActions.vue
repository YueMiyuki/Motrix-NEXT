<template>
  <ul :key="task.gid" class="task-item-actions" @click.stop v-on:dblclick.stop="() => null">
    <li
      v-for="(action, index) in taskActions"
      :key="action"
      class="task-item-action"
      :style="{ '--stagger-index': index }"
      @click.stop="onActionClick(action, $event)"
    >
      <i v-if="action === 'PAUSE'">
        <Pause :size="14" />
      </i>
      <i v-if="action === 'STOP'">
        <Square :size="14" />
      </i>
      <i v-if="action === 'RESUME'">
        <Play :size="14" />
      </i>
      <i v-if="action === 'RESTART'">
        <RotateCcw :size="14" />
      </i>
      <i v-if="action === 'DELETE'">
        <Trash2 :size="14" />
      </i>
      <i v-if="action === 'TRASH'">
        <Trash :size="14" />
      </i>
      <i v-if="action === 'FOLDER'">
        <Folder :size="14" />
      </i>
      <i v-if="action === 'LINK'">
        <Link :size="14" />
      </i>
      <i v-if="action === 'INFO'">
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
import { getTaskFullPath, getTaskRevealPath } from '@/utils/native'
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
      return getTaskRevealPath(this.task)
    },
    fallbackPath() {
      const dir = `${this.task?.dir || ''}`.trim()
      return dir || getTaskFullPath(this.task)
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
    onActionClick(action, event) {
      switch (action) {
        case 'PAUSE':
          this.onPauseClick()
          break
        case 'STOP':
          this.onStopClick()
          break
        case 'RESUME':
          this.onResumeClick()
          break
        case 'RESTART':
          this.onRestartClick(event)
          break
        case 'DELETE':
          this.onDeleteClick(event)
          break
        case 'TRASH':
          this.onTrashClick(event)
          break
        case 'FOLDER':
          this.onFolderClick()
          break
        case 'LINK':
          this.onLinkClick()
          break
        case 'INFO':
          this.onInfoClick()
          break
      }
    },
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
      const { path, fallbackPath } = this
      commands.emit('reveal-in-folder', { path, fallbackPath })
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
