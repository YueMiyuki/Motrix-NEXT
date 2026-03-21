const isRendererProcess = typeof window !== 'undefined' && typeof document !== 'undefined'

const platform = (() => {
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes('mac')) return 'macos'
    if (ua.includes('win')) return 'windows'
    if (ua.includes('linux')) return 'linux'
  }
  return 'unknown'
})()

const fallback = {
  renderer: () => isRendererProcess,
  main: () => false,
  dev: () => import.meta.env?.DEV ?? false,
  macOS: () => platform === 'macos',
  windows: () => platform === 'windows',
  linux: () => platform === 'linux',
  mas: () => false,
}

export default fallback
