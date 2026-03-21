import axios from 'axios'
import { MAX_BT_TRACKER_LENGTH, ONE_SECOND, PROXY_SCOPES } from '@shared/constants'

const TRACKER_SOURCE_CACHE_TTL = 10 * 60 * ONE_SECOND
const trackerSourceCache = new Map<string, { expiresAt: number; value: string[] }>()
const trackerSourceInFlight = new Map<string, Promise<string[]>>()

const normalizeSource = (source: string[] = []) => {
  return [...new Set(source.map((item) => String(item).trim()).filter(Boolean))].sort()
}

const convertToAxiosProxy = (proxyServer = '') => {
  if (!proxyServer) {
    return
  }

  const url = new URL(proxyServer)
  const { username, password, protocol = 'http:', hostname, port } = url

  let result: any = {
    protocol: protocol.replace(':', ''),
    host: hostname,
    port: port ? Number(port) : undefined,
  }

  const auth =
    username || password
      ? {
          username,
          password,
        }
      : undefined

  if (auth) {
    result = {
      ...result,
      auth,
    }
  }

  return result
}

const buildTrackerSourceCacheKey = (source = [], proxyServer = '') => {
  return JSON.stringify({
    proxyServer,
    source: normalizeSource(source),
  })
}

const getCachedTrackerSource = (key: string, now: number) => {
  const cached = trackerSourceCache.get(key)
  if (!cached) {
    return
  }

  if (cached.expiresAt > now) {
    return cached.value
  }

  trackerSourceCache.delete(key)
}

export const fetchBtTrackerFromSource = async (source, proxyConfig: any = {}) => {
  if (isEmptyValue(source)) {
    return []
  }

  const now = Date.now()
  const { enable, server, scope = [] } = proxyConfig
  const proxy =
    enable && server && scope.includes(PROXY_SCOPES.UPDATE_TRACKERS)
      ? convertToAxiosProxy(server)
      : undefined
  const cacheKey = buildTrackerSourceCacheKey(source, proxy ? server : '')
  const cached = getCachedTrackerSource(cacheKey, now)
  if (cached) {
    return cached
  }

  const inFlight = trackerSourceInFlight.get(cacheKey)
  if (inFlight) {
    return inFlight
  }

  // Axios's config.proxy is Node.js only
  const requestPromise = Promise.allSettled(
    source.map(async (url) => {
      return axios
        .get(`${url}?t=${now}`, {
          timeout: 30 * ONE_SECOND,
          proxy,
        })
        .then((value) => value.data)
    }),
  )
    .then((results) => {
      const values = results
        .filter((item): item is PromiseFulfilledResult<any> => item.status === 'fulfilled')
        .map((item) => item.value)
      const result = [...new Set(values)]
      trackerSourceCache.set(cacheKey, {
        value: result,
        expiresAt: Date.now() + TRACKER_SOURCE_CACHE_TTL,
      })
      return result
    })
    .finally(() => {
      trackerSourceInFlight.delete(cacheKey)
    })

  trackerSourceInFlight.set(cacheKey, requestPromise)
  return requestPromise
}

export const clearTrackerSourceCache = () => {
  trackerSourceCache.clear()
  trackerSourceInFlight.clear()
}

export const convertTrackerDataToLine = (arr = []) => {
  return arr
    .join('\r\n')
    .replace(/^\s*[\r\n]/gm, '')
    .trim()
}

// eslint-disable-next-line no-unused-vars
const convertTrackerDataToComma = (arr = []) => {
  return convertTrackerDataToLine(arr)
    .replace(/(?:\r\n|\r|\n)/g, ',')
    .trim()
}

export const reduceTrackerString = (str = '') => {
  if (str.length <= MAX_BT_TRACKER_LENGTH) {
    return str
  }

  const subStr = str.substring(0, MAX_BT_TRACKER_LENGTH)
  const index = subStr.lastIndexOf(',')
  if (index === -1) {
    return subStr
  }

  const result = subStr.substring(0, index)
  return result
}
const isEmptyValue = (value: any) => {
  if (value == null) {
    return true
  }

  if (Array.isArray(value) || typeof value === 'string') {
    return value.length === 0
  }

  if (typeof value === 'object') {
    return Object.keys(value).length === 0
  }

  return false
}
