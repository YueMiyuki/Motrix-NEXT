<template>
  <div class="content panel panel-layout panel-layout--v">
    <header class="panel-header">
      <h4 class="hidden-xs-only">{{ title }}</h4>
      <mo-subnav-switcher :title="title" :subnavs="subnavs" class="hidden-sm-and-up" />
    </header>
    <main class="panel-content">
      <form class="form-preference" ref="basicForm" @submit.prevent>
        <!-- Appearance Section -->
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="section-icon"><Palette :size="16" /></div>
            <div class="section-title">
              <h3>{{ $t('preferences.appearance') }}</h3>
            </div>
          </div>
          <div class="settings-section-content">
            <div style="margin-bottom: 16px">
              <mo-theme-switcher
                v-model="form.theme"
                @change="handleThemeChange"
                ref="themeSwitcher"
              />
            </div>
            <div v-if="showHideAppMenuOption" class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{ $t('preferences.hide-app-menu') }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox
                  :model-value="!!form.hideAppMenu"
                  @change="(val) => setBasicBoolean('hideAppMenu', val)"
                />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{ $t('preferences.auto-hide-window') }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox
                  :model-value="!!form.autoHideWindow"
                  @change="(val) => setBasicBoolean('autoHideWindow', val)"
                />
              </div>
            </div>
            <div v-if="isMac" class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{ $t('preferences.tray-speedometer') }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox
                  :model-value="!!form.traySpeedometer"
                  @change="(val) => setBasicBoolean('traySpeedometer', val)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Language & Startup Section -->
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="section-icon"><Globe :size="16" /></div>
            <div class="section-title">
              <h3>
                {{ $t('preferences.language') }} &
                {{ $t('preferences.startup') }}
              </h3>
            </div>
          </div>
          <div class="settings-section-content">
            <div class="settings-select-group">
              <div class="settings-select-item">
                <label class="settings-select-item-label">{{ $t('preferences.language') }}</label>
                <Select v-model="form.locale" class="settings-select-control">
                  <SelectTrigger>
                    <SelectValue :placeholder="$t('preferences.change-language')" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="item in locales" :key="item.value" :value="item.value">
                      {{ item.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div v-if="isMac" class="settings-select-item">
                <label class="settings-select-item-label">{{ $t('preferences.run-mode') }}</label>
                <Select v-model="form.runMode" class="settings-select-control">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="item in runModes" :key="item.value" :value="item.value">
                      {{ item.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{ $t('preferences.open-at-login') }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox
                  :model-value="!!form.openAtLogin"
                  @change="(val) => setBasicBoolean('openAtLogin', val)"
                />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{ $t('preferences.keep-window-state') }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox
                  :model-value="!!form.keepWindowState"
                  @change="(val) => setBasicBoolean('keepWindowState', val)"
                />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{ $t('preferences.auto-resume-all') }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox
                  :model-value="!!form.resumeAllWhenAppLaunched"
                  @change="(val) => setBasicBoolean('resumeAllWhenAppLaunched', val)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Download Location Section -->
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="section-icon"><FolderDown :size="16" /></div>
            <div class="section-title">
              <h3>{{ $t('preferences.default-dir') }}</h3>
            </div>
          </div>
          <div class="settings-section-content">
            <div class="mo-input-group mo-input-group--bordered">
              <span class="mo-input-prepend">
                <mo-history-directory @selected="handleHistoryDirectorySelected" />
              </span>
              <Input
                placeholder=""
                v-model="form.dir"
                :readonly="isMas"
                class="flex-1 shadow-none rounded-none"
              />
              <span class="mo-input-append" v-if="isRenderer">
                <mo-select-directory @selected="handleNativeDirectorySelected" />
              </span>
            </div>
            <div class="form-info" v-if="isMas">
              {{ $t('preferences.mas-default-dir-tips') }}
            </div>
          </div>
        </div>

        <!-- Transfer Speed Section -->
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="section-icon"><Gauge :size="16" /></div>
            <div class="section-title">
              <h3>{{ $t('preferences.transfer-settings') }}</h3>
            </div>
          </div>
          <div class="settings-section-content">
            <div class="settings-select-group">
              <div class="settings-select-item">
                <label class="settings-select-item-label"
                  ><ArrowUp :size="12" style="vertical-align: middle; margin-right: 4px" />{{
                    $t('preferences.transfer-speed-upload')
                  }}</label
                >
                <div class="settings-inline-input">
                  <NumberInput
                    v-model="maxOverallUploadLimitParsed"
                    :min="0"
                    :max="65535"
                    :step="1"
                  />
                  <Select v-model="uploadUnit" @update:model-value="handleUploadChange">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="item in speedUnits" :key="item.value" :value="item.value">
                        {{ item.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div class="settings-select-item">
                <label class="settings-select-item-label"
                  ><ArrowDown :size="12" style="vertical-align: middle; margin-right: 4px" />{{
                    $t('preferences.transfer-speed-download')
                  }}</label
                >
                <div class="settings-inline-input">
                  <NumberInput
                    v-model="maxOverallDownloadLimitParsed"
                    :min="0"
                    :max="65535"
                    :step="1"
                  />
                  <Select v-model="downloadUnit" @update:model-value="handleDownloadChange">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="item in speedUnits" :key="item.value" :value="item.value">
                        {{ item.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- BitTorrent Section -->
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="section-icon"><Share2 :size="16" /></div>
            <div class="section-title">
              <h3>{{ $t('preferences.bt-settings') }}</h3>
            </div>
          </div>
          <div class="settings-section-content">
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{ $t('preferences.bt-save-metadata') }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox
                  :model-value="!!form.btSaveMetadata"
                  @change="(val) => setBasicBoolean('btSaveMetadata', val)"
                />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{
                  $t('preferences.bt-auto-download-content')
                }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox
                  :model-value="!!form.btAutoDownloadContent"
                  @change="(val) => setBasicBoolean('btAutoDownloadContent', val)"
                />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{ $t('preferences.bt-force-encryption') }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox
                  :model-value="!!form.btForceEncryption"
                  @change="(val) => setBasicBoolean('btForceEncryption', val)"
                />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{ $t('preferences.keep-seeding') }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox :model-value="!!form.keepSeeding" @change="onKeepSeedingToggle" />
              </div>
            </div>
            <div v-if="!form.keepSeeding" class="settings-select-group">
              <div class="settings-select-item">
                <label class="settings-select-item-label">{{ $t('preferences.seed-ratio') }}</label>
                <NumberInput v-model="form.seedRatio" :min="0" :max="100" :step="0.1" />
              </div>
              <div class="settings-select-item">
                <label class="settings-select-item-label"
                  >{{ $t('preferences.seed-time') }} ({{ $t('preferences.seed-time-unit') }})</label
                >
                <NumberInput v-model="form.seedTime" :min="0" :max="525600" :step="1" />
              </div>
            </div>
          </div>
        </div>

        <!-- Task Management Section -->
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="section-icon"><ListTodo :size="16" /></div>
            <div class="section-title">
              <h3>{{ $t('preferences.task-manage') }}</h3>
            </div>
          </div>
          <div class="settings-section-content">
            <div class="settings-select-group">
              <div class="settings-select-item">
                <label class="settings-select-item-label">{{
                  $t('preferences.max-concurrent-downloads')
                }}</label>
                <NumberInput
                  v-model="form.maxConcurrentDownloads"
                  :min="1"
                  :max="maxConcurrentDownloads"
                />
              </div>
              <div class="settings-select-item">
                <label class="settings-select-item-label">{{
                  $t('preferences.max-connection-per-server')
                }}</label>
                <NumberInput v-model="form.maxConnectionPerServer" :min="1" :max="16" />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{ $t('preferences.continue') }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox
                  :model-value="!!form.continue"
                  @change="(val) => setBasicBoolean('continue', val)"
                />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{ $t('preferences.auto-retry') }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox
                  :model-value="!!form.autoRetry"
                  @change="(val) => setBasicBoolean('autoRetry', val)"
                />
              </div>
            </div>
            <div v-if="form.autoRetry" class="settings-select-group">
              <div class="settings-select-item">
                <label class="settings-select-item-label">{{
                  $t('preferences.auto-retry-strategy')
                }}</label>
                <Select v-model="form.autoRetryStrategy" class="settings-select-control">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="item in retryStrategies"
                      :key="item.value"
                      :value="item.value"
                    >
                      {{ item.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="settings-select-item">
                <label class="settings-select-item-label">
                  {{ $t('preferences.auto-retry-interval') }} ({{
                    $t('preferences.auto-retry-interval-unit')
                  }})
                </label>
                <NumberInput v-model="form.autoRetryInterval" :min="1" :max="300" :step="1" />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <div class="settings-row-title">
                  {{ $t('preferences.auto-detect-low-speed-tasks') }}
                </div>
                <div class="settings-row-description">
                  {{ $t('preferences.auto-detect-low-speed-tasks-tips') }}
                </div>
              </div>
              <div class="settings-row-action">
                <ui-checkbox
                  :model-value="!!form.autoDetectLowSpeedTasks"
                  @change="(val) => setBasicBoolean('autoDetectLowSpeedTasks', val)"
                />
              </div>
            </div>
            <div v-if="form.autoDetectLowSpeedTasks" class="settings-select-group">
              <div class="settings-select-item">
                <label class="settings-select-item-label">
                  {{ $t('preferences.low-speed-threshold') }} ({{
                    $t('preferences.low-speed-threshold-unit')
                  }})
                </label>
                <NumberInput v-model="form.lowSpeedThreshold" :min="1" :max="10240" :step="1" />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{
                  $t('preferences.new-task-show-downloading')
                }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox
                  :model-value="!!form.newTaskShowDownloading"
                  @change="(val) => setBasicBoolean('newTaskShowDownloading', val)"
                />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{
                  $t('preferences.task-completed-notify')
                }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox
                  :model-value="!!form.taskNotification"
                  @change="(val) => setBasicBoolean('taskNotification', val)"
                />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{
                  $t('preferences.no-confirm-before-delete-task')
                }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox
                  :model-value="!!form.noConfirmBeforeDeleteTask"
                  @change="(val) => setBasicBoolean('noConfirmBeforeDeleteTask', val)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Version Info Section -->
        <div class="settings-section">
          <div class="settings-section-header"></div>
          <div class="settings-section-content version-section">
            <div class="version-indicator">
              <div class="version-item">
                <span class="version-name">Motrix</span>
                <span class="version-value">{{ appVersion || '--' }}</span>
              </div>
              <div class="version-item">
                <span class="version-name">aria2c</span>
                <span class="version-value">{{ aria2Version }}</span>
              </div>
            </div>
          </div>
        </div>
      </form>
      <div class="form-actions">
        <ui-button @click="resetForm('basicForm')">{{ $t('preferences.discard') }}</ui-button>
        <ui-button variant="primary" @click="submitForm('basicForm')">{{
          $t('preferences.save')
        }}</ui-button>
      </div>
    </main>
  </div>
</template>

<script lang="ts">
import logger from '@shared/utils/logger'
import { invoke } from '@tauri-apps/api/core'
import is from '@/shims/platform'
import { confirm } from '@/components/ui/confirm-dialog'
import { cloneDeep, extend, isEmpty } from 'lodash'
import { useAppStore } from '@/store/app'
import { usePreferenceStore } from '@/store/preference'
import SubnavSwitcher from '@/components/Subnav/SubnavSwitcher.vue'
import HistoryDirectory from '@/components/Preference/HistoryDirectory.vue'
import SelectDirectory from '@/components/Native/SelectDirectory.vue'
import ThemeSwitcher from '@/components/Preference/ThemeSwitcher.vue'
import UiButton from '@/components/ui/compat/UiButton.vue'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import NumberInput from '@/components/ui/NumberInput.vue'
import {
  Palette,
  Globe,
  FolderDown,
  Gauge,
  Share2,
  ListTodo,
  ArrowUp,
  ArrowDown,
} from 'lucide-vue-next'
import { availableLanguages } from '@shared/locales'
import {
  changedConfig,
  convertLineToComma,
  diffConfig,
  extractSpeedUnit,
  parseBooleanConfig,
} from '@shared/utils'
import {
  APP_RUN_MODE,
  EMPTY_STRING,
  ENGINE_MAX_CONCURRENT_DOWNLOADS,
  ENGINE_RPC_PORT,
} from '@shared/constants'
import { reduceTrackerString } from '@shared/utils/tracker'
import { getMotrixVersion } from '@/utils/version'

const RETRY_STRATEGY_STATIC = 'static'
const RETRY_STRATEGY_EXPONENTIAL = 'exponential'

const normalizePositiveInt = (value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.min(Math.max(Math.floor(parsed), min), max)
}

const initForm = (config) => {
  const {
    autoDetectLowSpeedTasks,
    autoRetry,
    autoRetryInterval,
    autoRetryStrategy,
    autoHideWindow,
    btForceEncryption,
    btSaveMetadata,
    dir,
    engineMaxConnectionPerServer,
    followMetalink,
    followTorrent,
    hideAppMenu,
    keepSeeding,
    keepWindowState,
    locale,
    maxConcurrentDownloads,
    maxConnectionPerServer,
    maxOverallDownloadLimit,
    maxOverallUploadLimit,
    newTaskShowDownloading,
    noConfirmBeforeDeleteTask,
    openAtLogin,
    pauseMetadata,
    resumeAllWhenAppLaunched,
    runMode,
    seedRatio,
    seedTime,
    showProgressBar,
    taskNotification,
    theme,
    traySpeedometer,
    lowSpeedThreshold,
  } = config

  const btAutoDownloadContent = followTorrent && followMetalink && !pauseMetadata

  const result = {
    autoDetectLowSpeedTasks: parseBooleanConfig(autoDetectLowSpeedTasks),
    autoRetry: parseBooleanConfig(autoRetry),
    autoRetryInterval: normalizePositiveInt(autoRetryInterval, 5, 1, 300),
    autoRetryStrategy:
      autoRetryStrategy === RETRY_STRATEGY_EXPONENTIAL
        ? RETRY_STRATEGY_EXPONENTIAL
        : RETRY_STRATEGY_STATIC,
    autoHideWindow: parseBooleanConfig(autoHideWindow),
    btAutoDownloadContent,
    btForceEncryption: parseBooleanConfig(btForceEncryption),
    btSaveMetadata: parseBooleanConfig(btSaveMetadata),
    continue: parseBooleanConfig(config.continue),
    dir,
    engineMaxConnectionPerServer,
    followMetalink,
    followTorrent,
    hideAppMenu: parseBooleanConfig(hideAppMenu),
    keepSeeding: parseBooleanConfig(keepSeeding),
    keepWindowState: parseBooleanConfig(keepWindowState),
    locale,
    lowSpeedThreshold: normalizePositiveInt(lowSpeedThreshold, 20, 1, 10240),
    maxConcurrentDownloads,
    maxConnectionPerServer,
    maxOverallDownloadLimit,
    maxOverallUploadLimit,
    newTaskShowDownloading: parseBooleanConfig(newTaskShowDownloading),
    noConfirmBeforeDeleteTask: parseBooleanConfig(noConfirmBeforeDeleteTask),
    openAtLogin: parseBooleanConfig(openAtLogin),
    pauseMetadata,
    resumeAllWhenAppLaunched: parseBooleanConfig(resumeAllWhenAppLaunched),
    runMode,
    seedRatio,
    seedTime,
    showProgressBar: parseBooleanConfig(showProgressBar),
    taskNotification: parseBooleanConfig(taskNotification),
    theme,
    traySpeedometer: parseBooleanConfig(traySpeedometer),
  }
  return result
}

export default {
  name: 'mo-preference-basic',
  components: {
    [SubnavSwitcher.name]: SubnavSwitcher,
    [HistoryDirectory.name]: HistoryDirectory,
    [SelectDirectory.name]: SelectDirectory,
    [ThemeSwitcher.name]: ThemeSwitcher,
    [UiButton.name]: UiButton,
    NumberInput,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Palette,
    Globe,
    FolderDown,
    Gauge,
    Share2,
    ListTodo,
    ArrowUp,
    ArrowDown,
  },
  data() {
    const preferenceStore = usePreferenceStore()
    const formOriginal = initForm(preferenceStore.config)
    let form = {}
    form = initForm(extend(form, formOriginal, changedConfig.basic))

    return {
      appVersion: '',
      form,
      formOriginal,
      locales: availableLanguages,
    }
  },
  created() {
    getMotrixVersion().then((v) => {
      this.appVersion = v
    })

    const currentEngineVersion = this.engineInfo && this.engineInfo.version
    if (!currentEngineVersion) {
      useAppStore().fetchEngineInfo()
    }
  },
  computed: {
    isRenderer: () => is.renderer(),
    isMac: () => is.macOS(),
    isMas: () => is.mas(),
    title() {
      return this.$t('preferences.basic')
    },
    maxConcurrentDownloads() {
      return ENGINE_MAX_CONCURRENT_DOWNLOADS
    },
    maxOverallDownloadLimitParsed: {
      get() {
        return parseInt(this.form.maxOverallDownloadLimit)
      },
      set(value) {
        const limit = value > 0 ? `${value}${this.downloadUnit}` : 0
        this.form.maxOverallDownloadLimit = limit
      },
    },
    maxOverallUploadLimitParsed: {
      get() {
        return parseInt(this.form.maxOverallUploadLimit)
      },
      set(value) {
        const limit = value > 0 ? `${value}${this.uploadUnit}` : 0
        this.form.maxOverallUploadLimit = limit
      },
    },
    downloadUnit: {
      get() {
        const { maxOverallDownloadLimit } = this.form
        return extractSpeedUnit(maxOverallDownloadLimit)
      },
      set(value) {
        return value
      },
    },
    uploadUnit: {
      get() {
        const { maxOverallUploadLimit } = this.form
        return extractSpeedUnit(maxOverallUploadLimit)
      },
      set(value) {
        return value
      },
    },
    runModes() {
      const result = [
        {
          label: this.$t('preferences.run-mode-standard'),
          value: APP_RUN_MODE.STANDARD,
        },
        {
          label: this.$t('preferences.run-mode-tray'),
          value: APP_RUN_MODE.TRAY,
        },
      ]
      return result
    },
    speedUnits() {
      return [
        {
          label: 'KB/s',
          value: 'K',
        },
        {
          label: 'MB/s',
          value: 'M',
        },
      ]
    },
    retryStrategies() {
      return [
        {
          label: this.$t('preferences.auto-retry-strategy-static'),
          value: RETRY_STRATEGY_STATIC,
        },
        {
          label: this.$t('preferences.auto-retry-strategy-exponential'),
          value: RETRY_STRATEGY_EXPONENTIAL,
        },
      ]
    },
    subnavs() {
      return [
        {
          key: 'basic',
          title: this.$t('preferences.basic'),
          route: '/preference/basic',
        },
        {
          key: 'advanced',
          title: this.$t('preferences.advanced'),
          route: '/preference/advanced',
        },
        {
          key: 'lab',
          title: this.$t('preferences.lab'),
          route: '/preference/lab',
        },
      ]
    },
    showHideAppMenuOption() {
      return is.windows() || is.linux()
    },
    rpcDefaultPort() {
      return ENGINE_RPC_PORT
    },
    aria2Version() {
      const engineVersion = this.engineInfo && this.engineInfo.version
      return engineVersion ? `v${engineVersion}` : '--'
    },
    engineInfo() {
      return useAppStore().engineInfo
    },
  },
  methods: {
    setBasicBoolean(key, enable) {
      this.form[key] = !!enable
    },
    handleThemeChange(theme) {
      this.form.theme = theme
    },
    handleDownloadChange(value) {
      const speedLimit = parseInt(this.form.maxOverallDownloadLimit, 10)
      this.downloadUnit = value
      const limit = speedLimit > 0 ? `${speedLimit}${value}` : 0
      this.form.maxOverallDownloadLimit = limit
    },
    handleUploadChange(value) {
      const speedLimit = parseInt(this.form.maxOverallUploadLimit, 10)
      this.uploadUnit = value
      const limit = speedLimit > 0 ? `${speedLimit}${value}` : 0
      this.form.maxOverallUploadLimit = limit
    },
    onKeepSeedingChange(enable) {
      if (!enable) {
        this.form.seedRatio = 0
      }
      this.form.seedTime = enable ? 525600 : 0
    },
    onKeepSeedingToggle(enable) {
      this.form.keepSeeding = !!enable
      this.onKeepSeedingChange(this.form.keepSeeding)
    },
    handleHistoryDirectorySelected(dir) {
      this.form.dir = dir
    },
    handleNativeDirectorySelected(dir) {
      this.form.dir = dir
      usePreferenceStore().recordHistoryDirectory(dir)
    },
    syncFormConfig() {
      usePreferenceStore()
        .fetchPreference()
        .then((config) => {
          this.form = initForm(config)
          this.formOriginal = cloneDeep(this.form)
        })
    },
    submitForm(_formName) {
      const data = {
        ...diffConfig(this.formOriginal, this.form),
        ...changedConfig.advanced,
      }
      const booleanKeys = [
        'hideAppMenu',
        'autoHideWindow',
        'traySpeedometer',
        'showProgressBar',
        'openAtLogin',
        'keepWindowState',
        'resumeAllWhenAppLaunched',
        'btSaveMetadata',
        'btAutoDownloadContent',
        'btForceEncryption',
        'keepSeeding',
        'continue',
        'autoRetry',
        'autoDetectLowSpeedTasks',
        'newTaskShowDownloading',
        'taskNotification',
        'noConfirmBeforeDeleteTask',
      ]
      for (const key of booleanKeys) {
        if (key in data) {
          data[key] = !!this.form[key]
        }
      }

      const { autoHideWindow, btAutoDownloadContent, btTracker, rpcListenPort } = data

      if ('btAutoDownloadContent' in data) {
        data.followTorrent = btAutoDownloadContent
        data.followMetalink = btAutoDownloadContent
        data.pauseMetadata = !btAutoDownloadContent
      }

      if (btTracker) {
        data.btTracker = reduceTrackerString(convertLineToComma(btTracker))
      }

      if (rpcListenPort === EMPTY_STRING) {
        data.rpcListenPort = this.rpcDefaultPort
      }

      if ('autoRetryInterval' in data) {
        data.autoRetryInterval = normalizePositiveInt(this.form.autoRetryInterval, 5, 1, 300)
      }

      if ('lowSpeedThreshold' in data) {
        data.lowSpeedThreshold = normalizePositiveInt(this.form.lowSpeedThreshold, 20, 1, 10240)
      }

      if ('autoRetryStrategy' in data) {
        data.autoRetryStrategy =
          this.form.autoRetryStrategy === RETRY_STRATEGY_EXPONENTIAL
            ? RETRY_STRATEGY_EXPONENTIAL
            : RETRY_STRATEGY_STATIC
      }

      logger.log('[Motrix] preference changed data:', data)

      usePreferenceStore()
        .save(data)
        .then(() => {
          this.syncFormConfig()
          this.$msg.success(this.$t('preferences.save-success-message'))
          if (this.isRenderer) {
            if ('autoHideWindow' in data) {
              invoke('auto_hide_window', { enabled: autoHideWindow }).catch(() => {})
            }
            if ('hideAppMenu' in data) {
              invoke('relaunch_app').catch(() => {})
            }
          }
        })
        .catch(() => {
          this.$msg.error(this.$t('preferences.save-fail-message'))
        })

      changedConfig.basic = {}
      changedConfig.advanced = {}
    },
    resetForm(_formName) {
      this.syncFormConfig()
    },
  },
  async beforeRouteLeave(to, from) {
    changedConfig.basic = diffConfig(this.formOriginal, this.form)
    if (to.path === '/preference/advanced') {
      return true
    }
    if (isEmpty(changedConfig.basic) && isEmpty(changedConfig.advanced)) {
      return true
    }
    const { confirmed } = await confirm({
      message: this.$t('preferences.not-saved-confirm'),
      title: this.$t('preferences.not-saved'),
      kind: 'warning',
      confirmText: this.$t('app.yes'),
      cancelText: this.$t('app.no'),
    })
    if (confirmed) {
      changedConfig.basic = {}
      changedConfig.advanced = {}
      return true
    }
    return false
  },
}
</script>
