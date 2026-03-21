<template>
  <aside class="aside hidden-sm-and-down" :class="{ draggable: asideDraggable }" :style="vibrancy">
    <div class="aside-inner">
      <div class="aside-brand">
        <mo-logo-mini />
        <p class="aside-next">NEXT</p>
        <div class="aside-version" v-if="appVersion">
          {{ appVersion }}
        </div>
      </div>
      <ul class="menu top-menu">
        <li @click="nav('/task')" class="non-draggable" style="--stagger-index: 0">
          <ListTodo :size="20" />
        </li>
        <li @click="showAddTask()" class="non-draggable" style="--stagger-index: 1">
          <Plus :size="20" />
        </li>
      </ul>
      <ul class="menu bottom-menu">
        <li @click="nav('/preference')" class="non-draggable" style="--stagger-index: 0">
          <Settings2 :size="20" />
        </li>
        <li @click="showAboutPanel" class="non-draggable" style="--stagger-index: 1">
          <Info :size="20" />
        </li>
      </ul>
    </div>
  </aside>
</template>

<script lang="ts">
import logger from '@shared/utils/logger'
import { Info, ListTodo, Plus, Settings2 } from 'lucide-vue-next'
import { useAppStore } from '@/store/app'
import { ADD_TASK_TYPE } from '@shared/constants'
import LogoMini from '@/components/Logo/LogoMini.vue'
import { getMotrixVersion } from '@/utils/version'

export default {
  name: 'mo-aside',
  components: {
    [LogoMini.name]: LogoMini,
    Info,
    ListTodo,
    Plus,
    Settings2,
  },
  data() {
    return {
      appVersion: '',
    }
  },
  async created() {
    this.appVersion = await getMotrixVersion()
  },
  computed: {},
  methods: {
    showAddTask(taskType = ADD_TASK_TYPE.URI) {
      useAppStore().showAddTaskDialog(taskType)
    },
    showAboutPanel() {
      useAppStore().showAboutPanel()
    },
    nav(page) {
      this.$router
        .push({
          path: page,
        })
        .catch((err) => {
          logger.log(err)
        })
    },
  },
}
</script>
