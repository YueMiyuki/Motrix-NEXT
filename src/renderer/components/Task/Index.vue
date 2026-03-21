<template>
  <div class="main panel panel-layout panel-layout--h">
    <aside class="subnav hidden-xs-only subnav-pane">
      <mo-task-subnav :current="status" />
    </aside>
    <div class="content panel panel-layout panel-layout--v">
      <header class="panel-header">
        <h4 class="task-title hidden-xs-only">{{ title }}</h4>
        <mo-subnav-switcher :title="title" :subnavs="subnavs" class="hidden-sm-and-up" />
        <mo-task-actions />
      </header>
      <main class="panel-content">
        <mo-task-list />
      </main>
    </div>
  </div>
</template>

<script lang="ts">
import logger from '@shared/utils/logger'
import { confirm } from '@/components/ui/confirm-dialog'
import { useAppStore } from '@/store/app'
import { useTaskStore } from '@/store/task'
import { usePreferenceStore } from '@/store/preference'

import { commands } from '@/components/CommandManager/instance'
import { ADD_TASK_TYPE } from '@shared/constants'
import TaskSubnav from '@/components/Subnav/TaskSubnav.vue'
import TaskActions from '@/components/Task/TaskActions.vue'
import TaskList from '@/components/Task/TaskList.vue'
import SubnavSwitcher from '@/components/Subnav/SubnavSwitcher.vue'
import { getTaskUri, parseHeader } from '@shared/utils'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { delayDeleteTaskFiles, showItemInFolder, moveTaskFilesToTrash } from '@/utils/native'

export default {
  name: 'mo-content-task',
  components: {
    [TaskSubnav.name]: TaskSubnav,
    [TaskActions.name]: TaskActions,
    [TaskList.name]: TaskList,
    [SubnavSwitcher.name]: SubnavSwitcher,
  },
  props: {
    status: {
      type: String,
      default: 'active',
    },
  },
  computed: {
    taskList() {
      return useTaskStore().taskList
    },
    selectedGidList() {
      return useTaskStore().selectedGidList
    },
    selectedGidListCount() {
      return useTaskStore().selectedGidList.length
    },
    noConfirmBeforeDelete() {
      return (usePreferenceStore().config as any).noConfirmBeforeDeleteTask
    },
    subnavs() {
      return [
        {
          key: 'active',
          title: this.$t('task.active'),
          route: '/task/active',
        },
        {
          key: 'waiting',
          title: this.$t('task.waiting'),
          route: '/task/waiting',
        },
        {
          key: 'stopped',
          title: this.$t('task.stopped'),
          route: '/task/stopped',
        },
      ]
    },
    title() {
      const subnav = this.subnavs.find((item) => item.key === this.status)
      return subnav.title
    },
  },
  watch: {
    status: 'onStatusChange',
  },
  methods: {
    onStatusChange() {
      this.changeCurrentList()
    },
    changeCurrentList() {
      useTaskStore().changeCurrentList(this.status)
    },
    directAddTask(uri, options = {}) {
      const uris = [uri]
      const payload = {
        uris,
        options: {
          ...options,
        },
      }
      useTaskStore()
        .addUri(payload)
        .catch((err) => {
          this.$msg.error(err.message)
        })
    },
    showAddTaskDialog(uri, options: any = {}) {
      const { header, ...rest } = options
      logger.log('[Motrix] show add task dialog options: ', options)

      const headers = parseHeader(header)
      const newOptions = {
        ...rest,
        ...headers,
      }

      const appStore = useAppStore()
      appStore.updateAddTaskUrl(uri)
      appStore.updateAddTaskOptions(newOptions)
      appStore.showAddTaskDialog(ADD_TASK_TYPE.URI)
    },
    deleteTaskFiles(task) {
      try {
        const result = moveTaskFilesToTrash(task)

        if (!result) {
          throw new Error('task.remove-task-file-fail')
        }
      } catch (err) {
        this.$msg.error(this.$t(err.message))
      }
    },
    removeTask(task, taskName, isRemoveWithFiles = false) {
      useTaskStore()
        .forcePauseTask(task)
        .finally(() => {
          if (isRemoveWithFiles) {
            this.deleteTaskFiles(task)
          }

          return this.removeTaskItem(task, taskName)
        })
    },
    removeTaskRecord(task, taskName, isRemoveWithFiles = false) {
      useTaskStore()
        .forcePauseTask(task)
        .finally(() => {
          if (isRemoveWithFiles) {
            this.deleteTaskFiles(task)
          }

          return this.removeTaskRecordItem(task, taskName)
        })
    },
    async removeTaskItem(task, taskName) {
      try {
        await useTaskStore().removeTask(task)
        this.$msg.success(
          this.$t('task.delete-task-success', {
            taskName,
          }),
        )
      } catch ({ code }) {
        if (code === 1) {
          this.$msg.error(
            this.$t('task.delete-task-fail', {
              taskName,
            }),
          )
        }
      }
    },
    async removeTaskRecordItem(task, taskName) {
      try {
        await useTaskStore().removeTaskRecord(task)
        this.$msg.success(
          this.$t('task.remove-record-success', {
            taskName,
          }),
        )
      } catch ({ code }) {
        if (code === 1) {
          this.$msg.error(
            this.$t('task.remove-record-fail', {
              taskName,
            }),
          )
        }
      }
    },
    removeTasks(taskList, isRemoveWithFiles = false) {
      const gids = taskList.map((task) => task.gid)
      useTaskStore()
        .batchForcePauseTask(gids)
        .finally(() => {
          if (isRemoveWithFiles) {
            this.batchDeleteTaskFiles(taskList)
          }

          this.removeTaskItems(gids)
        })
    },
    batchDeleteTaskFiles(taskList) {
      const promises = taskList.map((task, index) => delayDeleteTaskFiles(task, index * 200))
      Promise.allSettled(promises).then((results) => {
        logger.log('[Motrix] batch delete task files: ', results)
      })
    },
    removeTaskItems(gids) {
      useTaskStore()
        .batchRemoveTask(gids)
        .then(() => {
          this.$msg.success(this.$t('task.batch-delete-task-success'))
        })
        .catch(({ code }) => {
          if (code === 1) {
            this.$msg.error(this.$t('task.batch-delete-task-fail'))
          }
        })
    },
    handlePauseTask(payload) {
      const { task, taskName } = payload
      this.$msg.info(this.$t('task.download-pause-message', { taskName }))
      useTaskStore()
        .pauseTask(task)
        .catch(({ code }) => {
          if (code === 1) {
            this.$msg.error(this.$t('task.pause-task-fail', { taskName }))
          }
        })
    },
    handleResumeTask(payload) {
      const { task, taskName } = payload
      useTaskStore()
        .resumeTask(task)
        .catch(({ code }) => {
          if (code === 1) {
            this.$msg.error(
              this.$t('task.resume-task-fail', {
                taskName,
              }),
            )
          }
        })
    },
    handleStopTaskSeeding(payload) {
      const { task } = payload
      useTaskStore().stopSeeding(task)
      this.$msg.info({
        message: this.$t('task.bt-stopping-seeding-tip'),
        duration: 8000,
      })
    },
    handleRestartTask(payload) {
      const { task, taskName, showDialog } = payload
      const { gid } = task
      const uri = getTaskUri(task)

      useTaskStore()
        .getTaskOption(gid)
        .then((data: any) => {
          logger.log('[Motrix] get task option:', data)
          const { dir, header, split } = data
          const options = {
            dir,
            header,
            split,
            out: taskName,
          }

          if (showDialog) {
            this.showAddTaskDialog(uri, options)
          } else {
            this.directAddTask(uri, options)
            useTaskStore().removeTaskRecord(task)
          }
        })
    },
    handleRevealInFolder(payload) {
      const { path } = payload
      showItemInFolder(path, {
        errorMsg: this.$t('task.file-not-exist'),
      })
    },
    async handleDeleteTask(payload) {
      const { task, taskName, deleteWithFiles } = payload
      const { noConfirmBeforeDelete } = this

      if (noConfirmBeforeDelete) {
        this.removeTask(task, taskName, deleteWithFiles)
        return
      }

      const { confirmed, checkboxChecked } = await confirm({
        message: this.$t('task.delete-task-confirm', { taskName }),
        title: this.$t('task.delete-task'),
        kind: 'warning',
        confirmText: this.$t('app.yes'),
        cancelText: this.$t('app.no'),
        checkboxLabel: this.$t('task.delete-task-label'),
        checkboxChecked: deleteWithFiles,
      })
      if (confirmed) {
        this.removeTask(task, taskName, checkboxChecked)
      }
    },
    async handleDeleteTaskRecord(payload) {
      const { task, taskName, deleteWithFiles } = payload
      const { noConfirmBeforeDelete } = this

      if (noConfirmBeforeDelete) {
        this.removeTaskRecord(task, taskName, deleteWithFiles)
        return
      }

      const { confirmed, checkboxChecked } = await confirm({
        message: this.$t('task.remove-record-confirm', { taskName }),
        title: this.$t('task.remove-record'),
        kind: 'warning',
        confirmText: this.$t('app.yes'),
        cancelText: this.$t('app.no'),
        checkboxLabel: this.$t('task.remove-record-label'),
        checkboxChecked: !!deleteWithFiles,
      })
      if (confirmed) {
        this.removeTaskRecord(task, taskName, checkboxChecked)
      }
    },
    async handleBatchDeleteTask(payload) {
      const { deleteWithFiles } = payload
      const { noConfirmBeforeDelete, selectedGidList, selectedGidListCount, taskList } = this
      if (selectedGidListCount === 0) {
        return
      }

      const selectedTaskList = taskList.filter((task) => {
        return selectedGidList.includes(task.gid)
      })

      if (noConfirmBeforeDelete) {
        this.removeTasks(selectedTaskList, deleteWithFiles)
        return
      }

      const count = `${selectedGidListCount}`
      const { confirmed, checkboxChecked } = await confirm({
        message: this.$t('task.batch-delete-task-confirm', { count }),
        title: this.$t('task.delete-selected-tasks'),
        kind: 'warning',
        confirmText: this.$t('app.yes'),
        cancelText: this.$t('app.no'),
        checkboxLabel: this.$t('task.delete-task-label'),
        checkboxChecked: deleteWithFiles,
      })
      if (confirmed) {
        this.removeTasks(selectedTaskList, checkboxChecked)
      }
    },
    handleCopyTaskLink(payload) {
      const { task } = payload
      const uri = getTaskUri(task)
      writeText(uri).then(() => {
        this.$msg.success(this.$t('task.copy-link-success'))
      })
    },
    handleShowTaskInfo(payload) {
      const { task } = payload
      useTaskStore().showTaskDetail(task)
    },
  },
  created() {
    this.changeCurrentList()
  },
  mounted() {
    commands.on('pause-task', this.handlePauseTask)
    commands.on('resume-task', this.handleResumeTask)
    commands.on('stop-task-seeding', this.handleStopTaskSeeding)
    commands.on('restart-task', this.handleRestartTask)
    commands.on('reveal-in-folder', this.handleRevealInFolder)
    commands.on('delete-task', this.handleDeleteTask)
    commands.on('delete-task-record', this.handleDeleteTaskRecord)
    commands.on('batch-delete-task', this.handleBatchDeleteTask)
    commands.on('copy-task-link', this.handleCopyTaskLink)
    commands.on('show-task-info', this.handleShowTaskInfo)
  },
  beforeUnmount() {
    commands.off('pause-task', this.handlePauseTask)
    commands.off('resume-task', this.handleResumeTask)
    commands.off('stop-task-seeding', this.handleStopTaskSeeding)
    commands.off('restart-task', this.handleRestartTask)
    commands.off('reveal-in-folder', this.handleRevealInFolder)
    commands.off('delete-task', this.handleDeleteTask)
    commands.off('delete-task-record', this.handleDeleteTaskRecord)
    commands.off('batch-delete-task', this.handleBatchDeleteTask)
    commands.off('copy-task-link', this.handleCopyTaskLink)
    commands.off('show-task-info', this.handleShowTaskInfo)
  },
}
</script>
