import { app as remoteApp } from '@electron/remote'

export const getMotrixVersion = () => {
  try {
    if (typeof remoteApp?.getVersion !== 'function') {
      return ''
    }

    const version = remoteApp.getVersion()
    return version ? `v${version}` : ''
  } catch (error) {
    return ''
  }
}
