<template>
  <Sheet :open="visible" @update:open="handleSheetOpenChange">
    <SheetContent side="right" class="task-detail-drawer">
      <SheetHeader>
        <SheetTitle>{{ $t('task.task-detail-title') }}</SheetTitle>
      </SheetHeader>
      <Tabs v-model="activeTab" default-value="general" class="task-detail-tab">
        <TabsList>
          <TabsTrigger value="general">
            <span class="task-detail-tab-label"><Info :size="16" /></span>
          </TabsTrigger>
          <TabsTrigger value="activity">
            <span class="task-detail-tab-label"><Activity :size="16" /></span>
          </TabsTrigger>
          <TabsTrigger v-if="isBT" value="trackers">
            <span class="task-detail-tab-label"><Radar :size="16" /></span>
          </TabsTrigger>
          <TabsTrigger v-if="isBT" value="peers">
            <span class="task-detail-tab-label"><Users :size="16" /></span>
          </TabsTrigger>
          <TabsTrigger value="files">
            <span class="task-detail-tab-label"><Files :size="16" /></span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <mo-task-general :task="task" />
        </TabsContent>
        <TabsContent value="activity">
          <mo-task-activity ref="taskGraphic" :task="task" />
        </TabsContent>
        <TabsContent v-if="isBT" value="trackers">
          <mo-task-trackers :task="task" />
        </TabsContent>
        <TabsContent v-if="isBT" value="peers">
          <mo-task-peers :peers="peers" />
        </TabsContent>
        <TabsContent value="files">
          <mo-task-files
            ref="detailFileList"
            mode="DETAIL"
            :files="fileList"
            @selection-change="handleSelectionChange"
          />
        </TabsContent>
      </Tabs>
      <div class="task-detail-actions">
        <div class="action-wrapper action-wrapper-left" v-if="optionsChanged">
          <ui-button @click="resetChanged">
            {{ $t('app.reset') }}
          </ui-button>
        </div>
        <div class="action-wrapper action-wrapper-center">
          <mo-task-item-actions mode="DETAIL" :task="task" />
        </div>
        <div class="action-wrapper action-wrapper-right" v-if="optionsChanged">
          <ui-button variant="primary" @click="saveChanged">
            {{ $t('app.save') }}
          </ui-button>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>

<script lang="ts">
import { Activity, Files, Info, Radar, Users } from 'lucide-vue-next'
import is from '@/shims/platform'
import { debounce } from 'lodash'
import { useTaskStore } from '@/store/task'
import { usePreferenceStore } from '@/store/preference'
import {
  calcFormLabelWidth,
  checkTaskIsBT,
  checkTaskIsSeeder,
  getFileName,
  getFileExtension,
} from '@shared/utils'
import {
  EMPTY_STRING,
  NONE_SELECTED_FILES,
  SELECTED_ALL_FILES,
  TASK_STATUS,
} from '@shared/constants'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import TaskItemActions from '@/components/Task/TaskItemActions.vue'
import TaskGeneral from './TaskGeneral.vue'
import TaskActivity from './TaskActivity.vue'
import TaskTrackers from './TaskTrackers.vue'
import TaskPeers from './TaskPeers.vue'
import TaskFiles from './TaskFiles.vue'

const cached = {
  files: [],
}

export default {
  name: 'mo-task-detail',
  components: {
    [TaskItemActions.name]: TaskItemActions,
    [TaskGeneral.name]: TaskGeneral,
    [TaskActivity.name]: TaskActivity,
    [TaskTrackers.name]: TaskTrackers,
    [TaskPeers.name]: TaskPeers,
    [TaskFiles.name]: TaskFiles,
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Activity,
    Files,
    Info,
    Radar,
    Users,
  },
  props: {
    gid: {
      type: String,
    },
    task: {
      type: Object,
    },
    files: {
      type: Array,
      default: function () {
        return []
      },
    },
    peers: {
      type: Array,
      default: function () {
        return []
      },
    },
    visible: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    const locale = ((usePreferenceStore().config as any) || {}).locale || 'en-US'
    return {
      form: {},
      formLabelWidth: calcFormLabelWidth(locale),
      locale,
      activeTab: 'general',
      graphicWidth: 0,
      optionsChanged: false,
      filesSelection: EMPTY_STRING,
      selectionChangedCount: 0,
      updateGraphicWidthDebounced: null,
    }
  },
  computed: {
    isRenderer: () => is.renderer(),
    isBT() {
      return this.task ? checkTaskIsBT(this.task) : false
    },
    isSeeder() {
      return this.task ? checkTaskIsSeeder(this.task) : false
    },
    taskStatus() {
      const { task, isSeeder } = this
      if (!task) return ''
      if (isSeeder) {
        return TASK_STATUS.SEEDING
      } else {
        return task.status
      }
    },
    fileList() {
      const { files } = this
      const result = files.map((item) => {
        const name = getFileName(item.path)
        const extension = getFileExtension(name)
        return {
          idx: Number(item.index),
          selected: item.selected === 'true',
          path: item.path,
          name,
          extension: `.${extension}`,
          length: parseInt(item.length, 10),
          completedLength: item.completedLength,
        }
      })
      cached.files = result
      return cached.files
    },
    selectedFileList() {
      const { fileList } = this
      const result = fileList.filter((item) => item.selected)

      return result
    },
  },
  mounted() {
    this.updateGraphicWidthDebounced = debounce(() => {
      if (this.activeTab === 'activity' && this.$refs.taskGraphic) {
        this.$refs.taskGraphic.updateGraphicWidth()
      }
    }, 250)
    window.addEventListener('resize', this.handleAppResize)
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.handleAppResize)
    if (this.updateGraphicWidthDebounced && this.updateGraphicWidthDebounced.cancel) {
      this.updateGraphicWidthDebounced.cancel()
    }
    cached.files = []
  },
  watch: {
    gid() {
      cached.files = []
    },
    visible(newVal, oldVal) {
      if (oldVal && !newVal) {
        setTimeout(() => {
          this.handleClosed()
        }, 350)
      }
    },
    activeTab(newTab, oldTab) {
      if (newTab === oldTab) {
        return
      }
      this.optionsChanged = false
      switch (oldTab) {
        case 'peers':
          useTaskStore().toggleEnabledFetchPeers(false)
          break
        case 'files':
          this.resetFaskFilesSelection()
          break
      }
      switch (newTab) {
        case 'peers':
          useTaskStore().toggleEnabledFetchPeers(true)
          break
        case 'files':
          this.$nextTick(() => {
            this.updateFilesListSelection()
          })
          break
      }
    },
  },
  methods: {
    handleSheetOpenChange(open) {
      if (!open) {
        this.handleClose()
      }
    },
    handleClose() {
      window.removeEventListener('resize', this.handleAppResize)
      useTaskStore().hideTaskDetail()
    },
    handleClosed() {
      const taskStore = useTaskStore()
      taskStore.updateCurrentTaskGid(EMPTY_STRING)
      taskStore.updateCurrentTaskItem(null)
      this.optionsChanged = false
      this.resetFaskFilesSelection()
    },
    resetChanged() {
      const { activeTab } = this
      switch (activeTab) {
        case 'files':
          this.resetFaskFilesSelection()
          this.updateFilesListSelection()
          break
      }
      this.optionsChanged = false
    },
    saveChanged() {
      const { activeTab } = this
      switch (activeTab) {
        case 'files':
          this.saveFaskFilesSelection()
          break
      }
      this.optionsChanged = false
    },
    handleAppResize() {
      if (this.updateGraphicWidthDebounced) {
        this.updateGraphicWidthDebounced()
      }
    },
    updateFilesListSelection() {
      if (!this.$refs.detailFileList) {
        return
      }

      const { selectedFileList } = this
      this.$refs.detailFileList.toggleSelection(selectedFileList)
    },
    handleSelectionChange(val) {
      this.filesSelection = val
      this.selectionChangedCount += 1
      if (this.selectionChangedCount > 1) {
        this.optionsChanged = true
      }
    },
    resetFaskFilesSelection() {
      this.filesSelection = EMPTY_STRING
      this.selectionChangedCount = 0
    },
    saveFaskFilesSelection() {
      const { gid, filesSelection } = this
      if (filesSelection === NONE_SELECTED_FILES) {
        this.$msg.warning(this.$t('task.select-at-least-one'))
        return
      }

      const options = {
        selectFile: filesSelection !== SELECTED_ALL_FILES ? filesSelection : EMPTY_STRING,
      }
      useTaskStore().changeTaskOption({ gid, options })
    },
  },
}
</script>
