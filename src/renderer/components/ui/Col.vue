<template>
  <div class="ui-col" :class="colClasses" :style="colStyles">
    <slot />
  </div>
</template>

<script lang="ts">
export default {
  name: "ui-col",
  props: {
    span: { type: Number, default: 24 },
    xs: { type: Number, default: null },
    sm: { type: Number, default: null },
    md: { type: Number, default: null },
    lg: { type: Number, default: null },
    offset: { type: Number, default: 0 },
    push: { type: Number, default: 0 },
    pull: { type: Number, default: 0 },
  },
  computed: {
    colClasses() {
      const classes: string[] = [];
      if (this.span) classes.push(`ui-col--${this.span}`);
      if (this.xs) classes.push(`ui-col--xs-${this.xs}`);
      if (this.sm) classes.push(`ui-col--sm-${this.sm}`);
      if (this.md) classes.push(`ui-col--md-${this.md}`);
      if (this.lg) classes.push(`ui-col--lg-${this.lg}`);
      return classes;
    },
    colStyles() {
      const style: Record<string, string> = {};
      if (this.offset > 0) {
        style.marginLeft = `${(this.offset / 24) * 100}%`;
      }
      if (this.push > 0) {
        style.left = `${(this.push / 24) * 100}%`;
        style.position = "relative";
      }
      if (this.pull > 0) {
        style.right = `${(this.pull / 24) * 100}%`;
        style.position = "relative";
      }
      return style;
    },
  },
};
</script>
