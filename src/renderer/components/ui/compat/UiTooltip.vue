<script setup lang="ts">
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../tooltip";

defineProps<{
  content?: string;
}>();
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <Tooltip>
      <TooltipTrigger as-child>
        <span class="ui-tooltip">
          <slot />
        </span>
      </TooltipTrigger>
      <TooltipContent v-if="content">
        {{ content }}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
