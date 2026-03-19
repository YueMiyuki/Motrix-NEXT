import { ipcRenderer } from 'electron'
import is from 'electron-is'
import { isEmpty, clone } from 'lodash'
import { Aria2 } from '@shared/aria2'
import logger from '@shared/utils/logger'
import {
  separateConfig,
  compactUndefined,
  formatOptionsForEngine,
  mergeTaskResult,
  changeKeysToCamelCase,
  changeKeysToKebabCase,
} from '@shared/utils'
import { ENGINE_RPC_HOST, ENGINE_RPC_PORT, EMPTY_STRING } from '@shared/constants'

export default class Api {
  [key: string]: any
  constructor(options: any = {}) {
    this.options = options

    this.ready = this.init()
  }

  async init() {
    this.config = await this.loadConfig()

    this.client = this.initClient()
    this.client.open()
  }

  async ensureReady() {
    await this.ready
    return this.client
  }

  loadConfigFromLocalStorage() {
    // TODO
    const result = {}
    return result
  }

  async loadConfigFromNativeStore() {
    const result = await ipcRenderer.invoke('get-app-config')
    return result
  }

  async loadConfig() {
    let result = is.renderer()
      ? await this.loadConfigFromNativeStore()
      : this.loadConfigFromLocalStorage()

    result = changeKeysToCamelCase(result)
    return result
  }

  initClient() {
    const port = Number(this.config?.rpcListenPort) || ENGINE_RPC_PORT
    const secret = this.config?.rpcSecret || EMPTY_STRING
    const host = ENGINE_RPC_HOST
    return new Aria2({
      host,
      port,
      secret,
    })
  }

  closeClient() {
    this.ensureReady()
      .then((client) => client.close())
      .then(() => {
        this.client = null
      })
      .catch((err) => {
        logger.log('engine client close fail', err)
      })
  }

  async fetchPreference() {
    this.config = await this.loadConfig()
    return this.config
  }

  savePreference(params: any = {}) {
    const kebabParams = changeKeysToKebabCase(params)
    if (is.renderer()) {
      return this.savePreferenceToNativeStore(kebabParams)
    } else {
      return this.savePreferenceToLocalStorage(kebabParams)
    }
  }

  savePreferenceToLocalStorage(params: any = {}) {
    // TODO
    return params
  }

  savePreferenceToNativeStore(params: any = {}) {
    const { user, system, others } = separateConfig(params)
    const config: any = {}

    if (!isEmpty(user)) {
      logger.info('[Motrix] save user config: ', user)
      config.user = user
    }

    if (!isEmpty(system)) {
      logger.info('[Motrix] save system config: ', system)
      config.system = system
      this.updateActiveTaskOption(system)
    }

    if (!isEmpty(others)) {
      logger.info('[Motrix] save config found illegal key: ', others)
    }

    ipcRenderer.send('command', 'application:save-preference', config)
  }

  getVersion() {
    return this.ensureReady().then((client) => client.call('getVersion'))
  }

  changeGlobalOption(options) {
    const args = formatOptionsForEngine(options)

    return this.ensureReady().then((client) => client.call('changeGlobalOption', args))
  }

  getGlobalOption() {
    return this.ensureReady()
      .then((client) => client.call('getGlobalOption'))
      .then((data) => {
        return changeKeysToCamelCase(data)
      })
  }

  getOption(params: any = {}) {
    const { gid } = params
    const args = compactUndefined([gid])

    return this.ensureReady()
      .then((client) => client.call('getOption', ...args))
      .then((data) => {
        return changeKeysToCamelCase(data)
      })
  }

  updateActiveTaskOption(options) {
    this.fetchTaskList({ type: 'active' }).then((data) => {
      if (isEmpty(data)) {
        return
      }

      const gids = data.map((task) => task.gid)
      this.batchChangeOption({ gids, options })
    })
  }

  changeOption(params: any = {}) {
    const { gid, options = {} } = params

    const engineOptions = formatOptionsForEngine(options)
    const args = compactUndefined([gid, engineOptions])

    return this.ensureReady().then((client) => client.call('changeOption', ...args))
  }

  getGlobalStat() {
    return this.ensureReady().then((client) => client.call('getGlobalStat'))
  }

  addUri(params: any) {
    const { uris, outs, options } = params
    const tasks = uris.map((uri, index) => {
      const engineOptions: any = formatOptionsForEngine(options)
      if (outs && outs[index]) {
        engineOptions.out = outs[index]
      }
      const args = compactUndefined([[uri], engineOptions])
      return ['aria2.addUri', ...args]
    })
    return this.ensureReady().then((client) => client.multicall(tasks))
  }

  addTorrent(params: any) {
    const { torrent, options } = params
    const engineOptions = formatOptionsForEngine(options)
    const args = compactUndefined([torrent, [], engineOptions])
    return this.ensureReady().then((client) => client.call('addTorrent', ...args))
  }

  addMetalink(params: any) {
    const { metalink, options } = params
    const engineOptions = formatOptionsForEngine(options)
    const args = compactUndefined([metalink, engineOptions])
    return this.ensureReady().then((client) => client.call('addMetalink', ...args))
  }

  fetchDownloadingTaskList(params: any = {}) {
    const { offset = 0, num = 20, keys } = params
    const activeArgs = compactUndefined([keys])
    const waitingArgs = compactUndefined([offset, num, keys])
    return new Promise((resolve, reject) => {
      this.ensureReady()
        .then((client) =>
          client.multicall([
            ['aria2.tellActive', ...activeArgs],
            ['aria2.tellWaiting', ...waitingArgs],
          ]),
        )
        .then((data) => {
          logger.log('[Motrix] fetch downloading task list data:', data)
          const result = mergeTaskResult(data)
          resolve(result)
        })
        .catch((err) => {
          logger.log('[Motrix] fetch downloading task list fail:', err)
          reject(err)
        })
    })
  }

  fetchWaitingTaskList(params: any = {}) {
    const { offset = 0, num = 20, keys } = params
    const args = compactUndefined([offset, num, keys])
    return this.ensureReady().then((client) => client.call('tellWaiting', ...args))
  }

  fetchStoppedTaskList(params: any = {}) {
    const { offset = 0, num = 20, keys } = params
    const args = compactUndefined([offset, num, keys])
    return this.ensureReady().then((client) => client.call('tellStopped', ...args))
  }

  fetchActiveTaskList(params: any = {}) {
    const { keys } = params
    const args = compactUndefined([keys])
    return this.ensureReady().then((client) => client.call('tellActive', ...args))
  }

  fetchTaskList(params: any = {}) {
    const { type } = params
    switch (type) {
      case 'active':
        return this.fetchDownloadingTaskList(params)
      case 'waiting':
        return this.fetchWaitingTaskList(params)
      case 'stopped':
        return this.fetchStoppedTaskList(params)
      default:
        return this.fetchDownloadingTaskList(params)
    }
  }

  fetchTaskItem(params: any = {}) {
    const { gid, keys } = params
    const args = compactUndefined([gid, keys])
    return this.ensureReady().then((client) => client.call('tellStatus', ...args))
  }

  fetchTaskItemWithPeers(params: any = {}) {
    const { gid, keys } = params
    const statusArgs = compactUndefined([gid, keys])
    const peersArgs = compactUndefined([gid])
    return new Promise((resolve, reject) => {
      this.ensureReady()
        .then((client) =>
          client.multicall([
            ['aria2.tellStatus', ...statusArgs],
            ['aria2.getPeers', ...peersArgs],
          ]),
        )
        .then((data) => {
          logger.log('[Motrix] fetchTaskItemWithPeers:', data)
          const result = data[0] && data[0][0]
          const peers = data[1] && data[1][0]
          if (!result) {
            resolve(null)
            return
          }
          result.peers = peers || []
          logger.log('[Motrix] fetchTaskItemWithPeers.result:', result)
          logger.log('[Motrix] fetchTaskItemWithPeers.peers:', peers)

          resolve(result)
        })
        .catch((err) => {
          logger.log('[Motrix] fetch downloading task list fail:', err)
          reject(err)
        })
    })
  }

  fetchTaskItemPeers(params: any = {}) {
    const { gid, keys } = params
    const args = compactUndefined([gid, keys])
    return this.ensureReady().then((client) => client.call('getPeers', ...args))
  }

  pauseTask(params: any = {}) {
    const { gid } = params
    const args = compactUndefined([gid])
    return this.ensureReady().then((client) => client.call('pause', ...args))
  }

  pauseAllTask(params: any = {}) {
    return this.ensureReady().then((client) => client.call('pauseAll'))
  }

  forcePauseTask(params: any = {}) {
    const { gid } = params
    const args = compactUndefined([gid])
    return this.ensureReady().then((client) => client.call('forcePause', ...args))
  }

  forcePauseAllTask(params: any = {}) {
    return this.ensureReady().then((client) => client.call('forcePauseAll'))
  }

  resumeTask(params: any = {}) {
    const { gid } = params
    const args = compactUndefined([gid])
    return this.ensureReady().then((client) => client.call('unpause', ...args))
  }

  resumeAllTask(params: any = {}) {
    return this.ensureReady().then((client) => client.call('unpauseAll'))
  }

  removeTask(params: any = {}) {
    const { gid } = params
    const args = compactUndefined([gid])
    return this.ensureReady().then((client) => client.call('remove', ...args))
  }

  forceRemoveTask(params: any = {}) {
    const { gid } = params
    const args = compactUndefined([gid])
    return this.ensureReady().then((client) => client.call('forceRemove', ...args))
  }

  saveSession(params: any = {}) {
    return this.ensureReady().then((client) => client.call('saveSession'))
  }

  purgeTaskRecord(params: any = {}) {
    return this.ensureReady().then((client) => client.call('purgeDownloadResult'))
  }

  removeTaskRecord(params: any = {}) {
    const { gid } = params
    const args = compactUndefined([gid])
    return this.ensureReady().then((client) => client.call('removeDownloadResult', ...args))
  }

  multicall(method: string, params: any = {}) {
    let { gids, options = {} } = params
    options = formatOptionsForEngine(options)

    const data = gids.map((gid, index) => {
      const _options = clone(options)
      const args = compactUndefined([gid, _options])
      return [method, ...args]
    })
    return this.ensureReady().then((client) => client.multicall(data))
  }

  batchChangeOption(params: any = {}) {
    return this.multicall('aria2.changeOption', params)
  }

  batchRemoveTask(params: any = {}) {
    return this.multicall('aria2.remove', params)
  }

  batchResumeTask(params: any = {}) {
    return this.multicall('aria2.unpause', params)
  }

  batchPauseTask(params: any = {}) {
    return this.multicall('aria2.pause', params)
  }

  batchForcePauseTask(params: any = {}) {
    return this.multicall('aria2.forcePause', params)
  }
}
