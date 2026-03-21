import logger from '@shared/utils/logger'
import { toast } from 'vue-sonner'
import { base64StringToBlob } from 'blob-util'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import router from '@/router'
import { buildFileList } from '@shared/utils'
import { ADD_TASK_TYPE } from '@shared/constants'
import { getLocaleManager } from '@/components/Locale'
import { commands } from '@/components/CommandManager/instance'
import { confirm } from '@/components/ui/confirm-dialog'
import { useAppStore, usePreferenceStore, useTaskStore } from '@/store'
import { initTaskForm, buildUriPayload, buildTorrentPayload } from '@/utils/task'

const i18n = getLocaleManager().getI18n()
const getAppStore = () => useAppStore()
const getPreferenceStore = () => usePreferenceStore()
const getTaskStore = () => useTaskStore()

const updateSystemTheme = (payload: any = {}) => {
  const { theme } = payload
  getAppStore().updateSystemTheme(theme)
}

const updateTheme = (payload: any = {}) => {
  const { theme } = payload
  getPreferenceStore().updateAppTheme(theme)
}

const updateLocale = (payload: any = {}) => {
  const { locale } = payload
  getPreferenceStore().updateAppLocale(locale)
}

const updateTrayFocused = (payload: any = {}) => {
  const { focused } = payload
  getAppStore().updateTrayFocused(focused)
}

const showAboutPanel = () => {
  getAppStore().showAboutPanel()
}

const addTask = (payload: any = {}) => {
  const { type = ADD_TASK_TYPE.URI, uri, silent, ...rest } = payload

  const options = {
    ...rest,
  }

  if (type === ADD_TASK_TYPE.URI && uri) {
    getAppStore().updateAddTaskUrl(uri)
  }
  getAppStore().updateAddTaskOptions(options)

  if (silent) {
    addTaskSilent(type)
    return
  }

  getAppStore().showAddTaskDialog(type)
}

const addTaskSilent = async (type) => {
  try {
    await addTaskByType(type)
  } catch (err) {
    toast.error(i18n.t(err.message))
  }
}

const addTaskByType = async (type) => {
  const form = initTaskForm({
    app: getAppStore().$state,
    preference: getPreferenceStore().$state,
  })

  let payload = null
  if (type === ADD_TASK_TYPE.URI) {
    payload = buildUriPayload(form)
    return getTaskStore().addUri(payload)
  } else if (type === ADD_TASK_TYPE.TORRENT) {
    payload = buildTorrentPayload(form)
    return getTaskStore().addTorrent(payload)
  } else if (type === 'metalink') {
    // @TODO addMetalink
  } else {
    logger.error('addTask fail', form)
  }
}

const showAddBtTask = () => {
  getAppStore().showAddTaskDialog(ADD_TASK_TYPE.TORRENT)
}

const showAddBtTaskWithFile = (payload: any = {}) => {
  const { name, dataURL = '' } = payload
  if (!dataURL) {
    return
  }

  const blob = base64StringToBlob(dataURL, 'application/x-bittorrent')
  const file = new File([blob], name, { type: 'application/x-bittorrent' })
  const fileList = buildFileList(file)

  getAppStore().showAddTaskDialog(ADD_TASK_TYPE.TORRENT)
  setTimeout(() => {
    getAppStore().addTaskAddTorrents({ fileList })
  }, 200)
}

const navigateTaskList = (payload: any = {}) => {
  const { status = 'active' } = payload

  router.push({ path: `/task/${status}` }).catch((err) => {
    logger.log(err)
  })
}

const navigatePreferences = () => {
  router.push({ path: '/preference' }).catch((err) => {
    logger.log(err)
  })
}

const pauseTask = () => {
  getTaskStore().batchPauseSelectedTasks()
}

const resumeTask = () => {
  getTaskStore().batchResumeSelectedTasks()
}

const deleteTask = () => {
  commands.emit('batch-delete-task', {
    deleteWithFiles: false,
  })
}

const moveTaskUp = () => {
  getTaskStore()
    .moveSelectedTasks('up', {
      onSyncError: () => {
        toast.error('Syncing priority failed', {
          duration: 1800,
        })
      },
    })
    .then((movedCount) => {
      if (movedCount === 0) {
        return
      }
      toast.success(i18n.t('task.move-task-up'))
    })
    .catch(() => {
      toast.error(i18n.t('task.move-task-up'))
    })
}

const moveTaskDown = () => {
  getTaskStore()
    .moveSelectedTasks('down', {
      onSyncError: () => {
        toast.error('Syncing priority failed', {
          duration: 1800,
        })
      },
    })
    .then((movedCount) => {
      if (movedCount === 0) {
        return
      }
      toast.success(i18n.t('task.move-task-down'))
    })
    .catch(() => {
      toast.error(i18n.t('task.move-task-down'))
    })
}

const pauseAllTask = () => {
  getTaskStore().pauseAllTask()
}

const resumeAllTask = () => {
  getTaskStore().resumeAllTask()
}

const selectAllTask = () => {
  getTaskStore().selectAllTask()
}

const showTaskDetail = (payload: any = {}) => {
  const { gid } = payload
  navigateTaskList()
  if (gid) {
    getTaskStore().showTaskDetailByGid(gid)
  }
}

const fetchPreference = () => {
  getPreferenceStore().fetchPreference()
}

commands.register('application:task-list', navigateTaskList)
commands.register('application:preferences', navigatePreferences)
commands.register('application:about', showAboutPanel)

commands.register('application:new-task', addTask)
commands.register('application:new-bt-task', showAddBtTask)
commands.register('application:new-bt-task-with-file', showAddBtTaskWithFile)
commands.register('application:pause-task', pauseTask)
commands.register('application:resume-task', resumeTask)
commands.register('application:delete-task', deleteTask)
commands.register('application:move-task-up', moveTaskUp)
commands.register('application:move-task-down', moveTaskDown)
commands.register('application:pause-all-task', pauseAllTask)
commands.register('application:resume-all-task', resumeAllTask)
commands.register('application:select-all-task', selectAllTask)
commands.register('application:show-task-detail', showTaskDetail)

commands.register('application:update-preference-config', fetchPreference)
commands.register('application:update-system-theme', updateSystemTheme)
commands.register('application:update-theme', updateTheme)
commands.register('application:update-locale', updateLocale)
commands.register('application:update-tray-focused', updateTrayFocused)

// Handle quit confirmation from Tauri (Cmd+Q, tray quit).
listen('confirm-quit', async () => {
  const numActive = getAppStore().stat?.numActive ?? 0
  const message =
    numActive > 0
      ? i18n.t('app.quit-confirm-active', { count: numActive })
      : i18n.t('app.quit-confirm')

  const { confirmed } = await confirm({
    title: i18n.t('app.quit'),
    message,
    kind: numActive > 0 ? 'warning' : 'info',
    confirmText: i18n.t('app.yes'),
    cancelText: i18n.t('app.no'),
  })

  if (confirmed) {
    invoke('quit_app').catch(() => {})
  }
})
