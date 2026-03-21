<template>
  <div id="container" class="layout-root">
    <mo-aside />
    <router-view v-slot="{ Component, route }">
      <Transition name="page" mode="out-in">
        <component
          :is="Component"
          :key="route.path.startsWith('/preference') ? 'preference' : 'task'"
          class="page-view"
        />
      </Transition>
    </router-view>
    <mo-speedometer />
    <mo-add-task :visible="addTaskVisible" :type="addTaskType" />
    <mo-about-panel :visible="aboutPanelVisible" />
    <mo-task-detail
      :visible="taskDetailVisible"
      :gid="currentTaskGid"
      :task="currentTaskItem"
      :files="currentTaskFiles"
      :peers="currentTaskPeers"
    />
    <mo-dragger />
  </div>
</template>

<script lang="ts">
import { useAppStore } from '@/store/app'
import { useTaskStore } from '@/store/task'
import AboutPanel from '@/components/About/AboutPanel.vue'
import Aside from '@/components/Aside/Index.vue'
import Speedometer from '@/components/Speedometer/Speedometer.vue'
import AddTask from '@/components/Task/AddTask.vue'
import TaskDetail from '@/components/TaskDetail/Index.vue'
import Dragger from '@/components/Dragger/Index.vue'

export default {
  name: 'mo-main',
  components: {
    [AboutPanel.name]: AboutPanel,
    [Aside.name]: Aside,
    [Speedometer.name]: Speedometer,
    [AddTask.name]: AddTask,
    [TaskDetail.name]: TaskDetail,
    [Dragger.name]: Dragger,
  },
  computed: {
    aboutPanelVisible() {
      return useAppStore().aboutPanelVisible
    },
    addTaskVisible() {
      return useAppStore().addTaskVisible
    },
    addTaskType() {
      return useAppStore().addTaskType
    },
    taskDetailVisible() {
      return useTaskStore().taskDetailVisible
    },
    currentTaskGid() {
      return useTaskStore().currentTaskGid
    },
    currentTaskItem() {
      return useTaskStore().currentTaskItem
    },
    currentTaskFiles() {
      return useTaskStore().currentTaskFiles
    },
    currentTaskPeers() {
      return useTaskStore().currentTaskPeers
    },
  },
  methods: {},
}
</script>
