<template>
  <div class="content panel panel-layout panel-layout--v">
    <header class="panel-header">
      <h4 class="hidden-xs-only">{{ title }}</h4>
      <mo-subnav-switcher
        :title="title"
        :subnavs="subnavs"
        class="hidden-sm-and-up"
      />
    </header>
    <main class="panel-content">
      <form class="form-preference" ref="basicForm" @submit.prevent>
        <!-- Appearance Section -->
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="section-icon"><Palette :size="16" /></div>
            <div class="section-title">
              <h3>{{ $t("preferences.appearance") }}</h3>
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
                <span class="settings-row-title">{{
                  $t("preferences.hide-app-menu")
                }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox v-model="form.hideAppMenu" />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{
                  $t("preferences.auto-hide-window")
                }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox v-model="form.autoHideWindow" />
              </div>
            </div>
            <div v-if="isMac" class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{
                  $t("preferences.tray-speedometer")
                }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox v-model="form.traySpeedometer" />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{
                  $t("preferences.show-progress-bar")
                }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox v-model="form.showProgressBar" />
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
                {{ $t("preferences.language") }} &
                {{ $t("preferences.startup") }}
              </h3>
            </div>
          </div>
          <div class="settings-section-content">
            <div class="settings-select-group">
              <div class="settings-select-item">
                <label class="settings-select-item-label">{{
                  $t("preferences.language")
                }}</label>
                <Select v-model="form.locale" class="settings-select-control">
                  <SelectTrigger>
                    <SelectValue
                      :placeholder="$t('preferences.change-language')"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="item in locales"
                      :key="item.value"
                      :value="item.value"
                    >
                      {{ item.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div v-if="isMac" class="settings-select-item">
                <label class="settings-select-item-label">{{
                  $t("preferences.run-mode")
                }}</label>
                <Select v-model="form.runMode" class="settings-select-control">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="item in runModes"
                      :key="item.value"
                      :value="item.value"
                    >
                      {{ item.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div v-if="!isLinux" class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{
                  $t("preferences.open-at-login")
                }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox v-model="form.openAtLogin" />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{
                  $t("preferences.keep-window-state")
                }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox v-model="form.keepWindowState" />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{
                  $t("preferences.auto-resume-all")
                }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox v-model="form.resumeAllWhenAppLaunched" />
              </div>
            </div>
          </div>
        </div>

        <!-- Download Location Section -->
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="section-icon"><FolderDown :size="16" /></div>
            <div class="section-title">
              <h3>{{ $t("preferences.default-dir") }}</h3>
            </div>
          </div>
          <div class="settings-section-content">
            <div class="mo-input-group mo-input-group--bordered">
              <span class="mo-input-prepend">
                <mo-history-directory
                  @selected="handleHistoryDirectorySelected"
                />
              </span>
              <Input
                placeholder=""
                v-model="form.dir"
                :readonly="isMas"
                class="flex-1 border-0 shadow-none rounded-none"
              />
              <span class="mo-input-append" v-if="isRenderer">
                <mo-select-directory
                  @selected="handleNativeDirectorySelected"
                />
              </span>
            </div>
            <div class="form-info" v-if="isMas">
              {{ $t("preferences.mas-default-dir-tips") }}
            </div>
          </div>
        </div>

        <!-- Transfer Speed Section -->
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="section-icon"><Gauge :size="16" /></div>
            <div class="section-title">
              <h3>{{ $t("preferences.transfer-settings") }}</h3>
            </div>
          </div>
          <div class="settings-section-content">
            <div class="settings-select-group">
              <div class="settings-select-item">
                <label class="settings-select-item-label"
                  ><ArrowUp
                    :size="12"
                    style="vertical-align: middle; margin-right: 4px"
                  />{{ $t("preferences.transfer-speed-upload") }}</label
                >
                <div class="settings-inline-input">
                  <NumberInput
                    v-model="maxOverallUploadLimitParsed"
                    :min="0"
                    :max="65535"
                    :step="1"
                  />
                  <Select
                    v-model="uploadUnit"
                    @update:model-value="handleUploadChange"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="item in speedUnits"
                        :key="item.value"
                        :value="item.value"
                      >
                        {{ item.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div class="settings-select-item">
                <label class="settings-select-item-label"
                  ><ArrowDown
                    :size="12"
                    style="vertical-align: middle; margin-right: 4px"
                  />{{ $t("preferences.transfer-speed-download") }}</label
                >
                <div class="settings-inline-input">
                  <NumberInput
                    v-model="maxOverallDownloadLimitParsed"
                    :min="0"
                    :max="65535"
                    :step="1"
                  />
                  <Select
                    v-model="downloadUnit"
                    @update:model-value="handleDownloadChange"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="item in speedUnits"
                        :key="item.value"
                        :value="item.value"
                      >
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
              <h3>{{ $t("preferences.bt-settings") }}</h3>
            </div>
          </div>
          <div class="settings-section-content">
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{
                  $t("preferences.bt-save-metadata")
                }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox v-model="form.btSaveMetadata" />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{
                  $t("preferences.bt-auto-download-content")
                }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox v-model="form.btAutoDownloadContent" />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{
                  $t("preferences.bt-force-encryption")
                }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox v-model="form.btForceEncryption" />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{
                  $t("preferences.keep-seeding")
                }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox
                  v-model="form.keepSeeding"
                  @change="onKeepSeedingChange"
                />
              </div>
            </div>
            <div v-if="!form.keepSeeding" class="settings-select-group">
              <div class="settings-select-item">
                <label class="settings-select-item-label">{{
                  $t("preferences.seed-ratio")
                }}</label>
                <NumberInput
                  v-model="form.seedRatio"
                  :min="1"
                  :max="100"
                  :step="0.1"
                />
              </div>
              <div class="settings-select-item">
                <label class="settings-select-item-label"
                  >{{ $t("preferences.seed-time") }} ({{
                    $t("preferences.seed-time-unit")
                  }})</label
                >
                <NumberInput
                  v-model="form.seedTime"
                  :min="60"
                  :max="525600"
                  :step="1"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Task Management Section -->
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="section-icon"><ListTodo :size="16" /></div>
            <div class="section-title">
              <h3>{{ $t("preferences.task-manage") }}</h3>
            </div>
          </div>
          <div class="settings-section-content">
            <div class="settings-select-group">
              <div class="settings-select-item">
                <label class="settings-select-item-label">{{
                  $t("preferences.max-concurrent-downloads")
                }}</label>
                <NumberInput
                  v-model="form.maxConcurrentDownloads"
                  :min="1"
                  :max="maxConcurrentDownloads"
                />
              </div>
              <div class="settings-select-item">
                <label class="settings-select-item-label">{{
                  $t("preferences.max-connection-per-server")
                }}</label>
                <NumberInput
                  v-model="form.maxConnectionPerServer"
                  :min="1"
                  :max="16"
                />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{
                  $t("preferences.continue")
                }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox v-model="form.continue" />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{
                  $t("preferences.new-task-show-downloading")
                }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox v-model="form.newTaskShowDownloading" />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{
                  $t("preferences.task-completed-notify")
                }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox v-model="form.taskNotification" />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row-content">
                <span class="settings-row-title">{{
                  $t("preferences.no-confirm-before-delete-task")
                }}</span>
              </div>
              <div class="settings-row-action">
                <ui-checkbox v-model="form.noConfirmBeforeDeleteTask" />
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
                <span class="version-value">{{ appVersion || "--" }}</span>
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
        <ui-button @click="resetForm('basicForm')">{{
          $t("preferences.discard")
        }}</ui-button>
        <ui-button variant="primary" @click="submitForm('basicForm')">{{
          $t("preferences.save")
        }}</ui-button>
      </div>
    </main>
  </div>
</template>

<script lang="ts">
import logger from "@shared/utils/logger";
import is from "electron-is";
import { dialog } from "@electron/remote";
import { cloneDeep, extend, isEmpty } from "lodash";
import { useAppStore } from "@/store/app";
import { usePreferenceStore } from "@/store/preference";
import SubnavSwitcher from "@/components/Subnav/SubnavSwitcher.vue";
import HistoryDirectory from "@/components/Preference/HistoryDirectory.vue";
import SelectDirectory from "@/components/Native/SelectDirectory.vue";
import ThemeSwitcher from "@/components/Preference/ThemeSwitcher.vue";
import UiButton from "@/components/ui/compat/UiButton.vue";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import NumberInput from "@/components/ui/NumberInput.vue";
import {
  Palette,
  Globe,
  FolderDown,
  Gauge,
  Share2,
  ListTodo,
  ArrowUp,
  ArrowDown,
} from "lucide-vue-next";
import { availableLanguages, getLanguage } from "@shared/locales";
import { getLocaleManager } from "@/components/Locale";
import {
  calcFormLabelWidth,
  changedConfig,
  convertLineToComma,
  diffConfig,
  extractSpeedUnit,
} from "@shared/utils";
import {
  APP_RUN_MODE,
  EMPTY_STRING,
  ENGINE_MAX_CONCURRENT_DOWNLOADS,
  ENGINE_RPC_PORT,
} from "@shared/constants";
import { reduceTrackerString } from "@shared/utils/tracker";
import { getMotrixVersion } from "@/utils/version";

const initForm = (config) => {
  const {
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
  } = config;

  const btAutoDownloadContent =
    followTorrent && followMetalink && !pauseMetadata;

  const result = {
    autoHideWindow,
    btAutoDownloadContent,
    btForceEncryption,
    btSaveMetadata,
    continue: config.continue,
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
  };
  return result;
};

export default {
  name: "mo-preference-basic",
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
    const preferenceStore = usePreferenceStore();
    const locale = ((preferenceStore.config as any) || {}).locale || "en-US";
    const formOriginal = initForm(preferenceStore.config);
    let form = {};
    form = initForm(extend(form, formOriginal, changedConfig.basic));

    return {
      appVersion: "",
      form,
      formLabelWidth: calcFormLabelWidth(locale),
      formOriginal,
      locales: availableLanguages,
      rules: {},
    };
  },
  created() {
    this.appVersion = getMotrixVersion();

    const currentEngineVersion = this.engineInfo && this.engineInfo.version;
    if (!currentEngineVersion) {
      useAppStore().fetchEngineInfo();
    }
  },
  computed: {
    isRenderer: () => is.renderer(),
    isMac: () => is.macOS(),
    isMas: () => is.mas(),
    isLinux() {
      return is.linux();
    },
    title() {
      return this.$t("preferences.basic");
    },
    maxConcurrentDownloads() {
      return ENGINE_MAX_CONCURRENT_DOWNLOADS;
    },
    maxOverallDownloadLimitParsed: {
      get() {
        return parseInt(this.form.maxOverallDownloadLimit);
      },
      set(value) {
        const limit = value > 0 ? `${value}${this.downloadUnit}` : 0;
        this.form.maxOverallDownloadLimit = limit;
      },
    },
    maxOverallUploadLimitParsed: {
      get() {
        return parseInt(this.form.maxOverallUploadLimit);
      },
      set(value) {
        const limit = value > 0 ? `${value}${this.uploadUnit}` : 0;
        this.form.maxOverallUploadLimit = limit;
      },
    },
    downloadUnit: {
      get() {
        const { maxOverallDownloadLimit } = this.form;
        return extractSpeedUnit(maxOverallDownloadLimit);
      },
      set(value) {
        return value;
      },
    },
    uploadUnit: {
      get() {
        const { maxOverallUploadLimit } = this.form;
        return extractSpeedUnit(maxOverallUploadLimit);
      },
      set(value) {
        return value;
      },
    },
    runModes() {
      let result = [
        {
          label: this.$t("preferences.run-mode-standard"),
          value: APP_RUN_MODE.STANDARD,
        },
        {
          label: this.$t("preferences.run-mode-tray"),
          value: APP_RUN_MODE.TRAY,
        },
      ];

      if (this.isMac) {
        result = [
          ...result,
          {
            label: this.$t("preferences.run-mode-hide-tray"),
            value: APP_RUN_MODE.HIDE_TRAY,
          },
        ];
      }

      return result;
    },
    speedUnits() {
      return [
        {
          label: "KB/s",
          value: "K",
        },
        {
          label: "MB/s",
          value: "M",
        },
      ];
    },
    subnavs() {
      return [
        {
          key: "basic",
          title: this.$t("preferences.basic"),
          route: "/preference/basic",
        },
        {
          key: "advanced",
          title: this.$t("preferences.advanced"),
          route: "/preference/advanced",
        },
        {
          key: "lab",
          title: this.$t("preferences.lab"),
          route: "/preference/lab",
        },
      ];
    },
    showHideAppMenuOption() {
      return is.windows() || is.linux();
    },
    rpcDefaultPort() {
      return ENGINE_RPC_PORT;
    },
    aria2Version() {
      const engineVersion = this.engineInfo && this.engineInfo.version;
      return engineVersion ? `v${engineVersion}` : "--";
    },
    engineInfo() {
      return useAppStore().engineInfo;
    },
    config() {
      return usePreferenceStore().config;
    },
  },
  methods: {
    handleLocaleChange(locale) {
      const lng = getLanguage(locale);
      getLocaleManager().changeLanguage(lng);
    },
    handleThemeChange(theme) {
      this.form.theme = theme;
    },
    handleDownloadChange(value) {
      const speedLimit = parseInt(this.form.maxOverallDownloadLimit, 10);
      this.downloadUnit = value;
      const limit = speedLimit > 0 ? `${speedLimit}${value}` : 0;
      this.form.maxOverallDownloadLimit = limit;
    },
    handleUploadChange(value) {
      const speedLimit = parseInt(this.form.maxOverallUploadLimit, 10);
      this.uploadUnit = value;
      const limit = speedLimit > 0 ? `${speedLimit}${value}` : 0;
      this.form.maxOverallUploadLimit = limit;
    },
    onKeepSeedingChange(enable) {
      this.form.seedRatio = enable ? 0 : 1;
      this.form.seedTime = enable ? 525600 : 60;
    },
    handleHistoryDirectorySelected(dir) {
      this.form.dir = dir;
    },
    handleNativeDirectorySelected(dir) {
      this.form.dir = dir;
      usePreferenceStore().recordHistoryDirectory(dir);
    },
    onDirectorySelected(dir) {
      this.form.dir = dir;
    },
    syncFormConfig() {
      usePreferenceStore()
        .fetchPreference()
        .then((config) => {
          this.form = initForm(config);
          this.formOriginal = cloneDeep(this.form);
        });
    },
    submitForm(_formName) {
      const data = {
        ...diffConfig(this.formOriginal, this.form),
        ...changedConfig.advanced,
      };

      const {
        autoHideWindow,
        btAutoDownloadContent,
        btTracker,
        rpcListenPort,
      } = data;

      if ("btAutoDownloadContent" in data) {
        data.followTorrent = btAutoDownloadContent;
        data.followMetalink = btAutoDownloadContent;
        data.pauseMetadata = !btAutoDownloadContent;
      }

      if (btTracker) {
        data.btTracker = reduceTrackerString(convertLineToComma(btTracker));
      }

      if (rpcListenPort === EMPTY_STRING) {
        data.rpcListenPort = this.rpcDefaultPort;
      }

      logger.log("[Motrix] preference changed data:", data);

      usePreferenceStore()
        .save(data)
        .then(() => {
          this.syncFormConfig();
          this.$msg.success(this.$t("preferences.save-success-message"));
          if (this.isRenderer) {
            if ("autoHideWindow" in data) {
              this.$electron.ipcRenderer.send(
                "command",
                "application:auto-hide-window",
                autoHideWindow,
              );
            }
            if ("hideAppMenu" in data) {
              this.$electron.ipcRenderer.send(
                "command",
                "application:relaunch",
              );
            }
          }
        })
        .catch(() => {
          this.$msg.success(this.$t("preferences.save-fail-message"));
        });

      changedConfig.basic = {};
      changedConfig.advanced = {};
    },
    resetForm(_formName) {
      this.syncFormConfig();
    },
  },
  async beforeRouteLeave(to, from) {
    changedConfig.basic = diffConfig(this.formOriginal, this.form);
    if (to.path === "/preference/advanced") {
      return true;
    }
    if (isEmpty(changedConfig.basic) && isEmpty(changedConfig.advanced)) {
      return true;
    }
    const { response } = await dialog.showMessageBox({
      type: "warning",
      title: this.$t("preferences.not-saved"),
      message: this.$t("preferences.not-saved-confirm"),
      buttons: [this.$t("app.yes"), this.$t("app.no")],
      cancelId: 1,
    });
    if (response === 0) {
      changedConfig.basic = {};
      changedConfig.advanced = {};
      return true;
    }
    return false;
  },
};
</script>
