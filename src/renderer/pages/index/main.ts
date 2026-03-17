import is from 'electron-is'
import electron, { ipcRenderer } from 'electron'
import { createApp, configureCompat } from '@vue/compat'
import Element, { Loading, Message } from 'element-ui'
import axios from 'axios'
import VueVirtualScroller from 'vue-virtual-scroller'

import App from './App.vue'
import router from '@/router'
import store from '@/store'
import { getLocaleManager } from '@/components/Locale'
import Icon from '@/components/Icons/Icon.vue'
import Msg from '@/components/Msg'
import { commands } from '@/components/CommandManager/instance'
import TrayWorker from '@/workers/tray.worker?worker'
import './commands'

import '@/components/Theme/Index.scss'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

configureCompat({
  MODE: 2,
  INSTANCE_CHILDREN: true
})

function patchElementSelectDropdown () {
  const select = Element && Element.Select
  const selectComponents = (select && select.components) || {}
  const dropdown =
    selectComponents.ElSelectDropdown ||
    selectComponents.SelectDropdown ||
    selectComponents.ElSelectMenu ||
    Element.ElSelectDropdown ||
    Element.SelectDropdown

  if (!dropdown) {
    return
  }

  const options = dropdown.options || dropdown
  if (!options || options.__motrixPatchedSelectDropdown) {
    return
  }

  const originalMounted = options.mounted
  options.__motrixPatchedSelectDropdown = true
  options.mounted = function () {
    const parent = this.$parent
    const reference = parent && parent.$refs ? parent.$refs.reference : null
    const parentEl = parent && parent.$el
    const fallbackReference = parentEl && parentEl.querySelector
      ? parentEl.querySelector('.el-input')
      : parentEl
    this.referenceElm = (reference && (reference.$el || reference)) || fallbackReference || null
    if (parent) {
      parent.popperElm = this.popperElm = this.$el
    }

    if (typeof this.$on === 'function') {
      this.$on('updatePopper', () => {
        if (parent && parent.visible) {
          this.updatePopper()
        }
      })
      this.$on('destroyPopper', this.destroyPopper)
    } else if (typeof originalMounted === 'function') {
      try {
        originalMounted.call(this)
      } catch (err) {
        // Ignore errors here; we already set referenceElm above.
      }
    }
  }
}

function patchElementEmitterMixin () {
  const select = Element && Element.Select
  const mixins = (select && select.mixins) || []
  const emitterMixin = mixins.find((mixin) => (
    mixin &&
    mixin.methods &&
    typeof mixin.methods.dispatch === 'function' &&
    typeof mixin.methods.broadcast === 'function'
  ))

  if (!emitterMixin || emitterMixin.__motrixPatchedEmitter) {
    return
  }

  emitterMixin.__motrixPatchedEmitter = true

  emitterMixin.methods.dispatch = function dispatch (componentName, eventName, params = []) {
    let parent = this.$parent || this.$root
    let name = parent && parent.$options ? parent.$options.componentName : null

    while (parent && (!name || name !== componentName)) {
      parent = parent.$parent
      name = parent && parent.$options ? parent.$options.componentName : null
    }

    if (parent && typeof parent.$emit === 'function') {
      parent.$emit(eventName, ...params)
    }
  }

  emitterMixin.methods.broadcast = function broadcast (componentName, eventName, params = []) {
    const walk = (vm) => {
      let children = []
      try {
        children = Array.isArray(vm && vm.$children) ? vm.$children : []
      } catch (err) {
        // Vue 3 compat can disable $children, so we walk vnode children instead.
        const vnodeChildren = vm && vm.$ && vm.$.subTree ? vm.$.subTree.children : null
        if (Array.isArray(vnodeChildren)) {
          children = vnodeChildren
            .map((vnode) => vnode && vnode.component && vnode.component.proxy)
            .filter(Boolean)
        }
      }

      children.forEach((child) => {
        if (!child || !child.$options) {
          return
        }

        const name = child.$options.componentName
        if (name === componentName) {
          if (typeof child.$emit === 'function') {
            child.$emit(eventName, ...params)
          }
          return
        }

        walk(child)
      })
    }

    walk(this)
  }
}

function patchElementTabsPaneDiscovery () {
  const tabs = Element && Element.Tabs
  const methods = tabs && tabs.methods
  if (!methods || typeof methods.calcPaneInstances !== 'function' || methods.__motrixPatchedCalcPaneInstances) {
    return
  }

  methods.__motrixPatchedCalcPaneInstances = true
  methods.calcPaneInstances = function calcPaneInstances (isForceUpdate = false) {
    const defaultSlot = typeof this.$slots.default === 'function'
      ? this.$slots.default()
      : this.$slots.default

    if (!Array.isArray(defaultSlot)) {
      if (this.panes.length !== 0) {
        this.panes = []
      }
      return
    }

    const paneSlots = defaultSlot.filter((vnode) => {
      if (!vnode) {
        return false
      }

      const legacyName = vnode.componentOptions &&
        vnode.componentOptions.Ctor &&
        vnode.componentOptions.Ctor.options &&
        vnode.componentOptions.Ctor.options.name
      if (legacyName === 'ElTabPane') {
        return true
      }

      const type = vnode.type || {}
      const modernName = type.name || type.__name
      return modernName === 'ElTabPane'
    })

    const panes = paneSlots
      .map((vnode) => vnode.componentInstance || (vnode.component && vnode.component.proxy))
      .filter(Boolean)

    const panesChanged = !(
      panes.length === this.panes.length &&
      panes.every((pane, index) => pane === this.panes[index])
    )

    if (isForceUpdate || panesChanged) {
      this.panes = panes
    }
  }
}

function patchElementInputUpdatedHook () {
  const input = Element && Element.Input
  if (!input || typeof input.updated !== 'function' || input.__motrixPatchedUpdated) {
    return
  }

  input.__motrixPatchedUpdated = true
  input.updated = function updated () {}
}

patchElementSelectDropdown()
patchElementEmitterMixin()
patchElementTabsPaneDiscovery()
patchElementInputUpdatedHook()

const updateTray = is.renderer()
  ? async (payload) => {
    const { tray } = payload
    if (!tray) {
      return
    }

    const ab = await tray.arrayBuffer()
    ipcRenderer.send('command', 'application:update-tray', ab)
  }
  : () => {}

function initTrayWorker () {
  const worker = new TrayWorker()

  worker.addEventListener('message', (event) => {
    const { type, payload } = event.data

    switch (type) {
    case 'initialized':
    case 'log':
      console.log('[Motrix] Log from Tray Worker: ', payload)
      break
    case 'tray:drawed':
      updateTray(payload)
      break
    default:
      console.warn('[Motrix] Tray Worker unhandled message type:', type, payload)
    }
  })

  return worker
}

function init (config) {
  const { locale } = config
  const localeManager = getLocaleManager()
  localeManager.changeLanguageByLocale(locale)
  const i18n = localeManager.getI18n()

  const loading = Loading.service({
    fullscreen: true,
    background: 'rgba(0, 0, 0, 0.1)'
  })

  const app = createApp(App)
  app.use(store)
  app.use(router)
  app.use(VueVirtualScroller)
  app.use(Element, {
    size: 'mini',
    i18n: (key, value) => i18n.t(key, value)
  })
  app.use(Msg, Message, {
    showClose: true
  })
  app.component('mo-icon', Icon)
  app.config.globalProperties.$http = axios
  app.config.globalProperties.$electron = electron
  app.config.globalProperties.$t = (key, value) => i18n.t(key, value)

  router.isReady().then(() => {
    global.app = app.mount('#app') as any
    ;(global.app as any).commands = commands
    ;(global.app as any).trayWorker = initTrayWorker()

    setTimeout(() => {
      loading.close()
    }, 400)
  })
}

store.dispatch('preference/fetchPreference')
  .then((config) => {
    console.info('[Motrix] load preference:', config)
    init(config)
  })
  .catch((err) => {
    alert(err)
  })
