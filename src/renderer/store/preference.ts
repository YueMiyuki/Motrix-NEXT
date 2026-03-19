import logger from '@shared/utils/logger'
import { defineStore } from 'pinia'
import { isEmpty } from 'lodash'
import api from '@/api'
import { useTaskStore } from '@/store/task'
import { getLangDirection, pushItemToFixedLengthArray, removeArrayItem } from '@shared/utils'
import { fetchBtTrackerFromSource } from '@shared/utils/tracker'
import { MAX_NUM_OF_DIRECTORIES } from '@shared/constants'

export const usePreferenceStore = defineStore('preference', {
  state: () => ({
    engineMode: 'MAX',
    config: {
      locale: 'en-US',
    },
  }),
  getters: {
    theme: (state: any) => state.config.theme,
    locale: (state: any) => state.config.locale,
    direction: (state: any) => getLangDirection(state.config.locale),
  },
  actions: {
    async fetchPreference() {
      try {
        const config = await api.fetchPreference()
        this.updatePreference(config)
        return config
      } catch (err) {
        logger.warn('[Motrix] fetchPreference failed:', err.message)
        return {}
      }
    },
    save(config) {
      const taskStore = useTaskStore()
      taskStore.saveSession()

      if (isEmpty(config)) {
        return Promise.resolve()
      }

      this.updatePreference(config)
      return Promise.resolve(api.savePreference(config))
    },
    recordHistoryDirectory(directory) {
      const { historyDirectories = [], favoriteDirectories = [] } = this.config as any
      const all = new Set([...historyDirectories, ...favoriteDirectories])
      if (all.has(directory)) {
        return
      }

      this.addHistoryDirectory(directory)
    },
    addHistoryDirectory(directory) {
      const { historyDirectories = [] } = this.config as any
      const history = pushItemToFixedLengthArray(
        historyDirectories,
        MAX_NUM_OF_DIRECTORIES,
        directory,
      )

      this.save({ historyDirectories: history })
    },
    favoriteDirectory(directory) {
      const { historyDirectories = [], favoriteDirectories = [] } = this.config as any
      if (
        favoriteDirectories.includes(directory) ||
        favoriteDirectories.length >= MAX_NUM_OF_DIRECTORIES
      ) {
        return
      }

      const favorite = pushItemToFixedLengthArray(
        favoriteDirectories,
        MAX_NUM_OF_DIRECTORIES,
        directory,
      )
      const history = removeArrayItem(historyDirectories, directory)

      this.save({
        historyDirectories: history,
        favoriteDirectories: favorite,
      })
    },
    cancelFavoriteDirectory(directory) {
      const { historyDirectories = [], favoriteDirectories = [] } = this.config as any
      if (historyDirectories.includes(directory)) {
        return
      }

      const favorite = removeArrayItem(favoriteDirectories, directory)
      const history = pushItemToFixedLengthArray(
        historyDirectories,
        MAX_NUM_OF_DIRECTORIES,
        directory,
      )

      this.save({
        historyDirectories: history,
        favoriteDirectories: favorite,
      })
    },
    removeDirectory(directory) {
      const { historyDirectories = [], favoriteDirectories = [] } = this.config as any

      const favorite = removeArrayItem(favoriteDirectories, directory)
      const history = removeArrayItem(historyDirectories, directory)

      this.save({
        historyDirectories: history,
        favoriteDirectories: favorite,
      })
    },
    updateAppTheme(theme) {
      this.updatePreference({ theme })
    },
    updateAppLocale(locale) {
      this.updatePreference({ locale: locale || 'en-US' })
    },
    updatePreference(config) {
      this.config = { ...this.config, ...config }
    },
    fetchBtTracker(trackerSource = []) {
      const { proxy = { enable: false } } = this.config as any
      logger.log('fetchBtTracker', trackerSource, proxy)
      return fetchBtTrackerFromSource(trackerSource, proxy)
    },
    toggleEngineMode() {
      const nextMode = this.engineMode === 'MAX' ? 'LIMIT' : 'MAX'
      this.engineMode = nextMode

      const config = this.config as any
      const isMax = nextMode === 'MAX'
      api.changeGlobalOption({
        'max-overall-download-limit': isMax ? 0 : (config.maxOverallDownloadLimit ?? 0),
        'max-overall-upload-limit': isMax ? 0 : (config.maxOverallUploadLimit ?? 0),
      })
    },
  },
})
