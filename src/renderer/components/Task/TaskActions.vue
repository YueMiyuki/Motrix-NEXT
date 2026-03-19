<template>
  <div class="task-actions">
    <ui-tooltip
      class="item"
      effect="dark"
      placement="bottom"
      :content="$t('task.delete-selected-tasks')"
      v-if="currentList !== 'stopped'"
    >
      <i
        class="task-action"
        :class="{ disabled: selectedGidListCount === 0 }"
        @click="onBatchDeleteClick"
      >
        <Trash2 :size="14" />
      </i>
    </ui-tooltip>
    <ui-tooltip
      class="item"
      effect="dark"
      placement="bottom"
      :content="$t('task.refresh-list')"
    >
      <i class="task-action" @click="onRefreshClick">
        <RefreshCw :size="14" :class="{ 'animate-spin': refreshing }" />
      </i>
    </ui-tooltip>
    <ui-tooltip
      class="item"
      effect="dark"
      placement="bottom"
      :content="
        hasSelection
          ? $t('task.resume-selected-tasks')
          : $t('task.resume-all-task')
      "
    >
      <i class="task-action" @click="onResumeClick">
        <Play :size="14" />
      </i>
    </ui-tooltip>
    <ui-tooltip
      class="item"
      effect="dark"
      placement="bottom"
      :content="
        hasSelection
          ? $t('task.pause-selected-tasks')
          : $t('task.pause-all-task')
      "
    >
      <i class="task-action" @click="onPauseClick">
        <Pause :size="14" />
      </i>
    </ui-tooltip>
    <ui-tooltip
      class="item"
      effect="dark"
      placement="bottom"
      :content="$t('task.purge-record')"
      v-if="currentList === 'stopped'"
    >
      <i class="task-action" @click="onPurgeRecordClick">
        <Eraser :size="14" />
      </i>
    </ui-tooltip>
  </div>
</template>

<script lang="ts">
import { useAppStore } from "@/store/app";
import { useTaskStore } from "@/store/task";

import { commands } from "@/components/CommandManager/instance";
import { ADD_TASK_TYPE } from "@shared/constants";
import { Trash2, RefreshCw, Play, Pause, Eraser } from "lucide-vue-next";

export default {
  name: "mo-task-actions",
  components: {
    Trash2,
    RefreshCw,
    Play,
    Pause,
    Eraser,
  },
  props: ["task"],
  data() {
    return {
      refreshing: false,
      t: null as any,
    };
  },
  computed: {
    currentList() {
      return useTaskStore().currentList;
    },
    selectedGidListCount() {
      return useTaskStore().selectedGidList.length;
    },
    hasSelection() {
      return this.selectedGidListCount > 0;
    },
  },
  methods: {
    refreshSpin() {
      this.t && clearTimeout(this.t);

      this.refreshing = true;
      this.t = setTimeout(() => {
        this.refreshing = false;
      }, 500);
    },
    onBatchDeleteClick(event) {
      const deleteWithFiles = !!event.shiftKey;
      commands.emit("batch-delete-task", { deleteWithFiles });
    },
    onRefreshClick() {
      this.refreshSpin();
      useTaskStore().fetchList();
    },
    onResumeClick() {
      if (this.hasSelection) {
        useTaskStore()
          .batchResumeSelectedTasks()
          ?.then(() => {
            this.$msg.success(this.$t("task.resume-selected-tasks-success"));
          })
          .catch(({ code }) => {
            if (code === 1) {
              this.$msg.error(this.$t("task.resume-selected-tasks-fail"));
            }
          });
      } else {
        useTaskStore()
          .resumeAllTask()
          .then(() => {
            this.$msg.success(this.$t("task.resume-all-task-success"));
          })
          .catch(({ code }) => {
            if (code === 1) {
              this.$msg.error(this.$t("task.resume-all-task-fail"));
            }
          });
      }
    },
    onPauseClick() {
      if (this.hasSelection) {
        useTaskStore()
          .batchPauseSelectedTasks()
          ?.then(() => {
            this.$msg.success(this.$t("task.pause-selected-tasks-success"));
          })
          .catch(({ code }) => {
            if (code === 1) {
              this.$msg.error(this.$t("task.pause-selected-tasks-fail"));
            }
          });
      } else {
        useTaskStore()
          .pauseAllTask()
          .then(() => {
            this.$msg.success(this.$t("task.pause-all-task-success"));
          })
          .catch(({ code }) => {
            if (code === 1) {
              this.$msg.error(this.$t("task.pause-all-task-fail"));
            }
          });
      }
    },
    onPurgeRecordClick() {
      useTaskStore()
        .purgeTaskRecord()
        .then(() => {
          this.$msg.success(this.$t("task.purge-record-success"));
        })
        .catch(({ code }) => {
          if (code === 1) {
            this.$msg.error(this.$t("task.purge-record-fail"));
          }
        });
    },
    onAddClick() {
      useAppStore().showAddTaskDialog(ADD_TASK_TYPE.URI);
    },
  },
};
</script>
