<template>
  <Dialog :open="visible" @update:open="handleDialogOpenChange">
    <DialogContent :show-close-button="false" class="add-task-dialog">
      <DialogHeader class="atd-header">
        <div class="atd-header-left">
          <div class="atd-header-icon">
            <Download :size="16" />
          </div>
          <DialogTitle class="atd-header-title">{{ $t('task.new-task') }}</DialogTitle>
        </div>
        <button type="button" class="atd-close-btn" aria-label="Close" @click="handleClose">
          <X :size="14" />
        </button>
      </DialogHeader>

      <form ref="taskForm" class="atd-form" @submit.prevent>
        <!-- Source Tabs -->
        <div class="atd-source-tabs">
          <button
            type="button"
            class="atd-source-tab"
            :class="{ 'atd-source-tab--active': type === 'uri' }"
            @click="handleTabClick({ props: { name: 'uri' } })"
          >
            <Link2 :size="14" />
            {{ $t('task.uri-task') }}
          </button>
          <button
            type="button"
            class="atd-source-tab"
            :class="{ 'atd-source-tab--active': type === 'torrent' }"
            @click="handleTabClick({ props: { name: 'torrent' } })"
          >
            <FileArchive :size="14" />
            {{ $t('task.torrent-task') }}
          </button>
        </div>

        <!-- Source Bodies (stacked) -->
        <div class="atd-source-stack">
          <div class="atd-source-body" :class="{ 'atd-source-body--active': type === 'uri' }">
            <div class="atd-source-inner">
              <Textarea
                ref="uri"
                auto-complete="off"
                rows="4"
                :placeholder="$t('task.uri-task-tips')"
                @paste="handleUriPaste"
                v-model="form.uris"
                class="atd-uri-input resize-none"
              />
            </div>
          </div>
          <div class="atd-source-body" :class="{ 'atd-source-body--active': type === 'torrent' }">
            <div class="atd-source-inner">
              <mo-select-torrent v-on:change="handleTorrentChange" />
            </div>
          </div>
        </div>

        <!-- Core Options -->
        <div class="atd-fields">
          <div class="atd-field atd-field--wide">
            <label class="atd-field-label">{{ $t('task.task-out') }}</label>
            <Input :placeholder="$t('task.task-out-tips')" v-model="form.out" />
          </div>
          <div class="atd-field atd-field--narrow">
            <label class="atd-field-label">{{ $t('task.task-split') }}</label>
            <NumberInput v-model="form.split" :min="1" :max="64" />
          </div>
          <div class="atd-field atd-field--full">
            <label class="atd-field-label">{{ $t('task.task-dir') }}</label>
            <div class="mo-input-group mo-input-group--bordered">
              <span class="mo-input-prepend">
                <mo-history-directory @selected="handleHistoryDirectorySelected" />
              </span>
              <Input
                placeholder=""
                v-model="form.dir"
                :readonly="isMas"
                class="flex-1 border-0 shadow-none rounded-none"
              />
              <span class="mo-input-append" v-if="isRenderer">
                <mo-select-directory @selected="handleNativeDirectorySelected" />
              </span>
            </div>
          </div>
        </div>

        <!-- Advanced Options -->
        <div class="atd-advanced-wrapper" :class="{ 'atd-advanced-wrapper--open': showAdvanced }">
          <div class="atd-advanced">
            <div class="atd-advanced-grid">
              <div class="atd-field atd-field--full">
                <label class="atd-field-label">{{ $t('task.task-user-agent') }}</label>
                <Textarea
                  auto-complete="off"
                  rows="2"
                  :placeholder="$t('task.task-user-agent')"
                  v-model="form.userAgent"
                  class="resize-none"
                />
              </div>
              <div class="atd-field atd-field--full">
                <label class="atd-field-label">{{ $t('task.task-authorization') }}</label>
                <Textarea
                  auto-complete="off"
                  rows="2"
                  :placeholder="$t('task.task-authorization')"
                  v-model="form.authorization"
                  class="resize-none"
                />
              </div>
              <div class="atd-field">
                <label class="atd-field-label">{{ $t('task.task-referer') }}</label>
                <Textarea
                  auto-complete="off"
                  rows="2"
                  :placeholder="$t('task.task-referer')"
                  v-model="form.referer"
                  class="resize-none"
                />
              </div>
              <div class="atd-field">
                <label class="atd-field-label">{{ $t('task.task-cookie') }}</label>
                <Textarea
                  auto-complete="off"
                  rows="2"
                  :placeholder="$t('task.task-cookie')"
                  v-model="form.cookie"
                  class="resize-none"
                />
              </div>
              <div class="atd-field atd-field--full">
                <label class="atd-field-label">
                  {{ $t('task.task-proxy') }}
                  <a
                    class="atd-field-help"
                    target="_blank"
                    href="https://github.com/agalwood/Motrix/wiki/Proxy"
                    rel="noopener noreferrer"
                  >
                    {{ $t('preferences.proxy-tips') }}
                    <ExternalLink :size="11" />
                  </a>
                </label>
                <Input placeholder="[http://][USER:PASSWORD@]HOST[:PORT]" v-model="form.allProxy" />
              </div>
              <div class="atd-field atd-field--full atd-field--checkbox">
                <ui-checkbox v-model="form.newTaskShowDownloading">
                  {{ $t('task.navigate-to-downloading') }}
                </ui-checkbox>
              </div>
            </div>
          </div>
        </div>
      </form>

      <DialogFooter class="atd-footer">
        <button
          type="button"
          class="atd-advanced-toggle"
          :class="{ 'atd-advanced-toggle--active': showAdvanced }"
          @click="showAdvanced = !showAdvanced"
        >
          <SlidersHorizontal :size="13" />
          {{ $t('task.show-advanced-options') }}
          <ChevronDown
            :size="12"
            class="atd-toggle-chevron"
            :class="{ 'atd-toggle-chevron--open': showAdvanced }"
          />
        </button>
        <div class="atd-footer-actions">
          <ui-button @click="handleCancel('taskForm')">{{ $t('app.cancel') }}</ui-button>
          <ui-button variant="primary" @click="submitForm('taskForm')">
            <Download :size="14" style="margin-right: 6px" />
            {{ $t('app.submit') }}
          </ui-button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script lang="ts">
import {
  X,
  Download,
  Link2,
  FileArchive,
  SlidersHorizontal,
  ChevronDown,
  ExternalLink,
} from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import NumberInput from '@/components/ui/NumberInput.vue'
import logger from '@shared/utils/logger'
import is from '@/shims/platform'
import { useAppStore } from '@/store/app'
import { useTaskStore } from '@/store/task'
import { usePreferenceStore } from '@/store/preference'
import { isEmpty } from 'lodash'
import HistoryDirectory from '@/components/Preference/HistoryDirectory.vue'
import SelectDirectory from '@/components/Native/SelectDirectory.vue'
import SelectTorrent from '@/components/Task/SelectTorrent.vue'
import UiButton from '@/components/ui/compat/UiButton.vue'
import { initTaskForm, buildUriPayload, buildTorrentPayload } from '@/utils/task'
import { ADD_TASK_TYPE } from '@shared/constants'
import { detectResource } from '@shared/utils'
import { readText } from '@tauri-apps/plugin-clipboard-manager'

export default {
  name: 'mo-add-task',
  components: {
    [HistoryDirectory.name]: HistoryDirectory,
    [SelectDirectory.name]: SelectDirectory,
    [SelectTorrent.name]: SelectTorrent,
    UiButton,
    NumberInput,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    Input,
    Textarea,
    X,
    Download,
    Link2,
    FileArchive,
    SlidersHorizontal,
    ChevronDown,
    ExternalLink,
  },
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      default: ADD_TASK_TYPE.URI,
    },
  },
  data() {
    return {
      formLabelWidth: '110px',
      showAdvanced: false,
      form: {},
      rules: {},
    }
  },
  computed: {
    isRenderer: () => is.renderer(),
    isMas: () => is.mas(),
    config() {
      return usePreferenceStore().config
    },
    taskType() {
      return this.type
    },
  },
  watch: {
    taskType(current, previous) {
      if (this.visible && previous === ADD_TASK_TYPE.URI) {
        return
      }

      if (current === ADD_TASK_TYPE.URI) {
        setTimeout(() => {
          this.focusUriInput()
        }, 300)
      }
    },
    visible(current, previous) {
      if (current === true) {
        document.addEventListener('keydown', this.handleHotkey)
        this.handleOpen()
      } else {
        document.removeEventListener('keydown', this.handleHotkey)
        if (previous === true) {
          this.handleClosed()
        }
      }
    },
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleHotkey)
  },
  methods: {
    focusUriInput() {
      const el = this.$refs.uri?.$el
      if (el) {
        el.focus()
      }
    },
    handleDialogOpenChange(open) {
      if (!open) {
        this.handleClose()
      }
    },
    async autofillResourceLink() {
      let content = ''
      try {
        content = await readText()
      } catch (err) {
        return
      }

      if (!content || content.length > 4096) {
        return
      }

      const hasResource = detectResource(content)
      if (!hasResource) {
        return
      }

      if (isEmpty(this.form.uris)) {
        this.form.uris = content
      }
    },
    handleOpen() {
      this.showAdvanced = false
      this.form = initTaskForm({
        app: useAppStore().$state,
        preference: usePreferenceStore().$state,
      })
      setTimeout(() => {
        this.focusUriInput()
      }, 100)

      if (this.taskType === ADD_TASK_TYPE.URI && isEmpty(this.form.uris)) {
        setTimeout(() => {
          this.autofillResourceLink()
        }, 0)
      }

      setTimeout(() => {
        this.detectThunderResource(this.form.uris)
      }, 150)
    },
    handleCancel() {
      useAppStore().hideAddTaskDialog()
    },
    handleClose() {
      const appStore = useAppStore()
      appStore.hideAddTaskDialog()
      appStore.updateAddTaskOptions({})
    },
    handleClosed() {
      // Reset state
    },
    handleHotkey(event) {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        this.submitForm('taskForm')
      }
    },
    handleTabClick(tab) {
      const name = tab?.props?.name || tab?.paneName || tab?.name
      if (name) {
        useAppStore().changeAddTaskType(name)
      }
    },
    handleUriPaste() {
      this.$nextTick(() => {
        const uris = this.form.uris
        this.detectThunderResource(uris)
      })
    },
    detectThunderResource(uris = '') {
      if (uris.includes('thunder://')) {
        this.$msg({
          type: 'warning',
          message: this.$t('task.thunder-link-tips'),
          duration: 6000,
        })
      }
    },
    handleTorrentChange(torrent, selectedFileIndex) {
      this.form.torrent = torrent
      this.form.selectFile = selectedFileIndex
    },
    handleHistoryDirectorySelected(dir) {
      this.form.dir = dir
    },
    handleNativeDirectorySelected(dir) {
      this.form.dir = dir
      usePreferenceStore().recordHistoryDirectory(dir)
    },
    async addTask(type, form) {
      let payload = null
      if (type === ADD_TASK_TYPE.URI) {
        payload = buildUriPayload(form)
        return useTaskStore().addUri(payload)
      } else if (type === ADD_TASK_TYPE.TORRENT) {
        payload = buildTorrentPayload(form)
        return useTaskStore().addTorrent(payload)
      } else if (type === 'metalink') {
        // @TODO addMetalink
      } else {
        logger.error('[Motrix] Add task fail', form)
        throw new Error('task.new-task-unsupported-type')
      }
    },
    submitForm() {
      try {
        this.addTask(this.type, this.form)
          .then(() => {
            useAppStore().hideAddTaskDialog()
            if (this.form.newTaskShowDownloading) {
              this.$router
                .push({
                  path: '/task/active',
                })
                .catch((err) => {
                  logger.log(err)
                })
            }
          })
          .catch((err) => {
            this.$msg.error(this.$t(err.message || 'task.new-task-fail'))
          })
      } catch (err) {
        this.$msg.error(this.$t(err.message || 'task.new-task-fail'))
      }
    },
  },
}
</script>
