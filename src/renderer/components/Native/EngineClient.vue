<template>
  <div style="display: none"></div>
</template>

<script lang="ts">
import logger from "@shared/utils/logger";
import is from "electron-is";
import { useAppStore } from "@/store/app";
import { useTaskStore } from "@/store/task";
import { usePreferenceStore } from "@/store/preference";
import api from "@/api";
import { getTaskFullPath, showItemInFolder } from "@/utils/native";
import { checkTaskIsBT, getTaskName } from "@shared/utils";

export default {
  name: "mo-engine-client",
  data() {
    return {
      timer: null,
      initTimer: null,
      isPolling: false,
      isDestroyed: false,
    };
  },
  computed: {
    isRenderer: () => is.renderer(),
    uploadSpeed() {
      return useAppStore().stat.uploadSpeed;
    },
    downloadSpeed() {
      return useAppStore().stat.downloadSpeed;
    },
    speed() {
      return useAppStore().stat.uploadSpeed + useAppStore().stat.downloadSpeed;
    },
    interval() {
      return useAppStore().interval;
    },
    downloading() {
      return useAppStore().stat.numActive > 0;
    },
    progress() {
      return useAppStore().progress;
    },
    messages() {
      return (useTaskStore() as any).messages;
    },
    seedingList() {
      return useTaskStore().seedingList;
    },
    taskDetailVisible() {
      return useTaskStore().taskDetailVisible;
    },
    enabledFetchPeers() {
      return useTaskStore().enabledFetchPeers;
    },
    currentTaskGid() {
      return useTaskStore().currentTaskGid;
    },
    currentTaskItem() {
      return useTaskStore().currentTaskItem;
    },
    taskNotification() {
      return (usePreferenceStore().config as any).taskNotification;
    },
    currentTaskIsBT() {
      return checkTaskIsBT(this.currentTaskItem);
    },
  },
  watch: {
    speed(val) {
      const { uploadSpeed, downloadSpeed } = this;
      this.$electron.ipcRenderer.send("event", "speed-change", {
        uploadSpeed,
        downloadSpeed,
      });
    },
    downloading(val, oldVal) {
      if (val !== oldVal && this.isRenderer) {
        this.$electron.ipcRenderer.send("event", "download-status-change", val);
      }
    },
    progress(val) {
      this.$electron.ipcRenderer.send("event", "progress-change", val);
    },
    interval() {
      if (this.timer) {
        this.startPolling();
      }
    },
  },
  methods: {
    async fetchTaskItem({ gid }) {
      return api.fetchTaskItem({ gid }).catch((e) => {
        logger.warn(`fetchTaskItem fail: ${e.message}`);
      });
    },
    onDownloadStart(event) {
      const taskStore = useTaskStore();
      taskStore.fetchList();
      useAppStore().resetInterval();
      taskStore.saveSession();
      const [{ gid }] = event;
      const { seedingList } = this;
      if (seedingList.includes(gid)) {
        return;
      }

      this.fetchTaskItem({ gid }).then((task) => {
        if (!task) {
          return;
        }
        const { dir } = task;
        usePreferenceStore().recordHistoryDirectory(dir);
        const taskName = getTaskName(task);
        const message = this.$t("task.download-start-message", { taskName });
        this.$msg.info(message);
      });
    },
    onDownloadPause(event) {
      const [{ gid }] = event;
      const { seedingList } = this;
      if (seedingList.includes(gid)) {
        return;
      }

      this.fetchTaskItem({ gid }).then((task) => {
        if (!task) {
          return;
        }
        const taskName = getTaskName(task);
        const message = this.$t("task.download-pause-message", { taskName });
        this.$msg.info(message);
      });
    },
    onDownloadStop(event) {
      const [{ gid }] = event;
      this.fetchTaskItem({ gid }).then((task) => {
        if (!task) {
          return;
        }
        const taskName = getTaskName(task);
        const message = this.$t("task.download-stop-message", { taskName });
        this.$msg.info(message);
      });
    },
    onDownloadError(event) {
      const [{ gid }] = event;
      this.fetchTaskItem({ gid }).then((task) => {
        if (!task) {
          return;
        }
        const taskName = getTaskName(task);
        const { errorCode, errorMessage } = task;
        logger.error(
          `[Motrix] download error gid: ${gid}, #${errorCode}, ${errorMessage}`,
        );
        const message = this.$t("task.download-error-message", { taskName });
        const link = `<a target="_blank" href="https://github.com/agalwood/Motrix/wiki/Error#${errorCode}" rel="noopener noreferrer">${errorCode}</a>`;
        this.$msg({
          type: "error",
          showClose: true,
          duration: 5000,
          dangerouslyUseHTMLString: true,
          message: `${message} ${link}`,
        });
      });
    },
    onDownloadComplete(event) {
      const taskStore = useTaskStore();
      taskStore.fetchList();
      const [{ gid }] = event;
      taskStore.removeFromSeedingList(gid);

      this.fetchTaskItem({ gid }).then((task) => {
        if (!task) {
          return;
        }
        this.handleDownloadComplete(task, false);
      });
    },
    onBtDownloadComplete(event) {
      const taskStore = useTaskStore();
      taskStore.fetchList();
      const [{ gid }] = event;
      const { seedingList } = this;
      if (seedingList.includes(gid)) {
        return;
      }

      taskStore.addToSeedingList(gid);

      this.fetchTaskItem({ gid }).then((task) => {
        if (!task) {
          return;
        }
        this.handleDownloadComplete(task, true);
      });
    },
    handleDownloadComplete(task, isBT) {
      useTaskStore().saveSession();

      const path = getTaskFullPath(task);
      this.showTaskCompleteNotify(task, isBT, path);
      this.$electron.ipcRenderer.send(
        "event",
        "task-download-complete",
        task,
        path,
      );
    },
    showTaskCompleteNotify(task, isBT, path) {
      const taskName = getTaskName(task);
      const message = isBT
        ? this.$t("task.bt-download-complete-message", { taskName })
        : this.$t("task.download-complete-message", { taskName });
      const tips = isBT ? "\n" + this.$t("task.bt-download-complete-tips") : "";

      this.$msg.success(`${message}${tips}`);

      if (!this.taskNotification) {
        return;
      }

      const notifyMessage = isBT
        ? this.$t("task.bt-download-complete-notify")
        : this.$t("task.download-complete-notify");

      const notify = new Notification(notifyMessage, {
        body: `${taskName}${tips}`,
      });
      notify.onclick = () => {
        showItemInFolder(path, {
          errorMsg: this.$t("task.file-not-exist"),
        });
      };
    },
    showTaskErrorNotify(task) {
      const taskName = getTaskName(task);

      const message = this.$t("task.download-fail-message", { taskName });
      this.$msg.success(message);

      if (!this.taskNotification) {
        return;
      }

      /* eslint-disable no-new */
      new Notification(this.$t("task.download-fail-notify"), {
        body: taskName,
      });
    },
    bindEngineEvents() {
      if (!api.client) {
        return;
      }
      api.client.on("onDownloadStart", this.onDownloadStart);
      // api.client.on('onDownloadPause', this.onDownloadPause)
      api.client.on("onDownloadStop", this.onDownloadStop);
      api.client.on("onDownloadComplete", this.onDownloadComplete);
      api.client.on("onDownloadError", this.onDownloadError);
      api.client.on("onBtDownloadComplete", this.onBtDownloadComplete);
    },
    unbindEngineEvents() {
      if (!api.client) {
        return;
      }
      api.client.removeListener("onDownloadStart", this.onDownloadStart);
      // api.client.removeListener('onDownloadPause', this.onDownloadPause)
      api.client.removeListener("onDownloadStop", this.onDownloadStop);
      api.client.removeListener("onDownloadComplete", this.onDownloadComplete);
      api.client.removeListener("onDownloadError", this.onDownloadError);
      api.client.removeListener(
        "onBtDownloadComplete",
        this.onBtDownloadComplete,
      );
    },
    startPolling() {
      this.stopPolling();

      const loop = async () => {
        await this.polling();
        if (!this.isDestroyed) {
          this.timer = setTimeout(loop, this.interval);
        }
      };

      this.timer = setTimeout(loop, this.interval);
    },
    async polling() {
      if (this.isPolling) {
        return;
      }
      this.isPolling = true;

      try {
        const jobs: Array<Promise<any>> = [
          useAppStore().fetchGlobalStat(),
          useAppStore().fetchProgress(),
        ];

        if (!document.hidden || this.taskDetailVisible) {
          jobs.push(useTaskStore().fetchList());
        }

        if (this.taskDetailVisible && this.currentTaskGid) {
          if (this.currentTaskIsBT && this.enabledFetchPeers) {
            jobs.push(useTaskStore().fetchItemWithPeers(this.currentTaskGid));
          } else {
            jobs.push(useTaskStore().fetchItem(this.currentTaskGid));
          }
        }

        await Promise.allSettled(jobs);
      } finally {
        this.isPolling = false;
      }
    },
    stopPolling() {
      clearTimeout(this.timer);
      this.timer = null;
    },
  },
  created() {
    api
      .ensureReady()
      .then(() => {
        this.bindEngineEvents();
      })
      .catch((err) => {
        logger.warn("[Motrix] bindEngineEvents failed:", err.message);
      });
  },
  mounted() {
    this.initTimer = setTimeout(() => {
      const appStore = useAppStore();
      appStore.fetchEngineInfo();
      appStore.fetchEngineOptions();

      this.startPolling();
    }, 100);
  },
  beforeUnmount() {
    this.isDestroyed = true;
    useTaskStore().saveSession();
    clearTimeout(this.initTimer);
    this.initTimer = null;

    this.unbindEngineEvents();

    this.stopPolling();
  },
};
</script>
