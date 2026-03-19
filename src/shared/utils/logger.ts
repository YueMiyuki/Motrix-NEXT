/* eslint-disable no-console */
const isDev = process.env.NODE_ENV !== 'production'

const logger = {
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args)
    }
  },
  debug: (...args: any[]) => {
    if (isDev) {
      console.debug(...args)
    }
  },
  info: (...args: any[]) => {
    if (isDev) {
      console.info(...args)
    }
  },
  warn: (...args: any[]) => {
    console.warn(...args)
  },
  error: (...args: any[]) => {
    console.error(...args)
  },
}

export default logger
