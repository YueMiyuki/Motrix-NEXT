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
import { startupOnlyKeys } from '@shared/configKeys'
import {
  ENGINE_RPC_HOST,
  ENGINE_RPC_PORT,
  EMPTY_STRING,
  PROXY_SCOPES,
  TEMP_DOWNLOAD_SUFFIX,
} from '@shared/constants'

const RPC_CONFIG_KEYS = ['rpc-host', 'rpc-listen-port', 'rpc-secret']
const ENGINE_RESTART_USER_KEYS = ['idle-bt-network-guard', 'rpc-host', 'aria2-extra-args']
const DEFAULT_TASK_LIST_FETCH_SIZE = 1000
const MAX_TASK_LIST_FETCH_SIZE = 2000

const parseConfiguredTaskListFetchSize = () => {
  const raw = (import.meta as any)?.env?.VITE_TASK_LIST_FETCH_SIZE
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TASK_LIST_FETCH_SIZE
  }
  return Math.min(Math.trunc(parsed), MAX_TASK_LIST_FETCH_SIZE)
}

const TASK_LIST_FETCH_SIZE = parseConfiguredTaskListFetchSize()

const clampTaskListFetchSize = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return TASK_LIST_FETCH_SIZE
  }

  const normalized = Math.trunc(parsed)
  if (normalized > MAX_TASK_LIST_FETCH_SIZE) {
    logger.warn(
      `[Motrix] task list fetch size ${normalized} exceeds cap ${MAX_TASK_LIST_FETCH_SIZE}, clamping`,
    )
    return MAX_TASK_LIST_FETCH_SIZE
  }
  return normalized
}

const normalizeProxyBypass = (value: any) => {
  if (typeof value !== 'string') {
    return ''
  }

  return value
    .split(/[\r\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join(',')
}

const hasTempDownloadSuffix = (value = '') => {
  return value.toLowerCase().endsWith(TEMP_DOWNLOAD_SUFFIX)
}

const ensureTempDownloadSuffix = (value = '') => {
  const normalized = `${value || ''}`.trim()
  if (!normalized) {
    return ''
  }
  if (hasTempDownloadSuffix(normalized)) {
    return normalized
  }
  return `${normalized}${TEMP_DOWNLOAD_SUFFIX}`
}

const decodeUriPathSegment = (value = '') => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const inferOutFromUri = (uri = '') => {
  const raw = `${uri || ''}`.trim()
  if (!raw) {
    return ''
  }

  const pickName = (path = '') => {
    const segments = `${path || ''}`.split('/').filter(Boolean)
    if (segments.length === 0) {
      return ''
    }
    const candidate = decodeUriPathSegment(segments[segments.length - 1]).trim()
    if (!candidate || !candidate.includes('.')) {
      return ''
    }
    if (candidate.startsWith('.') || candidate.endsWith('.')) {
      return ''
    }
    return candidate
  }

  try {
    const parsed = new URL(raw)
    return pickName(parsed.pathname)
  } catch {
    const withoutHash = raw.split('#')[0]
    const withoutQuery = withoutHash.split('?')[0]
    return pickName(withoutQuery)
  }
}

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
    let kebabParams = changeKeysToKebabCase(params)
    kebabParams = this.patchProxySystemConfig(kebabParams)

    const { user, system } = separateConfig(kebabParams)
    const hasStartupOnlySystemChanges = Object.keys(system).some((key) =>
      startupOnlyKeys.includes(key),
    )
    const hasEngineRestartUserChanges = ENGINE_RESTART_USER_KEYS.some((key) =>
      Object.prototype.hasOwnProperty.call(user, key),
    )

    await this.savePreferenceToNativeStore(kebabParams)

    const shouldReconnect = Object.keys(kebabParams).some((key) => RPC_CONFIG_KEYS.includes(key))
    if (hasStartupOnlySystemChanges || hasEngineRestartUserChanges) {
      await invoke('restart_engine')
    }

    if (shouldReconnect || hasStartupOnlySystemChanges || hasEngineRestartUserChanges) {
      this.config = await this.loadConfig()
      await this.reconnectClient(this.config)
    }
  }

  patchProxySystemConfig(params: Record<string, any>) {
    if (!Object.prototype.hasOwnProperty.call(params, 'proxy')) {
      return params
    }

    const proxy = params.proxy || {}
    const proxyServer = `${proxy.server || ''}`.trim()
    const proxyScope = Array.isArray(proxy.scope) ? proxy.scope : []
    const useDownloadProxy =
      !!proxy.enable && !!proxyServer && proxyScope.includes(PROXY_SCOPES.DOWNLOAD)

    const systemProxyConfig = {
      'all-proxy': useDownloadProxy ? proxyServer : '',
      'no-proxy': useDownloadProxy ? normalizeProxyBypass(proxy.bypass) : '',
    }

    return {
      ...params,
      ...systemProxyConfig,
    }
  }

  async savePreferenceToNativeStore(params: any = {}) {
    const { user, system, others } = separateConfig(params)
    const config: any = {}

    if (!isEmpty(user)) {
      logger.info('[Motrix] save user config: ', user)
      config.user = user
    }

    if (!isEmpty(system)) {
      logger.info('[Motrix] save system config: ', system)
      config.system = system

      // Startup-only keys cannot be applied to active tasks via changeOption.
      const runtimeSystemEntries = Object.entries(system).filter(
        ([key]) => !startupOnlyKeys.includes(key),
      )
      const runtimeSystem = Object.fromEntries(runtimeSystemEntries)
      if (!isEmpty(runtimeSystem)) {
        await this.changeGlobalOption(runtimeSystem).catch((err) => {
          logger.warn('[Motrix] changeGlobalOption failed:', err?.message || err)
        })
        this.updateActiveTaskOption(runtimeSystem)
      }
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
      const preferredOut = (outs && outs[index]) || engineOptions.out || inferOutFromUri(uri)
      const tempOut = ensureTempDownloadSuffix(preferredOut)
      if (tempOut) {
        engineOptions.out = tempOut
      }
      const args = compactUndefined([[uri], engineOptions])
      return ['aria2.addUri', ...args]
    })
    return this.ensureReady()
      .then((client) => client.multicall(tasks))
      .then((result: any[] = []) => {
        const isErrorObject = (value: any) =>
          value && typeof value === 'object' && ('code' in value || 'message' in value)

        const hasItemError = (item: any) => {
          if (isErrorObject(item)) {
            return item
          }
          if (Array.isArray(item)) {
            return item.find((entry) => isErrorObject(entry))
          }
          return null
        }

        const failedItem = result.find((item) => !!hasItemError(item))
        if (failedItem) {
          const err = hasItemError(failedItem) || {}
          const error: any = new Error(err.message || 'task.new-task-fail')
          if (err.code !== undefined) {
            error.code = err.code
          }
          error.data = err
          throw error
        }

        return result
      })
  }

  addTorrent(params: any) {
    const { torrentPath, options } = params
    const engineOptions = formatOptionsForEngine(options)

    if (typeof torrentPath !== 'string' || !torrentPath.trim()) {
      throw new Error('task.new-task-torrent-required')
    }

    return invoke('add_torrent_by_path', {
      path: torrentPath,
      options: engineOptions,
    })
  }

  addMetalink(params: any) {
    const { metalink, options } = params
    const engineOptions = formatOptionsForEngine(options)
    const args = compactUndefined([metalink, engineOptions])
    return this.ensureReady().then((client) => client.call('addMetalink', ...args))
  }

  fetchDownloadingTaskList(params: any = {}) {
    const { offset = 0, num = TASK_LIST_FETCH_SIZE, keys } = params
    const safeNum = clampTaskListFetchSize(num)
    const activeArgs = compactUndefined([keys])
    const waitingArgs = compactUndefined([offset, safeNum, keys])
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
    const { offset = 0, num = TASK_LIST_FETCH_SIZE, keys } = params
    const safeNum = clampTaskListFetchSize(num)
    const args = compactUndefined([offset, safeNum, keys])
    return this.ensureReady().then((client) => client.call('tellWaiting', ...args))
  }

  fetchStoppedTaskList(params: any = {}) {
    const { offset = 0, num = TASK_LIST_FETCH_SIZE, keys } = params
    const safeNum = clampTaskListFetchSize(num)
    const args = compactUndefined([offset, safeNum, keys])
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
