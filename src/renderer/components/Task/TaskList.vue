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
        <div
          :attr="item.gid"
          :class="getItemClass(item)"
        >
          <mo-task-item
            :task="item"
          />
        </div>
      </template>
    </recycle-scroller>
    <mo-drag-select
      v-else
      class="task-list"
      attribute="attr"
      @change="handleDragSelectChange"
    >
      <div
        v-for="item in taskList"
        :key="item.gid"
        :attr="item.gid"
        :class="getItemClass(item)"
      >
        <mo-task-item
          :task="item"
        />
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
  import { mapState } from 'vuex'
  import { cloneDeep } from 'lodash'
  import DragSelect from '@/components/DragSelect/Index.vue'
  import TaskItem from './TaskItem.vue'

  const VIRTUAL_LIST_THRESHOLD = 120

  export default {
    name: 'mo-task-list',
    components: {
      [DragSelect.name]: DragSelect,
      [TaskItem.name]: TaskItem
    },
    data () {
      const selectedList = cloneDeep((this.$store as any).state.task.selectedGidList) || []
      return {
        selectedList
      }
    },
    computed: {
      ...(mapState as any)('task', {
        taskList: (state: any) => state.taskList,
        selectedGidList: (state: any) => state.selectedGidList
      }),
      useVirtualList () {
        return this.taskList.length >= VIRTUAL_LIST_THRESHOLD
      }
    },
    methods: {
      handleDragSelectChange (selectedList) {
        this.selectedList = selectedList
        this.$store.dispatch('task/selectTasks', cloneDeep(selectedList))
      },
      getItemClass (item) {
        const isSelected = this.selectedList.includes(item.gid)
        return {
          selected: isSelected
        }
      }
    },
    watch: {
      selectedGidList (newVal) {
        this.selectedList = newVal
      }
    }
  }
</script>

<style lang="scss">
.task-list-wrapper {
  height: 100%;
}
.task-list {
  padding: 16px 16px 64px;
  min-height: 100%;
  box-sizing: border-box;
}
.task-list-virtual {
  height: 100%;
}
.no-task {
  display: flex;
  height: 100%;
  text-align: center;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #555;
  user-select: none;
}
.no-task-inner {
  width: 100%;
  padding-top: 360px;
  background: transparent url('@/assets/no-task.svg') top center no-repeat;
}
</style>
