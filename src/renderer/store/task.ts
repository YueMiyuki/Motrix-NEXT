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
    taskOrderMap: {
      active: [],
      waiting: [],
      stopped: [],
    },
  }),
  actions: {
    applyTaskOrder(type, tasks = []) {
      const order = this.taskOrderMap[type]
      if (!order || order.length === 0 || tasks.length < 2) {
        return tasks
      }

      const orderIndex = new Map(order.map((gid, index) => [gid, index]))
      const fallbackIndex = new Map(tasks.map((task, index) => [task.gid, index]))

      return [...tasks].sort((a, b) => {
        const aOrderIndex = orderIndex.get(a.gid)
        const bOrderIndex = orderIndex.get(b.gid)
        const aIndex = typeof aOrderIndex === 'number' ? aOrderIndex : Number.MAX_SAFE_INTEGER
        const bIndex = typeof bOrderIndex === 'number' ? bOrderIndex : Number.MAX_SAFE_INTEGER
        if (aIndex !== bIndex) {
          return aIndex - bIndex
        }
        return (fallbackIndex.get(a.gid) || 0) - (fallbackIndex.get(b.gid) || 0)
      })
    },
    updateTaskOrder(type, gids = []) {
      this.taskOrderMap = {
        ...this.taskOrderMap,
        [type]: [...gids],
      }
    },
    changeCurrentList(currentList) {
      this.currentList = currentList
      this.selectedGidList = []
      this.fetchList()
    },
    async fetchList() {
      try {
        const type = this.currentList
        const data = await api.fetchTaskList({ type })
        const orderedData = this.applyTaskOrder(type, data)
        this.taskList = orderedData
        this.updateTaskOrder(
          type,
          orderedData.map((task) => task.gid),
        )

        const gids = orderedData.map((task) => task.gid)
        this.selectedGidList = intersection(this.selectedGidList, gids)
        return orderedData
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
    async syncSelectedTaskOrder(direction: 'up' | 'down', selectedGids: string[]) {
      const { ACTIVE } = TASK_STATUS
      const selectedGidSet = new Set(selectedGids)
      const selectedTasks = this.taskList.filter((task) => selectedGidSet.has(task.gid))
      const selectedActiveTasks = selectedTasks.filter((task) => task.status === ACTIVE)
      const activeSelectedGidSet = new Set(selectedActiveTasks.map((task) => task.gid))
      let syncError: any = null

      if (selectedActiveTasks.length > 0) {
        const pauseResult = await Promise.allSettled(
          selectedActiveTasks.map((task) => {
            return api.forcePauseTask({ gid: task.gid })
          }),
        )
        if (pauseResult.some((item) => item.status === 'rejected')) {
          syncError = syncError || new Error('priority-sync-force-pause-failed')
        }
      }

      let waitingList: any[] = []
      const maxAttempts = selectedActiveTasks.length > 0 ? 8 : 1
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        waitingList = await api
          .fetchWaitingTaskList({
            offset: 0,
            num: 10000,
            keys: ['gid'],
          })
          .catch((err) => {
            logger.warn('[Motrix] moveSelectedTasks fetchWaitingTaskList failed:', err.message)
            syncError = syncError || err || new Error('priority-sync-fetch-waiting-failed')
            return []
          })

        if (selectedActiveTasks.length === 0) {
          break
        }

        const queue = waitingList.map((task) => task.gid)
        const activeMissingCount = selectedActiveTasks.filter(
          (task) => !queue.includes(task.gid),
        ).length
        if (activeMissingCount === 0) {
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 120))
      }

      const queue = waitingList.map((task) => task.gid)
      const selectedQueue = queue.filter((gid) => selectedGidSet.has(gid))
      const shouldResumeActiveTasks = selectedActiveTasks.length > 0

      let moved = 0

      if (selectedQueue.length === 0 && selectedActiveTasks.length > 0 && direction === 'up') {
        for (const task of selectedActiveTasks) {
          try {
            await api.changePosition({
              gid: task.gid,
              pos: 0,
              how: 'POS_SET',
            })
            moved += 1
          } catch (err) {
            logger.warn('[Motrix] moveSelectedTasks active fallback failed:', err.message)
            syncError = syncError || err || new Error('priority-sync-active-fallback-failed')
          }
        }
      }
      if (selectedQueue.length === 0 && selectedActiveTasks.length > 0 && direction === 'down') {
        const targetPos = Math.max(queue.length - 1, 0)
        for (const task of selectedActiveTasks) {
          try {
            await api.changePosition({
              gid: task.gid,
              pos: targetPos,
              how: 'POS_SET',
            })
            moved += 1
          } catch (err) {
            logger.warn('[Motrix] moveSelectedTasks active demote fallback failed:', err.message)
            syncError = syncError || err || new Error('priority-sync-active-demote-failed')
          }
        }
      }

      const walkList = direction === 'up' ? [...selectedQueue] : [...selectedQueue].reverse()

      for (const gid of walkList) {
        const currentIndex = queue.indexOf(gid)
        if (currentIndex < 0) {
          continue
        }

        let targetIndex = currentIndex
        if (direction === 'up') {
          targetIndex = activeSelectedGidSet.has(gid) ? 0 : Math.max(currentIndex - 1, 0)
        } else {
          targetIndex = Math.min(currentIndex + 1, queue.length - 1)
        }
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
          syncError = syncError || err || new Error('priority-sync-change-position-failed')
        }
      }

      if (selectedActiveTasks.length > 0 && shouldResumeActiveTasks) {
        const resumeResult = await Promise.allSettled(
          selectedActiveTasks.map((task) => {
            return api.resumeTask({ gid: task.gid })
          }),
        )
        if (resumeResult.some((item) => item.status === 'rejected')) {
          syncError = syncError || new Error('priority-sync-resume-failed')
        }
      }

      if (moved > 0 || selectedActiveTasks.length > 0) {
        await this.fetchList()
        this.saveSession()
      }

      if (syncError) {
        throw syncError
      }

      return moved
    },
    async moveSelectedTasks(
      direction: 'up' | 'down',
      options: { onSyncError?: (error: any) => void } = {},
    ) {
      const { onSyncError } = options
      const selectedGids = [...this.selectedGidList]
      if (selectedGids.length === 0) {
        return 0
      }

      const selectedSet = new Set(selectedGids)
      const nextList = [...this.taskList]
      let moved = 0

      if (direction === 'up') {
        for (let i = 1; i < nextList.length; i += 1) {
          const curr = nextList[i]
          const prev = nextList[i - 1]
          if (!selectedSet.has(curr.gid) || selectedSet.has(prev.gid)) {
            continue
          }
          nextList[i - 1] = curr
          nextList[i] = prev
          moved += 1
        }
      } else {
        for (let i = nextList.length - 2; i >= 0; i -= 1) {
          const curr = nextList[i]
          const next = nextList[i + 1]
          if (!selectedSet.has(curr.gid) || selectedSet.has(next.gid)) {
            continue
          }
          nextList[i + 1] = curr
          nextList[i] = next
          moved += 1
        }
      }

      if (moved === 0) {
        return 0
      }

      this.taskList = nextList
      this.updateTaskOrder(
        this.currentList,
        nextList.map((task) => task.gid),
      )
      this.saveSession()

      this.syncSelectedTaskOrder(direction, selectedGids).catch((err) => {
        logger.warn('[Motrix] syncSelectedTaskOrder failed:', err.message)
        if (typeof onSyncError === 'function') {
          onSyncError(err)
        }
      })

      return moved
    },
  },
})
