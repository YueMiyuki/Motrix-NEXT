import logger from '@shared/utils/logger'
import { defineStore } from 'pinia'
import api from '@/api'
import { useAppStore } from '@/store/app'
import { EMPTY_STRING, TASK_STATUS } from '@shared/constants'
import { checkTaskIsBT, intersection } from '@shared/utils'

export const useTaskStore = defineStore('task', {
  state: () => ({
    currentList: 'active',
    taskDetailVisible: false,
    currentTaskGid: EMPTY_STRING,
    enabledFetchPeers: false,
    currentTaskItem: null,
    currentTaskFiles: [],
    currentTaskPeers: [],
    seedingList: [],
    taskList: [],
    selectedGidList: [],
  }),
  actions: {
    changeCurrentList(currentList) {
      this.currentList = currentList
      this.selectedGidList = []
      this.fetchList()
    },
    async fetchList() {
      try {
        const data = await api.fetchTaskList({ type: this.currentList })
        this.taskList = data

        const gids = data.map((task) => task.gid)
        this.selectedGidList = intersection(this.selectedGidList, gids)
        return data
      } catch (err) {
        logger.warn('[Motrix] fetchList failed:', err.message)
        this.taskList = []
        this.selectedGidList = []
        return []
      }
    },
    selectTasks(list) {
      this.selectedGidList = list
    },
    selectAllTask() {
      this.selectedGidList = this.taskList.map((task) => task.gid)
    },
    async fetchItem(gid) {
      try {
        const data = await api.fetchTaskItem({ gid })
        this.updateCurrentTaskItem(data)
        return data
      } catch (err) {
        logger.warn('[Motrix] fetchItem failed:', err.message)
        this.updateCurrentTaskItem(null)
        return null
      }
    },
    async fetchItemWithPeers(gid) {
      try {
        const data = await api.fetchTaskItemWithPeers({ gid })
        if (!data) {
          this.updateCurrentTaskItem(null)
          return null
        }
        this.updateCurrentTaskItem(data)
        return data
      } catch (err) {
        logger.warn('[Motrix] fetchItemWithPeers failed:', err.message)
        this.updateCurrentTaskItem(null)
        return null
      }
    },
    async showTaskDetailByGid(gid) {
      try {
        const task = await api.fetchTaskItem({ gid })
        if (!task) {
          return null
        }
        this.updateCurrentTaskItem(task)
        this.currentTaskGid = task.gid
        this.taskDetailVisible = true
        return task
      } catch (err) {
        logger.warn('[Motrix] showTaskDetailByGid failed:', err.message)
        return null
      }
    },
    showTaskDetail(task) {
      this.updateCurrentTaskItem(task)
      this.currentTaskGid = task.gid
      this.taskDetailVisible = true
    },
    hideTaskDetail() {
      this.taskDetailVisible = false
    },
    toggleEnabledFetchPeers(enabled) {
      this.enabledFetchPeers = enabled
    },
    updateCurrentTaskItem(task) {
      this.currentTaskItem = task
      if (task) {
        this.currentTaskFiles = task.files
        this.currentTaskPeers = task.peers
      } else {
        this.currentTaskFiles = []
        this.currentTaskPeers = []
      }
    },
    updateCurrentTaskGid(gid) {
      this.currentTaskGid = gid
    },
    addUri(data) {
      const { uris, outs, options } = data
      return api.addUri({ uris, outs, options }).then(() => {
        this.fetchList()
        const appStore = useAppStore()
        appStore.updateAddTaskOptions({})
      })
    },
    addTorrent(data) {
      const { torrent, options } = data
      return api.addTorrent({ torrent, options }).then(() => {
        this.fetchList()
        const appStore = useAppStore()
        appStore.updateAddTaskOptions({})
      })
    },
    addMetalink(data) {
      const { metalink, options } = data
      return api.addMetalink({ metalink, options }).then(() => {
        this.fetchList()
        const appStore = useAppStore()
        appStore.updateAddTaskOptions({})
      })
    },
    getTaskOption(gid) {
      return api.getOption({ gid }).catch((err) => {
        logger.warn('[Motrix] getTaskOption failed:', err.message)
        return {}
      })
    },
    changeTaskOption(payload) {
      const { gid, options } = payload
      return api.changeOption({ gid, options })
    },
    removeTask(task) {
      const { gid } = task
      if (gid === this.currentTaskGid) {
        this.hideTaskDetail()
      }

      return api.removeTask({ gid }).finally(() => {
        this.fetchList()
        this.saveSession()
      })
    },
    forcePauseTask(task) {
      const { gid, status } = task
      if (status !== TASK_STATUS.ACTIVE) {
        return Promise.resolve(true)
      }

      return api.forcePauseTask({ gid }).finally(() => {
        this.fetchList()
        this.saveSession()
      })
    },
    pauseTask(task) {
      const { gid } = task
      const isBT = checkTaskIsBT(task)
      const promise = isBT ? api.forcePauseTask({ gid }) : api.pauseTask({ gid })
      promise.finally(() => {
        this.fetchList()
        this.saveSession()
      })
      return promise
    },
    resumeTask(task) {
      const { gid } = task
      return api.resumeTask({ gid }).finally(() => {
        this.fetchList()
        this.saveSession()
      })
    },
    pauseAllTask() {
      return api
        .pauseAllTask()
        .catch(() => {
          return api.forcePauseAllTask()
        })
        .finally(() => {
          this.fetchList()
          this.saveSession()
        })
    },
    resumeAllTask() {
      return api.resumeAllTask().finally(() => {
        this.fetchList()
        this.saveSession()
      })
    },
    addToSeedingList(gid) {
      if (this.seedingList.includes(gid)) {
        return
      }

      this.seedingList = [...this.seedingList, gid]
    },
    removeFromSeedingList(gid) {
      const idx = this.seedingList.indexOf(gid)
      if (idx === -1) {
        return
      }

      this.seedingList = [...this.seedingList.slice(0, idx), ...this.seedingList.slice(idx + 1)]
    },
    stopSeeding({ gid }) {
      const options = {
        seedTime: 0,
      }
      return this.changeTaskOption({ gid, options })
    },
    removeTaskRecord(task) {
      const { gid, status } = task
      if (gid === this.currentTaskGid) {
        this.hideTaskDetail()
      }

      const { ERROR, COMPLETE, REMOVED } = TASK_STATUS
      if ([ERROR, COMPLETE, REMOVED].indexOf(status) === -1) {
        return
      }
      return api.removeTaskRecord({ gid }).finally(() => this.fetchList())
    },
    saveSession() {
      api.saveSession()
    },
    purgeTaskRecord() {
      return api.purgeTaskRecord().finally(() => this.fetchList())
    },
    toggleTask(task) {
      const { status } = task
      const { ACTIVE, WAITING, PAUSED } = TASK_STATUS
      if (status === ACTIVE) {
        return this.pauseTask(task)
      } else if (status === WAITING || status === PAUSED) {
        return this.resumeTask(task)
      }
    },
    batchResumeSelectedTasks() {
      const gids = this.selectedGidList
      if (gids.length === 0) {
        return
      }

      return api.batchResumeTask({ gids }).finally(() => {
        this.fetchList()
        this.saveSession()
      })
    },
    batchPauseSelectedTasks() {
      const gids = this.selectedGidList
      if (gids.length === 0) {
        return
      }

      return api.batchPauseTask({ gids }).finally(() => {
        this.fetchList()
        this.saveSession()
      })
    },
    batchForcePauseTask(gids) {
      return api.batchForcePauseTask({ gids })
    },
    batchResumeTask(gids) {
      return api.batchResumeTask({ gids })
    },
    batchRemoveTask(gids) {
      return api.batchRemoveTask({ gids }).finally(() => {
        this.fetchList()
        this.saveSession()
      })
    },
    async moveSelectedTasks(direction: 'up' | 'down') {
      const { ACTIVE } = TASK_STATUS
      const selectedTasks = this.taskList.filter((task) => this.selectedGidList.includes(task.gid))
      const selectedActiveTasks = selectedTasks.filter((task) => task.status === ACTIVE)

      if (selectedActiveTasks.length > 0) {
        await Promise.allSettled(
          selectedActiveTasks.map((task) => {
            return api.forcePauseTask({ gid: task.gid })
          }),
        )
      }

      const waitingList = await api
        .fetchWaitingTaskList({
          offset: 0,
          num: 10000,
          keys: ['gid'],
        })
        .catch((err) => {
          logger.warn('[Motrix] moveSelectedTasks fetchWaitingTaskList failed:', err.message)
          return []
        })
      const queue = waitingList.map((task) => task.gid)
      const selectedQueue = queue.filter((gid) => this.selectedGidList.includes(gid))

      let moved = 0
      const walkList = direction === 'up' ? [...selectedQueue] : [...selectedQueue].reverse()

      for (const gid of walkList) {
        const currentIndex = queue.indexOf(gid)
        if (currentIndex < 0) {
          continue
        }
        const targetIndex =
          direction === 'up'
            ? Math.max(currentIndex - 1, 0)
            : Math.min(currentIndex + 1, queue.length - 1)
        if (targetIndex === currentIndex) {
          continue
        }

        try {
          await api.changePosition({
            gid,
            pos: targetIndex,
            how: 'POS_SET',
          })
          const [currentGid] = queue.splice(currentIndex, 1)
          queue.splice(targetIndex, 0, currentGid)
          moved += 1
        } catch (err) {
          logger.warn('[Motrix] moveSelectedTasks changePosition failed:', err.message)
        }
      }

      if (selectedActiveTasks.length > 0) {
        await Promise.allSettled(
          selectedActiveTasks.map((task) => {
            return api.resumeTask({ gid: task.gid })
          }),
        )
      }

      if (moved > 0 || selectedActiveTasks.length > 0) {
        await this.fetchList()
        this.saveSession()
      }

      return moved
    },
  },
})
