<template>
  <el-aside width="78px" :class="['aside', 'hidden-sm-and-down', { 'draggable': asideDraggable }]" :style="vibrancy">
    <div class="aside-inner">
      <mo-logo-mini />
      <p class="aside-next">NEXT</p>
      <div class="aside-version" v-if="appVersion">
        {{ appVersion }}
      </div>
      <ul class="menu top-menu">
        <li @click="nav('/task')" class="non-draggable">
          <mo-icon name="menu-task" width="20" height="20" />
        </li>
        <li @click="showAddTask()" class="non-draggable">
          <mo-icon name="menu-add" width="20" height="20" />
        </li>
      </ul>
      <ul class="menu bottom-menu">
        <li @click="nav('/preference')" class="non-draggable">
          <mo-icon name="menu-preference" width="20" height="20" />
        </li>
        <li @click="showAboutPanel" class="non-draggable">
          <mo-icon name="menu-about" width="20" height="20" />
        </li>
      </ul>
    </div>
  </el-aside>
</template>

<script lang="ts">
  import is from 'electron-is'
  import { mapState } from 'vuex'
  import { ADD_TASK_TYPE } from '@shared/constants'
  import LogoMini from '@/components/Logo/LogoMini.vue'
  import { getMotrixVersion } from '@/utils/version'
  import '@/components/Icons/menu-task'
  import '@/components/Icons/menu-add'
  import '@/components/Icons/menu-preference'
  import '@/components/Icons/menu-about'

  export default {
    name: 'mo-aside',
    components: {
      [LogoMini.name]: LogoMini
    },
    computed: {
      appVersion () {
        return getMotrixVersion()
      },
      ...(mapState as any)('app', {
        currentPage: (state: any) => state.currentPage
      }),
      asideDraggable () {
        return is.macOS()
      },
      vibrancy () {
        return is.macOS()
          ? {
            backgroundColor: 'transparent'
          }
          : {}
      }
    },
    methods: {
      showAddTask (taskType = ADD_TASK_TYPE.URI) {
        this.$store.dispatch('app/showAddTaskDialog', taskType)
      },
      showAboutPanel () {
        this.$store.dispatch('app/showAboutPanel')
      },
      nav (page) {
        this.$router.push({
          path: page
        }).catch(err => {
          console.log(err)
        })
      }
    }
  }
</script>

<style lang="scss">
.aside-inner {
  display: flex;
  height: 100%;
  flex-flow: column;
}
.logo-mini {
  margin-top: 40px;
}
.aside-next {
  margin: 10px 0 0;
  text-align: center;
  font-size: 11px;
  line-height: 1;
  font-weight: 700;
  letter-spacing: 1.2px;
  color: rgba(255, 255, 255, 0.7);
}
.aside-version {
  margin: 6px auto 4px;
  min-width: 46px;
  padding: 3px 6px;
  border-radius: 6px;
  text-align: center;
  font-size: 10px;
  line-height: 1;
  font-weight: 600;
  letter-spacing: 0.3px;
  color: rgba(255, 255, 255, 0.85);
  background-color: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.18);
}
.menu {
  list-style: none;
  padding: 0;
  margin: 0 auto;
  user-select: none;
  cursor: default;
  > li {
    width: 32px;
    height: 32px;
    margin-top: 24px;
    cursor: pointer;
    border-radius: 16px;
    transition: background-color 0.25s;
    &:hover {
      background-color: rgba(255, 255, 255, 0.15);
    }
  }
  svg {
    padding: 6px;
    color: #fff;
  }
}
.top-menu {
  flex: 1;
}
.bottom-menu {
  margin-bottom: 24px;
}
</style>
