<template>
  <div class="task-list-wrapper" v-if="taskList.length > 0">
    <recycle-scroller
      v-if="useVirtualList"
      class="task-list task-list-virtual"
      :items="taskList"
      :item-size="112"
      key-field="gid"
    >
      <template #default="{ item }">
        <div :attr="item.gid" :class="getItemClass(item)" @click="handleItemClick(item, $event)">
          <mo-task-item :task="item" />
        </div>
      </template>
    </recycle-scroller>
    <mo-drag-select v-else class="task-list" attribute="attr" @change="handleDragSelectChange">
      <div
        v-for="(item, index) in taskList"
        :key="item.gid"
        :attr="item.gid"
        :class="getItemClass(item)"
        :style="{ '--stagger-index': index }"
        @click="handleItemClick(item, $event)"
      >
        <mo-task-item :task="item" />
      </div>
    </mo-drag-select>
  </div>
  <div class="no-task" v-else>
    <div class="no-task-inner">
      {{ $t('task.no-task') }}
    </div>
  </div>
</template>

<script lang="ts">
import { cloneDeep } from 'lodash'
import { useTaskStore } from '@/store/task'
import DragSelect from '@/components/DragSelect/Index.vue'
import TaskItem from './TaskItem.vue'

const VIRTUAL_LIST_THRESHOLD = 120

export default {
  name: 'mo-task-list',
  components: {
    [DragSelect.name]: DragSelect,
    [TaskItem.name]: TaskItem,
  },
  data() {
    const selectedList = cloneDeep(useTaskStore().selectedGidList) || []
    return {
      selectedList,
    }
  },
  computed: {
    taskList() {
      return useTaskStore().taskList
    },
    selectedGidList() {
      return useTaskStore().selectedGidList
    },
    useVirtualList() {
      return this.taskList.length >= VIRTUAL_LIST_THRESHOLD
    },
  },
  methods: {
    handleItemClick(item, event) {
      const gid = item.gid
      const isMulti = event.metaKey || event.ctrlKey
      let newList
      if (isMulti) {
        const idx = this.selectedList.indexOf(gid)
        newList =
          idx === -1 ? [...this.selectedList, gid] : this.selectedList.filter((id) => id !== gid)
      } else {
        newList = this.selectedList.length === 1 && this.selectedList[0] === gid ? [] : [gid]
      }
      this.selectedList = newList
      useTaskStore().selectTasks(cloneDeep(newList))
    },
    handleDragSelectChange(selectedList) {
      this.selectedList = selectedList
      useTaskStore().selectTasks(cloneDeep(selectedList))
    },
    getItemClass(item) {
      const isSelected = this.selectedList.includes(item.gid)
      return {
        selected: isSelected,
      }
    },
  },
  watch: {
    selectedGidList(newVal) {
      this.selectedList = newVal
    },
  },
}
</script>
