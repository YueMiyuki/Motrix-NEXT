import { invoke } from '@tauri-apps/api/core'
import logger from '@shared/utils/logger'
import { toast } from 'vue-sonner'
import { getFileNameFromFile, isMagnetTask } from '@shared/utils'
import { APP_THEME, TASK_STATUS, TEMP_DOWNLOAD_SUFFIX } from '@shared/constants'

function joinPath(...parts: string[]): string {
  const joined = parts.filter(Boolean).join('/')
  return joined.replace(/[/\\]+/g, '/')
}

export const hasTempDownloadSuffix = (fullPath = ''): boolean => {
  return `${fullPath || ''}`.toLowerCase().endsWith(TEMP_DOWNLOAD_SUFFIX)
}

export const stripTempDownloadSuffix = (fullPath = ''): string => {
  const value = `${fullPath || ''}`
  if (!hasTempDownloadSuffix(value)) {
    return value
  }
  return value.slice(0, value.length - TEMP_DOWNLOAD_SUFFIX.length)
}

export const showItemInFolder = async (
  fullPath: string,
  { errorMsg, fallbackPath }: { errorMsg?: string; fallbackPath?: string } = {},
) => {
  const revealPath = `${fullPath || ''}`.trim()
  const fallback = `${fallbackPath || ''}`.trim()
  if (!revealPath && !fallback) return

  try {
    await invoke('reveal_in_folder', { path: revealPath || fallback })
  } catch (err) {
    logger.warn(`[Motrix] showItemInFolder fail: ${err}`)

    if (fallback && fallback !== revealPath) {
      try {
        await invoke('reveal_in_folder', { path: fallback })
        return
      } catch (fallbackErr) {
        logger.warn(`[Motrix] showItemInFolder fallback fail: ${fallbackErr}`)
      }
    }

    if (errorMsg) {
      toast.error(errorMsg)
    }
  }
}

export const openItem = async (fullPath: string) => {
  if (!fullPath) return
  return invoke('open_path', { path: fullPath })
}

export const getTaskFullPath = (
  task: any,
  options: { normalizeCompletedPath?: boolean } = {},
): string => {
  const { normalizeCompletedPath = true } = options
  const { dir, files, bittorrent } = task
  let result = dir

  if (isMagnetTask(task)) {
    return result
  }

  const isBtMultiFile = !!bittorrent?.info?.name && Array.isArray(files) && files.length > 1
  if (isBtMultiFile) {
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

  if (normalizeCompletedPath && task?.status === TASK_STATUS.COMPLETE) {
    return stripTempDownloadSuffix(result)
  }

  return result
}

export const getTaskRevealPath = (task: any): string => {
  if (!task) {
    return ''
  }

  if (isMagnetTask(task)) {
    return `${task?.dir || ''}`.trim()
  }

  const files = Array.isArray(task?.files) ? task.files : []
  const candidate = `${files.find((file: any) => `${file?.path || ''}`.trim())?.path || ''}`.trim()
  if (!candidate) {
    return getTaskFullPath(task)
  }

  if (task?.status === TASK_STATUS.COMPLETE) {
    return stripTempDownloadSuffix(candidate)
  }

  return candidate
}

export const finalizeCompletedDownloadPath = async (task: any): Promise<string> => {
  if (!task) {
    return ''
  }

  if (isMagnetTask(task)) {
    return getTaskFullPath(task)
  }

  const sourcePath = getTaskFullPath(task, {
    normalizeCompletedPath: false,
  })
  if (!hasTempDownloadSuffix(sourcePath)) {
    return sourcePath
  }

  const targetPath = stripTempDownloadSuffix(sourcePath)
  if (!targetPath || targetPath === sourcePath) {
    return sourcePath
  }

  try {
    await invoke('rename_path', {
      fromPath: sourcePath,
      toPath: targetPath,
    })
    return targetPath
  } catch (err) {
    logger.warn(`[Motrix] rename completed temp file failed: ${err}`)
    return sourcePath
  }
}

export const moveTaskFilesToTrash = async (task: any): Promise<boolean> => {
  const { dir, status } = task
  const normalizedDir = `${dir || ''}`.trim()
  const normalizedInfoHash = `${task?.infoHash || task?.bittorrent?.infoHash || ''}`.trim()
  const filesToCleanup = new Set<string>()
  const addCleanupPath = (candidate = '') => {
    const value = `${candidate || ''}`.trim()
    if (!value) return
    filesToCleanup.add(value)
  }

  if (!isMagnetTask(task)) {
    const path = getTaskFullPath(task)
    if (!path || dir === path) {
      throw new Error('task.file-path-error')
    }

    let removedMainFile = true
    try {
      await invoke('trash_item', { path })
    } catch (err) {
      logger.warn(`[Motrix] trash ${path} failed: ${err}`)
      removedMainFile = false
    }

    if (!removedMainFile) {
      return false
    }

    if (status !== TASK_STATUS.COMPLETE) {
      addCleanupPath(`${path}.aria2`)
    }
  }

  for (const cleanupPath of filesToCleanup) {
    try {
      await invoke('trash_item', { path: cleanupPath })
    } catch (err) {
      logger.warn(`[Motrix] trash ${cleanupPath} failed: ${err}`)
    }
  }

  const sidecarDir = (() => {
    if (normalizedDir) {
      return normalizedDir
    }
    const fullPath = getTaskFullPath(task)
    const normalizedPath = `${fullPath || ''}`.trim()
    if (!normalizedPath) {
      return ''
    }
    const segments = normalizedPath.split(/[/\\]/)
    segments.pop()
    return segments.join('/')
  })()

  if (sidecarDir && normalizedInfoHash) {
    try {
      await invoke('trash_generated_torrent_sidecars', {
        dir: sidecarDir,
        infoHash: normalizedInfoHash,
      })
    } catch (err) {
      logger.warn(`[Motrix] cleanup generated torrent sidecars failed: ${err}`)
    }
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
