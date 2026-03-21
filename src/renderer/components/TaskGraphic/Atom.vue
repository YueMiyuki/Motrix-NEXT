<template>
  <rect
    :class="klass"
    :status="status"
    :width="width"
    :height="height"
    :rx="radius"
    :ry="radius"
    :x="x"
    :y="y"
  >
  </rect>
</template>

<script lang="ts">
export default {
  name: 'mo-task-graphic-atom',
  props: {
    status: {
      type: Number,
    },
    width: {
      type: Number,
      default: 10,
    },
    height: {
      type: Number,
      default: 10,
    },
    radius: {
      type: Number,
      default: 2,
    },
    x: {
      type: Number,
    },
    y: {
      type: Number,
    },
  },
  computed: {
    klass() {
      const { status } = this
      return `graphic-atom graphic-atom-s${status}`
    },
  },
}
</script>
