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
    <div class="torrent-info">
      <ui-tooltip class="item torrent-name" effect="dark" :content="name" placement="top">
        <span>{{ name }}</span>
      </ui-tooltip>
      <span class="torrent-actions" @click="handleTrashClick">
        <Trash :size="14" />
      </span>
    </div>
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
import TaskFiles from '@/components/TaskDetail/TaskFiles.vue'
import { Inbox, Trash } from 'lucide-vue-next'
import { EMPTY_STRING, NONE_SELECTED_FILES, SELECTED_ALL_FILES } from '@shared/constants'
import { listTorrentFiles, getAsBase64 } from '@shared/utils'

export default {
  name: 'mo-select-torrent',
  components: {
    [TaskFiles.name]: TaskFiles,
    Inbox,
    Trash,
  },
  data() {
    return {
      name: EMPTY_STRING,
      currentTorrent: EMPTY_STRING,
      files: [],
      isDragOver: false,
    }
  },
  computed: {
    torrents() {
      return useAppStore().addTaskTorrents
    },
    isTorrentsEmpty() {
      return this.torrents.length === 0
    },
  },
  watch: {
    torrents: {
      immediate: true,
      async handler(fileList) {
        await this.processTorrents(fileList)
      },
    },
  },
  methods: {
    async processTorrents(fileList = []) {
      if (!Array.isArray(fileList) || fileList.length === 0) {
        this.reset()
        return
      }

      const file = fileList[0]
      if (!file?.raw) {
        this.reset()
        return
      }

      try {
        const parsedFiles = await this.parseTorrentFiles(file.raw)
        this.files = listTorrentFiles(parsedFiles)
        getAsBase64(file.raw, (torrent) => {
          this.name = file.name
          this.currentTorrent = torrent
          this.$emit('change', torrent, SELECTED_ALL_FILES)
          this.$nextTick(() => {
            this.$refs.torrentFileList?.toggleAllSelection()
          })
        })
      } catch (err: any) {
        logger.warn('[Motrix] parse torrent failed:', err?.message || err)
        this.reset()
        this.$msg.error(this.$t('task.new-task-torrent-required'))
      }
    },
    decodeUtf8(bytes) {
      try {
        return new TextDecoder('utf-8').decode(bytes)
      } catch {
        return ''
      }
    },
    decodeBencode(bytes, offset = 0) {
      const ch = bytes[offset]
      // integer: i123e
      if (ch === 0x69) {
        let cursor = offset + 1
        while (cursor < bytes.length && bytes[cursor] !== 0x65) {
          cursor += 1
        }
        const text = this.decodeUtf8(bytes.slice(offset + 1, cursor))
        const value = Number(text)
        return {
          value: Number.isFinite(value) ? value : 0,
          next: cursor + 1,
        }
      }

      // list: l...e
      if (ch === 0x6c) {
        const value = []
        let cursor = offset + 1
        while (cursor < bytes.length && bytes[cursor] !== 0x65) {
          const parsed = this.decodeBencode(bytes, cursor)
          value.push(parsed.value)
          cursor = parsed.next
        }
        return {
          value,
          next: cursor + 1,
        }
      }

      // dictionary: d...e
      if (ch === 0x64) {
        const value = {}
        let cursor = offset + 1
        while (cursor < bytes.length && bytes[cursor] !== 0x65) {
          const keyParsed = this.decodeBencode(bytes, cursor)
          const key =
            keyParsed.value instanceof Uint8Array
              ? this.decodeUtf8(keyParsed.value)
              : `${keyParsed.value || ''}`
          cursor = keyParsed.next
          const valParsed = this.decodeBencode(bytes, cursor)
          value[key] = valParsed.value
          cursor = valParsed.next
        }
        return {
          value,
          next: cursor + 1,
        }
      }

      // byte string: <len>:<bytes>
      let cursor = offset
      while (cursor < bytes.length && bytes[cursor] !== 0x3a) {
        cursor += 1
      }
      const lenText = this.decodeUtf8(bytes.slice(offset, cursor))
      const len = Number(lenText)
      const start = cursor + 1
      const end = start + (Number.isFinite(len) ? len : 0)
      return {
        value: bytes.slice(start, end),
        next: end,
      }
    },
    asString(value) {
      if (value instanceof Uint8Array) {
        return this.decodeUtf8(value)
      }
      if (typeof value === 'string') {
        return value
      }
      if (typeof value === 'number') {
        return `${value}`
      }
      return ''
    },
    pickKey(obj, keys = []) {
      for (const key of keys) {
        if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
          return obj[key]
        }
      }
      return null
    },
    normalizeTorrentPath(path) {
      return `${path || ''}`.replace(/\\/g, '/').replace(/^\/+/, '')
    },
    async parseTorrentFiles(rawFile) {
      const buffer = await rawFile.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      const parsed = this.decodeBencode(bytes, 0)
      const root = parsed.value || {}
      const info = root.info || {}

      const rootName = this.asString(this.pickKey(info, ['name.utf-8', 'name'])) || rawFile.name
      const files = this.pickKey(info, ['files'])
      if (Array.isArray(files) && files.length > 0) {
        return files
          .map((item) => {
            const length = Number(item.length || 0)
            const pathList = this.pickKey(item, ['path.utf-8', 'path'])
            const segments = Array.isArray(pathList)
              ? pathList.map((segment) => this.asString(segment)).filter(Boolean)
              : []
            const relativePath = this.normalizeTorrentPath(segments.join('/'))
            const fullPath = relativePath
              ? this.normalizeTorrentPath(`${rootName}/${relativePath}`)
              : this.normalizeTorrentPath(rootName)
            const name = segments.length > 0 ? segments[segments.length - 1] : rootName
            return {
              path: fullPath,
              length,
              name,
            }
          })
          .filter((item) => item.path)
      }

      const length = Number(info.length || 0)
      const singlePath = this.normalizeTorrentPath(rootName)
      return [
        {
          path: singlePath,
          length,
          name: rootName,
        },
      ]
    },
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
      this.handleChange(fileList)
    },
    onDrop(event) {
      this.isDragOver = false
      const files = event.dataTransfer?.files
      if (!files || files.length === 0) return
      const file = files[0]
      if (!/\.torrent$/i.test(file.name)) return
      const fileList = [{ name: file.name, raw: file }]
      this.handleChange(fileList)
    },
    handleChange(fileList) {
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
