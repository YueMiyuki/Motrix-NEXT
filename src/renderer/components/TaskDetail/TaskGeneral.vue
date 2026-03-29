<template>
  <div class="mo-task-general" v-if="task">
    <div class="general-card">
      <div class="general-card-row">
        <span class="general-card-label">{{ $t('task.task-gid') }}</span>
        <span class="general-card-value mono">{{ task.gid }}</span>
      </div>
      <div class="general-card-row">
        <span class="general-card-label">{{ $t('task.task-name') }}</span>
        <span class="general-card-value">{{ taskFullName }}</span>
      </div>
      <div class="general-card-row">
        <span class="general-card-label">{{ $t('task.task-dir') }}</span>
        <span class="general-card-value general-card-value--dir">
          <span class="dir-text">{{ path }}</span>
          <mo-show-in-folder v-if="isRenderer" :path="path" />
        </span>
      </div>
      <div class="general-card-row">
        <span class="general-card-label">{{ $t('task.task-status') }}</span>
        <span class="general-card-value"
          ><mo-task-status :theme="currentTheme" :status="taskStatus"
        /></span>
      </div>
      <div class="general-card-row" v-if="task.errorCode && task.errorCode !== '0'">
        <span class="general-card-label">{{ $t('task.task-error-info') }}</span>
        <span class="general-card-value general-card-value--error"
          >{{ task.errorCode }} {{ task.errorMessage }}</span
        >
      </div>
    </div>
    <div v-if="isBT" class="general-section-header">
      <Magnet :size="14" /><span>{{ $t('task.task-bittorrent-info') }}</span>
    </div>
    <div v-if="isBT" class="general-card">
      <div class="general-card-row">
        <span class="general-card-label">{{ $t('task.task-info-hash') }}</span>
        <span class="general-card-value mono"
          >{{ task.infoHash }} <i class="copy-link" @click="handleCopyClick"><Link :size="12" /></i
        ></span>
      </div>
      <div class="general-card-row">
        <span class="general-card-label">{{ $t('task.task-piece-length') }}</span>
        <span class="general-card-value">{{ pieceLengthText }}</span>
      </div>
      <div class="general-card-row">
        <span class="general-card-label">{{ $t('task.task-num-pieces') }}</span>
        <span class="general-card-value">{{ task.numPieces }}</span>
      </div>
      <div class="general-card-row">
        <span class="general-card-label">{{ $t('task.task-bittorrent-creation-date') }}</span>
        <span class="general-card-value">{{ creationDateText }}</span>
      </div>
      <div class="general-card-row">
        <span class="general-card-label">{{ $t('task.task-bittorrent-comment') }}</span>
        <span class="general-card-value">{{ task.bittorrent.comment }}</span>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import { Magnet, Link } from 'lucide-vue-next'
import is from '@/shims/platform'
import { useAppStore } from '@/store/app'
import { usePreferenceStore } from '@/store/preference'
import {
  bytesToSize,
  checkTaskIsBT,
  checkTaskIsSeeder,
  getTaskName,
  getTaskUri,
  localeDateTimeFormat,
} from '@shared/utils'
import { APP_THEME, TASK_STATUS } from '@shared/constants'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { getTaskRevealPath } from '@/utils/native'
import ShowInFolder from '@/components/Native/ShowInFolder.vue'
import TaskStatus from '@/components/Task/TaskStatus.vue'

export default {
  name: 'mo-task-general',
  components: {
    [ShowInFolder.name]: ShowInFolder,
    [TaskStatus.name]: TaskStatus,
    Magnet,
    Link,
  },
  props: {
    task: {
      type: Object,
    },
  },
  computed: {
    isRenderer: () => is.renderer(),
    systemTheme() {
      return useAppStore().systemTheme
    },
    theme() {
      return (usePreferenceStore().config as any).theme
    },
    currentTheme() {
      return this.theme === APP_THEME.AUTO ? this.systemTheme : this.theme
    },
    taskFullName() {
      return getTaskName(this.task, {
        defaultName: this.$t('task.get-task-name'),
        maxLen: -1,
      })
    },
    isSeeder() {
      return checkTaskIsSeeder(this.task)
    },
    taskStatus() {
      return this.isSeeder ? TASK_STATUS.SEEDING : this.task.status
    },
    path() {
      return getTaskRevealPath(this.task)
    },
    isBT() {
      return checkTaskIsBT(this.task)
    },
    pieceLengthText() {
      return bytesToSize(this.task && this.task.pieceLength)
    },
    creationDateText() {
      const locale = ((usePreferenceStore().config as any) || {}).locale || 'en-US'
      const creationDate = this.task?.bittorrent?.creationDate
      return localeDateTimeFormat(creationDate, locale)
    },
  },
  methods: {
    handleCopyClick() {
      const uri = getTaskUri(this.task)
      writeText(uri).then(() => {
        this.$msg.success(this.$t('task.copy-link-success'))
      })
    },
  },
}
</script>
