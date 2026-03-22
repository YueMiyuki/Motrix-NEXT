<template>
  <div style="display: none"></div>
</template>

<script lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { block, NoSleepType, unblock } from 'tauri-plugin-nosleep-api'
import logger from '@shared/utils/logger'
import { useAppStore } from '@/store/app'
import { useTaskStore } from '@/store/task'
import { usePreferenceStore } from '@/store/preference'
import api from '@/api'
import { getTaskFullPath, showItemInFolder } from '@/utils/native'
import { checkTaskIsBT, getTaskName, parseBooleanConfig } from '@shared/utils'

export default {
  name: 'mo-engine-client',
  data() {
    return {
      timer: null,
      initTimer: null,
      isPolling: false,
      isDestroyed: false,
      noSleepDesired: false,
      noSleepApplied: false,
      noSleepSource: null as null | 'plugin' | 'rust',
      noSleepSyncing: false,
      noSleepResyncNeeded: false,
      startupAutoResumeHandled: false,
    }
  },
  computed: {
    uploadSpeed() {
      return useAppStore().stat.uploadSpeed
    },
    downloadSpeed() {
      return useAppStore().stat.downloadSpeed
    },
    speed() {
      return useAppStore().stat.uploadSpeed + useAppStore().stat.downloadSpeed
    },
    interval() {
      return useAppStore().interval
    },
    downloading() {
      return useAppStore().stat.numActive > 0
    },
    progress() {
      return useAppStore().progress
    },
    messages() {
      return (useTaskStore() as any).messages
    },
    seedingList() {
      return useTaskStore().seedingList
    },
    taskDetailVisible() {
      return useTaskStore().taskDetailVisible
    },
    enabledFetchPeers() {
      return useTaskStore().enabledFetchPeers
    },
    currentTaskGid() {
      return useTaskStore().currentTaskGid
    },
    currentTaskItem() {
      return useTaskStore().currentTaskItem
    },
    taskNotification() {
      return (usePreferenceStore().config as any).taskNotification
    },
    traySpeedometer() {
      return parseBooleanConfig((usePreferenceStore().config as any).traySpeedometer)
    },
    showProgressBar() {
      return parseBooleanConfig((usePreferenceStore().config as any).showProgressBar)
    },
    resumeAllWhenAppLaunched() {
      return parseBooleanConfig((usePreferenceStore().config as any).resumeAllWhenAppLaunched)
    },
    currentTaskIsBT() {
      return checkTaskIsBT(this.currentTaskItem)
    },
  },
  watch: {
    speed() {
      const { uploadSpeed, downloadSpeed, traySpeedometer } = this
      invoke('on_speed_change', {
        uploadSpeed,
        downloadSpeed,
        showTraySpeed: traySpeedometer,
      }).catch(() => {})
    },
    traySpeedometer(val) {
      invoke('on_speed_change', {
        uploadSpeed: this.uploadSpeed,
        downloadSpeed: this.downloadSpeed,
        showTraySpeed: !!val,
      }).catch(() => {})
    },
    downloading(val, oldVal) {
      if (val !== oldVal) {
        this.noSleepDesired = !!val
        this.syncNoSleepState()
      }
    },
    progress(val) {
      invoke('on_progress_change', {
        progress: val,
        showProgressBar: this.showProgressBar,
      }).catch(() => {})
    },
    showProgressBar(val) {
      invoke('on_progress_change', {
        progress: this.progress,
        showProgressBar: parseBooleanConfig(val),
      }).catch(() => {})
    },
    interval() {
      if (this.timer) {
        this.startPolling()
      }
    },
  },
  methods: {
    async setNoSleepState(downloading: boolean) {
      if (!downloading) {
        if (this.noSleepSource === 'plugin') {
          try {
            await unblock()
            this.noSleepSource = null
            return true
          } catch {
            return false
          }
        }

        if (this.noSleepSource === 'rust') {
          try {
            await invoke('on_download_status_change', { downloading: false })
            this.noSleepSource = null
            return true
          } catch {
            return false
          }
        }

        return true
      }

      try {
        await block(NoSleepType.PreventUserIdleSystemSleep)
        this.noSleepSource = 'plugin'
        return true
      } catch {
        // Keep Rust-side fallback for environments where the plugin command is unavailable.
        try {
          await invoke('on_download_status_change', { downloading })
          this.noSleepSource = 'rust'
          return true
        } catch {
          return false
        }
      }
    },
    async syncNoSleepState() {
      if (this.noSleepSyncing) {
        this.noSleepResyncNeeded = true
        return
      }

      this.noSleepSyncing = true
      do {
        this.noSleepResyncNeeded = false
        const target = this.noSleepDesired
        if (target === this.noSleepApplied) continue

        const ok = await this.setNoSleepState(target)
        if (ok) {
          this.noSleepApplied = target
        } else {
          // Stop retry loop on hard failure; next state transition will retry.
          break
        }
      } while (this.noSleepResyncNeeded)
      this.noSleepSyncing = false

      if (this.noSleepResyncNeeded) {
        // Catch race where another update arrived right after loop exit.
        this.syncNoSleepState()
      }
    },
    async fetchTaskItem({ gid }) {
      return api.fetchTaskItem({ gid }).catch((e) => {
        logger.warn(`fetchTaskItem fail: ${e.message}`)
      })
    },
    onDownloadStart(event) {
      const taskStore = useTaskStore()
      taskStore.fetchList()
      useAppStore().resetInterval()
      taskStore.saveSession()
      const [{ gid }] = event
      const { seedingList } = this
      if (seedingList.includes(gid)) return

      this.fetchTaskItem({ gid }).then((task) => {
        if (!task) return
        const { dir } = task
        usePreferenceStore().recordHistoryDirectory(dir)
        const taskName = getTaskName(task)
        const message = this.$t('task.download-start-message', { taskName })
        this.$msg.info(message)
      })
    },
    onDownloadPause(event) {
      const [{ gid }] = event
      const { seedingList } = this
      if (seedingList.includes(gid)) return

      this.fetchTaskItem({ gid }).then((task) => {
        if (!task) return
        const taskName = getTaskName(task)
        const message = this.$t('task.download-pause-message', { taskName })
        this.$msg.info(message)
      })
    },
    onDownloadStop(event) {
      const [{ gid }] = event
      this.fetchTaskItem({ gid }).then((task) => {
        if (!task) return
        const taskName = getTaskName(task)
        const message = this.$t('task.download-stop-message', { taskName })
        this.$msg.info(message)
      })
    },
    onDownloadError(event) {
      const [{ gid }] = event
      this.fetchTaskItem({ gid }).then((task) => {
        if (!task) return
        const taskName = getTaskName(task)
        const { errorCode, errorMessage } = task
        logger.error(`[Motrix] download error gid: ${gid}, #${errorCode}, ${errorMessage}`)
        const message = this.$t('task.download-error-message', { taskName })
        const link = `https://github.com/agalwood/Motrix/wiki/Error#${errorCode}`
        this.$msg.error({
          duration: 5000,
          message: `${message} (${errorCode}) ${link}`,
        })
      })
    },
    onDownloadComplete(event) {
      const taskStore = useTaskStore()
      taskStore.fetchList()
      const [{ gid }] = event
      taskStore.removeFromSeedingList(gid)

      this.fetchTaskItem({ gid }).then((task) => {
        if (!task) return
        this.handleDownloadComplete(task, false)
      })
    },
    onBtDownloadComplete(event) {
      const taskStore = useTaskStore()
      taskStore.fetchList()
      const [{ gid }] = event
      const { seedingList } = this
      if (seedingList.includes(gid)) return

      taskStore.addToSeedingList(gid)

      this.fetchTaskItem({ gid }).then((task) => {
        if (!task) return
        this.handleDownloadComplete(task, true)
      })
    },
    handleDownloadComplete(task, isBT) {
      useTaskStore().saveSession()

      const path = getTaskFullPath(task)
      this.showTaskCompleteNotify(task, isBT, path)
      invoke('on_task_download_complete', { path }).catch(() => {})
    },
    showTaskCompleteNotify(task, isBT, path) {
      const taskName = getTaskName(task)
      const message = isBT
        ? this.$t('task.bt-download-complete-message', { taskName })
        : this.$t('task.download-complete-message', { taskName })
      const tips = isBT ? '\n' + this.$t('task.bt-download-complete-tips') : ''

      this.$msg.success(`${message}${tips}`)

      if (!this.taskNotification) return

      const notifyMessage = isBT
        ? this.$t('task.bt-download-complete-notify')
        : this.$t('task.download-complete-notify')

      const notify = new Notification(notifyMessage, {
        body: `${taskName}${tips}`,
      })
      notify.onclick = () => {
        showItemInFolder(path, {
          errorMsg: this.$t('task.file-not-exist'),
        })
      }
    },
    showTaskErrorNotify(task) {
      const taskName = getTaskName(task)
      const message = this.$t('task.download-fail-message', { taskName })
      this.$msg.success(message)

      if (!this.taskNotification) return

      // eslint-disable-next-line no-new
      new Notification(this.$t('task.download-fail-notify'), {
        body: taskName,
      })
    },
    bindEngineEvents() {
      if (!api.client) return
      api.client.on('onDownloadStart', this.onDownloadStart)
      api.client.on('onDownloadStop', this.onDownloadStop)
      api.client.on('onDownloadComplete', this.onDownloadComplete)
      api.client.on('onDownloadError', this.onDownloadError)
      api.client.on('onBtDownloadComplete', this.onBtDownloadComplete)
    },
    unbindEngineEvents() {
      if (!api.client) return
      api.client.removeListener('onDownloadStart', this.onDownloadStart)
      api.client.removeListener('onDownloadStop', this.onDownloadStop)
      api.client.removeListener('onDownloadComplete', this.onDownloadComplete)
      api.client.removeListener('onDownloadError', this.onDownloadError)
      api.client.removeListener('onBtDownloadComplete', this.onBtDownloadComplete)
    },
    startPolling() {
      this.stopPolling()

      const loop = async () => {
        await this.polling()
        if (!this.isDestroyed) {
          this.timer = setTimeout(loop, this.interval)
        }
      }

      this.timer = setTimeout(loop, this.interval)
    },
    async polling() {
      if (this.isPolling) return
      this.isPolling = true

      try {
        const jobs: Array<Promise<any>> = [
          useAppStore().fetchGlobalStat(),
          useAppStore().fetchProgress(),
        ]

        if (!document.hidden || this.taskDetailVisible) {
          jobs.push(useTaskStore().fetchList())
        }

        if (this.taskDetailVisible && this.currentTaskGid) {
          if (this.currentTaskIsBT && this.enabledFetchPeers) {
            jobs.push(useTaskStore().fetchItemWithPeers(this.currentTaskGid))
          } else {
            jobs.push(useTaskStore().fetchItem(this.currentTaskGid))
          }
        }

        await Promise.allSettled(jobs)
      } finally {
        this.isPolling = false
      }
    },
    stopPolling() {
      clearTimeout(this.timer)
      this.timer = null
    },
    autoResumeUnfinishedTasksOnLaunch() {
      if (this.startupAutoResumeHandled) {
        return
      }
      this.startupAutoResumeHandled = true

      if (!this.resumeAllWhenAppLaunched) {
        return
      }

      useTaskStore()
        .resumeAllTask()
        .catch((err) => {
          logger.warn('[Motrix] auto resume unfinished tasks failed:', err?.message || err)
        })
    },
  },
  created() {
    api
      .ensureReady()
      .then(() => {
        this.bindEngineEvents()
      })
      .catch((err) => {
        logger.warn('[Motrix] bindEngineEvents failed:', err.message)
      })
  },
  mounted() {
    this.initTimer = setTimeout(() => {
      const appStore = useAppStore()
      appStore.fetchEngineInfo()
      appStore.fetchEngineOptions()
      this.autoResumeUnfinishedTasksOnLaunch()

      this.startPolling()
    }, 100)
  },
  beforeUnmount() {
    this.isDestroyed = true
    useTaskStore().saveSession()
    clearTimeout(this.initTimer)
    this.initTimer = null

    this.unbindEngineEvents()
    this.stopPolling()

    // Best effort release in case component is torn down while downloads were active.
    this.noSleepDesired = false
    this.syncNoSleepState()
  },
}
</script>
