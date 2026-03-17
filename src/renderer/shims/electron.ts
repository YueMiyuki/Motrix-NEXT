const noop = () => {}
const asyncNoop = async () => null

let electron: any = {}
if (typeof window !== 'undefined' && typeof window.require === 'function') {
  try {
    electron = window.require('electron') || {}
  } catch (err) {
    electron = {}
  }
}

const ipcRenderer = electron.ipcRenderer || {
  send: noop,
  invoke: asyncNoop,
  on: noop,
  once: noop,
  removeListener: noop
}

export { ipcRenderer }
export default electron
