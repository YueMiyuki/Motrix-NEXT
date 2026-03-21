<template>
  <div v-if="isTorrentsEmpty" class="upload-torrent">
    <div
      class="upload-torrent-drop"
      :class="{ 'is-dragover': isDragOver }"
      @dragover.prevent
      @dragenter.prevent="isDragOver = true"
      @dragleave.prevent="isDragOver = false"
      @drop.prevent="onDrop"
      @click="triggerFileInput"
    >
      <input ref="fileInput" type="file" accept=".torrent" hidden @change="onFileInputChange" />
      <i class="upload-inbox-icon"><Inbox :size="24" /></i>
      <div class="upload-text">
        {{ $t('task.select-torrent') }}
        <div class="torrent-name" v-if="name">{{ name }}</div>
      </div>
    </div>
  </div>
  <div class="selective-torrent" v-else>
    <ui-row class="torrent-info" :gutter="12">
      <ui-col class="torrent-name" :span="20">
        <ui-tooltip class="item" effect="dark" :content="name" placement="top">
          <span>{{ name }}</span>
        </ui-tooltip>
      </ui-col>
      <ui-col class="torrent-actions" :span="4">
        <span @click="handleTrashClick">
          <Trash :size="14" />
        </span>
      </ui-col>
    </ui-row>
    <mo-task-files
      ref="torrentFileList"
      mode="ADD"
      :files="files"
      :height="200"
      @selection-change="handleSelectionChange"
    />
  </div>
</template>

<script lang="ts">
import logger from '@shared/utils/logger'
import { useAppStore } from '@/store/app'
import { usePreferenceStore } from '@/store/preference'
import TaskFiles from '@/components/TaskDetail/TaskFiles.vue'
import { Inbox, Trash } from 'lucide-vue-next'
import { EMPTY_STRING, NONE_SELECTED_FILES, SELECTED_ALL_FILES } from '@shared/constants'
import { buildFileList, listTorrentFiles, getAsBase64 } from '@shared/utils'

function getParseTorrentRemote() {
  // parse-torrent depends on Node.js, so it cannot run in Tauri's webview.
  // The backend handles torrent file listing.
  return null
}

export default {
  name: 'mo-select-torrent',
  components: {
    [TaskFiles.name]: TaskFiles,
    Inbox,
    Trash,
  },
  props: {},
  data() {
    return {
      name: EMPTY_STRING,
      currentTorrent: EMPTY_STRING,
      files: [],
      selectedFiles: [],
      isDragOver: false,
    }
  },
  computed: {
    torrents() {
      return useAppStore().addTaskTorrents
    },
    config() {
      return usePreferenceStore().config
    },
    isTorrentsEmpty() {
      return this.torrents.length === 0
    },
  },
  watch: {
    torrents(fileList) {
      if (fileList.length === 0) {
        this.reset()
        return
      }

      const file = fileList[0]
      if (!file.raw) {
        return
      }

      const parseTorrentRemote = getParseTorrentRemote()
      if (!parseTorrentRemote) {
        logger.warn('[Motrix] parse-torrent is unavailable in renderer process.')
        return
      }

      parseTorrentRemote(file.raw, { timeout: 60 * 1000 }, (err, parsedTorrent) => {
        if (err) throw err
        logger.log('[Motrix] parsed torrent: ', parsedTorrent)
        this.files = listTorrentFiles(parsedTorrent.files)
        this.$refs.torrentFileList.toggleAllSelection()

        getAsBase64(file.raw, (torrent) => {
          this.name = file.name
          this.currentTorrent = torrent
          this.$emit('change', torrent, SELECTED_ALL_FILES)
        })
      })
    },
  },
  methods: {
    reset() {
      this.name = EMPTY_STRING
      this.currentTorrent = EMPTY_STRING
      this.files = []
      if (this.$refs.torrentFileList) {
        this.$refs.torrentFileList.clearSelection()
      }
      this.$emit('change', EMPTY_STRING, NONE_SELECTED_FILES)
    },
    triggerFileInput() {
      this.$refs.fileInput?.click()
    },
    onFileInputChange(event) {
      const files = event.target.files
      if (!files || files.length === 0) return
      const file = files[0]
      const fileList = [{ name: file.name, raw: file }]
      this.handleChange(fileList[0], fileList)
    },
    onDrop(event) {
      this.isDragOver = false
      const files = event.dataTransfer?.files
      if (!files || files.length === 0) return
      const file = files[0]
      if (!file.name.endsWith('.torrent')) return
      const fileList = [{ name: file.name, raw: file }]
      this.handleChange(fileList[0], fileList)
    },
    handleChange(file, fileList) {
      useAppStore().addTaskAddTorrents({ fileList })
    },
    handleExceed(files) {
      const fileList = buildFileList(files[0])
      useAppStore().addTaskAddTorrents({ fileList })
    },
    handleTrashClick() {
      useAppStore().addTaskAddTorrents({ fileList: [] })
    },
    handleSelectionChange(val) {
      const { currentTorrent } = this
      this.$emit('change', currentTorrent, val)
    },
  },
}
</script>
