import logger from '@shared/utils/logger'
import { defineStore } from 'pinia'
import { ADD_TASK_TYPE } from '@shared/constants'
import api from '@/api'
import { getSystemTheme } from '@/utils/native'

const BASE_INTERVAL = 1500
const PER_INTERVAL = 80
const MIN_INTERVAL = 800
const MAX_INTERVAL = 6000

export const useAppStore = defineStore('app', {
  state: () => ({
    systemTheme: getSystemTheme(),
    trayFocused: false,
    aboutPanelVisible: false,
    engineInfo: {
      version: '',
      enabledFeatures: [],
    },
    engineOptions: {},
    interval: BASE_INTERVAL,
    stat: {
      downloadSpeed: 0,
      uploadSpeed: 0,
      numActive: 0,
      numWaiting: 0,
      numStopped: 0,
    },
    addTaskVisible: false,
    addTaskType: ADD_TASK_TYPE.URI,
    addTaskUrl: '',
    addTaskTorrents: [],
    addTaskOptions: {},
    progress: 0,
  }),
  actions: {
    updateSystemTheme(theme) {
      this.systemTheme = theme
    },
    updateTrayFocused(focused) {
      this.trayFocused = focused
    },
    showAboutPanel() {
      this.aboutPanelVisible = true
    },
    hideAboutPanel() {
      this.aboutPanelVisible = false
    },
    async fetchEngineInfo() {
      try {
        const data = await api.getVersion()
        this.engineInfo = { ...this.engineInfo, ...data }
        return data
      } catch (err) {
        logger.warn('[Motrix] fetchEngineInfo failed:', err.message)
        return null
      }
    },
    async fetchEngineOptions() {
      try {
        const data = await api.getGlobalOption()
        this.engineOptions = { ...this.engineOptions, ...data }
        return data
      } catch (err) {
        logger.warn('[Motrix] fetchEngineOptions failed:', err.message)
        return null
      }
    },
    async fetchGlobalStat() {
      try {
        const data = await api.getGlobalStat()
        const stat: any = {}
        Object.keys(data).forEach((key) => {
          stat[key] = Number(data[key])
        })

        const { numActive } = stat
        if (numActive > 0) {
          const interval = BASE_INTERVAL - PER_INTERVAL * numActive
          this.updateInterval(interval)
        } else {
          stat.downloadSpeed = 0
          this.increaseInterval()
        }
        this.stat = stat
      } catch (err) {
        logger.warn('[Motrix] fetchGlobalStat failed:', err.message)
      }
    },
    increaseInterval(millisecond = 100) {
      if (this.interval < MAX_INTERVAL) {
        this.interval += millisecond
      }
    },
    showAddTaskDialog(taskType) {
      this.addTaskType = taskType
      this.addTaskVisible = true
    },
    hideAddTaskDialog() {
      this.addTaskVisible = false
      this.addTaskUrl = ''
      this.addTaskTorrents = []
    },
    changeAddTaskType(taskType) {
      this.addTaskType = taskType
    },
    updateAddTaskUrl(uri = '') {
      this.addTaskUrl = uri
    },
    addTaskAddTorrents({ fileList }) {
      this.addTaskTorrents = [...fileList]
    },
    updateAddTaskOptions(options = {}) {
      this.addTaskOptions = { ...options }
    },
    updateInterval(millisecond) {
      let interval = millisecond
      if (millisecond > MAX_INTERVAL) {
        interval = MAX_INTERVAL
      }
      if (millisecond < MIN_INTERVAL) {
        interval = MIN_INTERVAL
      }
      if (this.interval === interval) {
        return
      }
      this.interval = interval
    },
    resetInterval() {
      this.interval = BASE_INTERVAL
    },
    async fetchProgress() {
      try {
        const data = await api.fetchActiveTaskList()
        let progress = -1
        if (data.length !== 0) {
          data.forEach((task) => {
            task.totalLength = Number(task.totalLength)
            task.completedLength = Number(task.completedLength)
          })
          const realTotal = data.reduce((total, task) => total + task.totalLength, 0)
          if (realTotal === 0) {
            progress = 2
          } else {
            const tasks = data.filter((task) => task.totalLength !== 0)
            const completed = tasks.reduce((total, task) => total + task.completedLength, 0)
            const total = tasks.reduce((total, task) => total + task.totalLength, 0)
            progress = completed / total
          }
        }
        this.progress = progress
      } catch (err) {
        logger.warn('[Motrix] fetchProgress failed:', err.message)
      }
    },
  },
})
