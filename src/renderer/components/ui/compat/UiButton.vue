<script setup lang="ts">
import { computed } from "vue";
import { Button, type ButtonVariants } from "../button";

const props = withDefaults(
  defineProps<{
    type?: "button" | "submit" | "reset";
    variant?: "default" | "primary" | "ghost" | "outline" | "destructive";
    size?: "sm" | "md" | "lg";
    disabled?: boolean;
  }>(),
  {
    type: "button",
    variant: "default",
    size: "md",
    disabled: false,
  },
);

const mappedVariant = computed<ButtonVariants["variant"]>(() => {
  switch (props.variant) {
    case "primary":
      return "default";
    case "default":
      return "outline";
    default:
      return props.variant as ButtonVariants["variant"];
  }
});

const mappedSize = computed<ButtonVariants["size"]>(() => {
  switch (props.size) {
    case "md":
      return "default";
    default:
      return props.size as ButtonVariants["size"];
  }
});
</script>

<template>
  <Button
    class="ui-button"
    :variant="mappedVariant"
    :size="mappedSize"
    :disabled="disabled"
  >
    <slot />
  </Button>
</template>
