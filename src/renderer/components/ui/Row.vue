<template>
  <div class="ui-row" :style="rowStyle">
    <slot />
  </div>
</template>

<script lang="ts">
export default {
  name: "ui-row",
  props: {
    gutter: {
      type: [Number, String],
      default: 0,
    },
  },
  computed: {
    gutterValue(): number {
      const value = Number(this.gutter);
      return Number.isFinite(value) ? value : 0;
    },
    rowStyle(): Record<string, string> {
      const half = `${this.gutterValue / 2}px`;
      return {
        marginLeft: `-${half}`,
        marginRight: `-${half}`,
      };
    },
  },
};
</script>
