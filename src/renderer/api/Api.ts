import { invoke } from '@tauri-apps/api/core'
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

const RPC_CONFIG_KEYS = ['rpc-host', 'rpc-listen-port', 'rpc-secret']

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

  async loadConfigFromNativeStore() {
    const result = await invoke('get_app_config')
    return result
  }

  async loadConfig() {
    let result = await this.loadConfigFromNativeStore()
    result = changeKeysToCamelCase(result)
    return result
  }

  getRpcConnectionConfig(config: any = this.config) {
    const port = Number(config?.rpcListenPort) || ENGINE_RPC_PORT
    const secret = config?.rpcSecret || EMPTY_STRING
    const host = `${config?.rpcHost || ENGINE_RPC_HOST}`.trim() || ENGINE_RPC_HOST
    return {
      host,
      port,
      secret,
    }
  }

  isSameClientConfig(nextConfig: any = this.config) {
    if (!this.client) {
      return false
    }

    const { host, port, secret } = this.getRpcConnectionConfig(nextConfig)
    return this.client.host === host && this.client.port === port && this.client.secret === secret
  }

  async reconnectClient(nextConfig: any = this.config) {
    this.config = nextConfig

    if (!this.client) {
      this.client = this.initClient()
      this.client.open().catch((err) => {
        logger.log('engine client reconnect open fail', err)
      })
      return
    }

    if (this.isSameClientConfig(nextConfig)) {
      return
    }

    try {
      await this.client.close()
    } catch (err) {
      logger.log('engine client close before reconnect fail', err)
    }

    const { host, port, secret } = this.getRpcConnectionConfig(nextConfig)
    this.client.host = host
    this.client.port = port
    this.client.secret = secret
    this.client.open().catch((err) => {
      logger.log('engine client reconnect open fail', err)
    })
  }

  initClient() {
    const { host, port, secret } = this.getRpcConnectionConfig(this.config)
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
    await this.reconnectClient(this.config)
    return this.config
  }

  async savePreference(params: any = {}) {
    const kebabParams = changeKeysToKebabCase(params)
    await this.savePreferenceToNativeStore(kebabParams)

    const shouldReconnect = Object.keys(kebabParams).some((key) => RPC_CONFIG_KEYS.includes(key))
    if (shouldReconnect) {
      this.config = await this.loadConfig()
      await this.reconnectClient(this.config)
    }
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

    return invoke('save_preference', { config })
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
      .then((data) => changeKeysToCamelCase(data))
  }

  getOption(params: any = {}) {
    const { gid } = params
    const args = compactUndefined([gid])
    return this.ensureReady()
      .then((client) => client.call('getOption', ...args))
      .then((data) => changeKeysToCamelCase(data))
  }

  updateActiveTaskOption(options) {
    this.fetchTaskList({ type: 'active' }).then((data) => {
      if (isEmpty(data)) return
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
          const result = mergeTaskResult(data)
          resolve(result)
        })
        .catch((err) => reject(err))
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
          const result = data[0] && data[0][0]
          const peers = data[1] && data[1][0]
          if (!result) {
            resolve(null)
            return
          }
          result.peers = peers || []
          resolve(result)
        })
        .catch((err) => reject(err))
    })
  }

  fetchTaskItemPeers(params: any = {}) {
    const { gid, keys } = params
    const args = compactUndefined([gid, keys])
    return this.ensureReady().then((client) => client.call('getPeers', ...args))
  }

  pauseTask(params: any = {}) {
    const { gid } = params
    return this.ensureReady().then((client) => client.call('pause', gid))
  }

  pauseAllTask() {
    return this.ensureReady().then((client) => client.call('pauseAll'))
  }

  forcePauseTask(params: any = {}) {
    const { gid } = params
    return this.ensureReady().then((client) => client.call('forcePause', gid))
  }

  forcePauseAllTask() {
    return this.ensureReady().then((client) => client.call('forcePauseAll'))
  }

  resumeTask(params: any = {}) {
    const { gid } = params
    return this.ensureReady().then((client) => client.call('unpause', gid))
  }

  resumeAllTask() {
    return this.ensureReady().then((client) => client.call('unpauseAll'))
  }

  changePosition(params: any = {}) {
    const { gid, pos = 0, how = 'POS_CUR' } = params
    return this.ensureReady().then((client) => client.call('changePosition', gid, pos, how))
  }

  removeTask(params: any = {}) {
    const { gid } = params
    return this.ensureReady().then((client) => client.call('remove', gid))
  }

  forceRemoveTask(params: any = {}) {
    const { gid } = params
    return this.ensureReady().then((client) => client.call('forceRemove', gid))
  }

  saveSession() {
    return this.ensureReady().then((client) => client.call('saveSession'))
  }

  purgeTaskRecord() {
    return this.ensureReady().then((client) => client.call('purgeDownloadResult'))
  }

  removeTaskRecord(params: any = {}) {
    const { gid } = params
    return this.ensureReady().then((client) => client.call('removeDownloadResult', gid))
  }

  multicall(method: string, params: any = {}) {
    let { gids, options = {} } = params
    options = formatOptionsForEngine(options)
    const data = gids.map((gid) => {
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
