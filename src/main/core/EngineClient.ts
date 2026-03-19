'use strict'

import { Aria2 } from '@shared/aria2'

import logger from './Logger'
import { compactUndefined, formatOptionsForEngine } from '@shared/utils'
import { ENGINE_RPC_HOST, ENGINE_RPC_PORT, EMPTY_STRING } from '@shared/constants'

const defaults = {
  host: ENGINE_RPC_HOST,
  port: ENGINE_RPC_PORT,
  secret: EMPTY_STRING,
}

export default class EngineClient {
  [key: string]: any
  static instance = null
  static client = null

  constructor(options: any = {}) {
    this.options = {
      ...defaults,
      ...options,
    }

    this.init()
  }

  init() {
    this.connect()
  }

  connect() {
    logger.info('[Motrix] main engine client connect', this.options)
    const { host, port, secret } = this.options
    this.client = new Aria2({
      host,
      port,
      secret,
    })
    this.connected = this.openWithRetry()
  }

  async openWithRetry(retries = 5, delay = 1000) {
    for (let i = 0; i < retries; i++) {
      try {
        await this.client.open()
        logger.info('[Motrix] main engine client connected')
        return
      } catch (err) {
        logger.warn(`[Motrix] main engine client open attempt ${i + 1} failed:`, err.message)
        if (i < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }
    logger.warn('[Motrix] main engine client failed to connect after retries, using HTTP fallback')
  }

  async ensureReady() {
    await this.connected
    return this.client
  }

  async call(method, ...args) {
    await this.ensureReady()
    return this.client.call(method, ...args).catch((err) => {
      logger.warn('[Motrix] call client fail:', err.message)
    })
  }

  async changeGlobalOption(options) {
    logger.info('[Motrix] change engine global option:', options)
    const args = formatOptionsForEngine(options)

    return this.call('changeGlobalOption', args)
  }

  async shutdown(options: any = {}) {
    const { force = false } = options
    const { secret } = this.options

    const method = force ? 'forceShutdown' : 'shutdown'
    const args = compactUndefined([secret])
    return this.call(method, ...args)
  }
}
