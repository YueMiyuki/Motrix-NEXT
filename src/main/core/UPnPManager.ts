import NatAPI from '@motrix/nat-api'

import logger from './Logger'

let client: any = null
const mappingStatus: Record<string, boolean> = {}

export default class UPnPManager {
  [key: string]: any
  constructor(options: Record<string, any> = {}) {
    this.options = {
      ...options,
    }
  }

  init() {
    if (client) {
      return
    }

    client = new NatAPI({
      autoUpdate: true,
    })
  }

  map(port: number | string) {
    this.init()

    return new Promise<void>((resolve, reject) => {
      logger.info('[Motrix] UPnPManager port mapping: ', port)
      if (!port) {
        reject(new Error('[Motrix] port was not specified'))
        return
      }

      try {
        client.map(port, (err: any) => {
          if (err) {
            logger.warn(`[Motrix] UPnPManager map ${port} failed, error: `, err.message)
            reject(err.message)
            return
          }

          mappingStatus[port] = true
          logger.info(`[Motrix] UPnPManager port ${port} mapping succeeded`)
          resolve()
        })
      } catch (err: any) {
        reject(err.message)
      }
    })
  }

  unmap(port: number | string) {
    this.init()

    return new Promise<void>((resolve, reject) => {
      logger.info('[Motrix] UPnPManager port unmapping: ', port)
      if (!port) {
        reject(new Error('[Motrix] port was not specified'))
        return
      }

      if (!mappingStatus[port]) {
        resolve()
        return
      }

      try {
        client.unmap(port, (err: any) => {
          if (err) {
            logger.warn(`[Motrix] UPnPManager unmap ${port} failed, error: `, err)
            reject(err.message)
            return
          }

          logger.info(`[Motrix] UPnPManager port ${port} unmapping succeeded`)
          mappingStatus[port] = false
          resolve()
        })
      } catch (err: any) {
        reject(err.message)
      }
    })
  }

  closeClient() {
    if (!client) {
      return
    }

    try {
      client.destroy(() => {
        client = null
      })
    } catch (err) {
      logger.warn('[Motrix] close UPnP client fail', err)
    }
  }
}
