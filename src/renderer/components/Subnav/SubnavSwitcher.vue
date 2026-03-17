<template>
  <div class="subnav-switch">
    <h4 class="subnav-title">{{ title }}</h4>
    <div class="subnav-select-wrap">
      <select class="subnav-select" :value="currentRoute" @change="handleRoute($event.target.value)">
        <option v-for="sn in subnavs" :key="sn.key" :value="sn.route">
          {{ sn.title }}
        </option>
      </select>
      <i class="el-icon-arrow-down subnav-select-arrow" />
    </div>
  </div>
</template>

<script lang="ts">
  export default {
    name: 'mo-subnav-switcher',
    props: {
      title: {
        type: String
      },
      subnavs: {
        type: Array
      }
    },
    computed: {
      currentRoute () {
        const route = this.$route?.path
        const exists = this.subnavs.find(item => item.route === route)
        return exists ? route : (this.subnavs[0]?.route || '/')
      }
    },
    methods: {
      handleRoute (route) {
        if (!route) {
          return
        }
        this.$router.push({
          path: route
        }).catch(() => {})
      }
    }
  }
</script>

<style lang='scss'>
.subnav-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  .subnav-title {
    color: $--subnav-action-color;
    font-size: 16px;
    margin: 0;
  }
  .subnav-select-wrap {
    position: relative;
    min-width: 112px;
  }
  .subnav-select {
    width: 100%;
    border: 1px solid $--input-border-color;
    border-radius: 6px;
    background: $--select-dropdown-background;
    color: $--select-option-color;
    padding: 4px 28px 4px 8px;
    font-size: 14px;
    line-height: 1.4;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
  }
  .subnav-select-arrow {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: $--subnav-action-color;
  }
}
.theme-dark {
  .subnav-switch {
    .subnav-title {
      color: $--dk-subnav-action-color;
    }
  }
  .subnav-select {
    background-color: $--dk-subnav-background;
    border-color: $--dk-subnav-border-color;
    color: $--dk-subnav-text-color;
  }
}
</style>
