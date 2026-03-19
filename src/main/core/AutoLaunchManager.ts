import { app } from 'electron'

import { LOGIN_SETTING_OPTIONS } from '@shared/constants'

export default class AutoLaunchManager {
  [key: string]: any
  enable() {
    return new Promise<void>((resolve, reject) => {
      const enabled = app.getLoginItemSettings(LOGIN_SETTING_OPTIONS).openAtLogin
      if (enabled) {
        resolve()
      }

      app.setLoginItemSettings({
        ...LOGIN_SETTING_OPTIONS,
        openAtLogin: true,
      })
      resolve()
    })
  }

  disable() {
    return new Promise<void>((resolve, reject) => {
      app.setLoginItemSettings({ openAtLogin: false })
      resolve()
    })
  }

  isEnabled() {
    return new Promise<boolean>((resolve, reject) => {
      const enabled = app.getLoginItemSettings(LOGIN_SETTING_OPTIONS).openAtLogin
      resolve(enabled)
    })
  }
}
