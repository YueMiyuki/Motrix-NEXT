const isRendererProcess = typeof window !== 'undefined' && typeof document !== 'undefined'

const fallback = {
  renderer: () => isRendererProcess,
  main: () => !isRendererProcess,
  dev: () => (typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : false),
  macOS: () => (typeof navigator !== 'undefined' ? /mac/i.test(navigator.platform) : false),
  windows: () => (typeof navigator !== 'undefined' ? /win/i.test(navigator.platform) : false),
  linux: () => (typeof navigator !== 'undefined' ? /linux/i.test(navigator.platform) : false),
  mas: () => false,
}

export default fallback
