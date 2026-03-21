import { invoke } from '@tauri-apps/api/core'
import logger from '@shared/utils/logger'
import { toast } from 'vue-sonner'
import { getFileNameFromFile, isMagnetTask } from '@shared/utils'
import { APP_THEME, TASK_STATUS } from '@shared/constants'

function joinPath(...parts: string[]): string {
  const joined = parts.filter(Boolean).join('/')
  return joined.replace(/[/\\]+/g, '/')
}

export const showItemInFolder = async (
  fullPath: string,
  { errorMsg }: { errorMsg?: string } = {},
) => {
  if (!fullPath) return

  try {
    await invoke('reveal_in_folder', { path: fullPath })
  } catch (err) {
    logger.warn(`[Motrix] showItemInFolder fail: ${err}`)
    if (errorMsg) {
      toast.error(errorMsg)
    }
  }
}

export const openItem = async (fullPath: string) => {
  if (!fullPath) return
  return invoke('open_path', { path: fullPath })
}

export const getTaskFullPath = (task: any): string => {
  const { dir, files, bittorrent } = task
  let result = dir

  if (isMagnetTask(task)) {
    return result
  }

  if (bittorrent?.info?.name) {
    return joinPath(result, bittorrent.info.name)
  }

  const [file] = files
  const path = file.path || ''

  if (path) {
    result = path
  } else if (files?.length === 1) {
    const fileName = getFileNameFromFile(file)
    if (fileName) {
      result = joinPath(result, fileName)
    }
  }

  return result
}

export const moveTaskFilesToTrash = async (task: any): Promise<boolean> => {
  if (isMagnetTask(task)) {
    return true
  }

  const { dir, status } = task
  const path = getTaskFullPath(task)
  if (!path || dir === path) {
    throw new Error('task.file-path-error')
  }

  try {
    await invoke('trash_item', { path })
  } catch (err) {
    logger.warn(`[Motrix] trash ${path} failed: ${err}`)
  }

  if (status === TASK_STATUS.COMPLETE) {
    return true
  }

  const extraFilePath = `${path}.aria2`
  try {
    await invoke('trash_item', { path: extraFilePath })
  } catch (err) {
    logger.warn(`[Motrix] trash ${extraFilePath} failed: ${err}`)
  }

  return true
}

export const getSystemTheme = (): string => {
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return APP_THEME.DARK
  }
  return APP_THEME.LIGHT
}

export const delayDeleteTaskFiles = (task: any, delay: number): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    setTimeout(async () => {
      try {
        const result = await moveTaskFilesToTrash(task)
        resolve(result)
      } catch (err: any) {
        reject(err.message)
      }
    }, delay)
  })
}
