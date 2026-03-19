<script setup lang="ts">
import { computed } from "vue";
import { Progress } from "../progress";

const props = withDefaults(
  defineProps<{
    percentage?: number;
    status?: string;
    color?: string;
  }>(),
  {
    percentage: 0,
    status: "",
    color: "",
  },
);

const safePercent = computed(() => {
  if (!Number.isFinite(props.percentage)) return 0;
  return Math.max(0, Math.min(100, props.percentage));
});
</script>

<template>
  <Progress
    :model-value="safePercent"
    class="ui-progress"
    :class="{ 'is-success': status === 'success' }"
  />
</template>
