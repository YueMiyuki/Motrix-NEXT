import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import { debounce } from 'lodash'
import { app, shell, screen, BrowserWindow } from 'electron'
import is from 'electron-is'

import pageConfig from '../configs/page'
import logger from '../core/Logger'

const baseBrowserOptions = {
  titleBarStyle: 'hiddenInset',
  show: false,
  width: 1024,
  height: 768,
  backgroundColor: '#fff',
  webPreferences: {
    nodeIntegration: true
  }
}

// fix: BrowserWindow rendering bug under linux
const defaultBrowserOptions = is.macOS()
  ? {
    ...baseBrowserOptions,
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    backgroundColor: '#00000000'
  }
  : {
    ...baseBrowserOptions
  }

export default class WindowManager extends EventEmitter {
  [key: string]: any
  constructor (options: any = {}) {
    super()
    this.userConfig = options.userConfig || {}

    this.windows = {}

    this.willQuit = false

    this.handleBeforeQuit()

    this.handleAllWindowClosed()
  }

  setWillQuit (flag) {
    this.willQuit = flag
  }

  getPageOptions (page) {
    const result = pageConfig[page] || {}
    const hideAppMenu = this.userConfig['hide-app-menu']
    if (hideAppMenu) {
      result.attrs.frame = false
    }

    // Optimized for small screen users
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    const widthScale = width >= 1280 ? 1 : 0.875
    const heightScale = height >= 800 ? 1 : 0.875
    result.attrs.width *= widthScale
    result.attrs.height *= heightScale

    // fix AppImage Dock Icon Missing
    // https://github.com/AppImage/AppImageKit/wiki/Bundling-Electron-apps
    if (is.linux()) {
      result.attrs.icon = join(__static, './512x512.png')
    }

    return result
  }

  getPageBounds (page) {
    const enabled = this.userConfig['keep-window-state']
    const windowStateMap = this.userConfig['window-state'] || {}
    let result = null
    if (enabled) {
      result = windowStateMap[page]
    }

    return result
  }

  openWindow (page: string, options: any = {}) {
    const pageOptions = this.getPageOptions(page)
    const { hidden } = options
    const autoHideWindow = this.userConfig['auto-hide-window']
    let window = this.windows[page] || null
    if (window) {
      window.show()
      window.focus()
      return window
    }

    window = new BrowserWindow({
      ...defaultBrowserOptions,
      ...pageOptions.attrs,
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: true,
        nodeIntegrationInWorker: true
      }
    })

    const bounds = this.getPageBounds(page)
    if (bounds) {
      window.setBounds(bounds)
    }

    if (is.dev() && pageOptions.openDevTools) {
      window.webContents.openDevTools()
    }

    window.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: 'deny' }
    })

    if (pageOptions.url) {
      window.loadURL(pageOptions.url)
    }

    window.once('ready-to-show', () => {
      if (!hidden) {
        window.show()
      }
    })

    window.on('enter-full-screen', () => {
      this.emit('enter-full-screen', window)
    })

    window.on('leave-full-screen', () => {
      this.emit('leave-full-screen', window)
    })

    this.handleWindowState(page, window)

    this.handleWindowClose(pageOptions, page, window)
    this.bindRendererRecovery(page, window)

    this.bindAfterClosed(page, window)

    this.addWindow(page, window)
    if (autoHideWindow) {
      this.handleWindowBlur()
    }

    return window
  }

  getWindow (page) {
    return this.windows[page]
  }

  getWindows () {
    return this.windows || {}
  }

  getWindowList (): any[] {
    return Object.values(this.getWindows()) as any[]
  }

  addWindow (page, window) {
    this.windows[page] = window
  }

  destroyWindow (page) {
    const win = this.getWindow(page)
    if (!win) {
      return
    }

    this.removeWindow(page)
    win.removeAllListeners('closed')
    win.removeAllListeners('move')
    win.removeAllListeners('resize')
    win.webContents.removeAllListeners('render-process-gone')
    win.destroy()
  }

  removeWindow (page) {
    this.windows[page] = null
  }

  bindAfterClosed (page, window) {
    window.on('closed', (event) => {
      this.removeWindow(page)
    })
  }

  handleWindowState (page, window) {
    window.on('resize', debounce(() => {
      const bounds = window.getBounds()
      this.emit('window-resized', { page, bounds })
    }, 500))

    window.on('move', debounce(() => {
      const bounds = window.getBounds()
      this.emit('window-moved', { page, bounds })
    }, 500))
  }

  handleWindowClose (pageOptions, page, window) {
    window.on('close', (event) => {
      if (pageOptions.bindCloseToHide && !this.willQuit) {
        event.preventDefault()

        // @see https://github.com/electron/electron/issues/20263
        if (window.isFullScreen()) {
          window.once('leave-full-screen', () => window.hide())

          window.setFullScreen(false)
        } else {
          window.hide()
        }
      }
      const bounds = window.getBounds()
      this.emit('window-closed', { page, bounds })
    })
  }

  bindRendererRecovery (page, window) {
    let recovering = false
    window.webContents.on('render-process-gone', (event, details) => {
      logger.error('[Motrix] renderer process gone:', page, details)
      if (recovering || window.isDestroyed() || this.willQuit) {
        return
      }

      recovering = true
      setTimeout(() => {
        if (!window.isDestroyed()) {
          window.reload()
          window.show()
        }
        recovering = false
      }, 500)
    })
  }

  showWindow (page) {
    const window = this.getWindow(page)
    if (!window || (window.isVisible() && !window.isMinimized())) {
      return
    }

    window.show()
  }

  hideWindow (page) {
    const window = this.getWindow(page)
    if (!window || !window.isVisible()) {
      return
    }
    window.hide()
  }

  hideAllWindow () {
    this.getWindowList().forEach((window: any) => {
      window?.hide()
    })
  }

  toggleWindow (page) {
    const window = this.getWindow(page)
    if (!window) {
      return
    }

    if (!window.isVisible() || window.isFullScreen()) {
      window.show()
    } else {
      window.hide()
    }
  }

  getFocusedWindow () {
    return BrowserWindow.getFocusedWindow()
  }

  handleBeforeQuit () {
    app.on('before-quit', () => {
      this.setWillQuit(true)
    })
  }

  onWindowBlur (event, window) {
    window.hide()
  }

  handleWindowBlur () {
    app.on('browser-window-blur', this.onWindowBlur)
  }

  unbindWindowBlur () {
    app.removeListener('browser-window-blur', this.onWindowBlur)
  }

  handleAllWindowClosed () {
    app.on('window-all-closed', () => {
      // Keep app alive in tray mode; app lifecycle is managed elsewhere.
    })
  }

  sendCommandTo (window, command, ...args) {
    if (!window) {
      return
    }
    logger.info('[Motrix] send command to:', command, ...args)
    window.webContents.send('command', command, ...args)
  }

  sendMessageTo (window, channel, ...args) {
    if (!window) {
      return
    }
    window.webContents.send(channel, ...args)
  }
}
