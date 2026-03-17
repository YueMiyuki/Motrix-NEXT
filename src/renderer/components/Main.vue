<template>
  <el-container id="container">
    <mo-aside />
    <router-view />
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
  </el-container>
</template>

<script lang="ts">
  import { mapState } from 'vuex'
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
      [Dragger.name]: Dragger
    },
    computed: {
      ...(mapState as any)('app', {
        aboutPanelVisible: (state: any) => state.aboutPanelVisible,
        addTaskVisible: (state: any) => state.addTaskVisible,
        addTaskType: (state: any) => state.addTaskType
      }),
      ...(mapState as any)('task', {
        taskDetailVisible: (state: any) => state.taskDetailVisible,
        currentTaskGid: (state: any) => state.currentTaskGid,
        currentTaskItem: (state: any) => state.currentTaskItem,
        currentTaskFiles: (state: any) => state.currentTaskFiles,
        currentTaskPeers: (state: any) => state.currentTaskPeers
      })
    },
    methods: {
    }
  }
</script>

<style lang="scss">
  .mo-speedometer {
    position: fixed;
    right: 16px;
    bottom: 24px;
    z-index: 20;
  }
</style>
