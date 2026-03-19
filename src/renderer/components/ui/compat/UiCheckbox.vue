<script setup lang="ts">
import { computed } from "vue";
import { Checkbox } from "../checkbox";

const props = withDefaults(
  defineProps<{
    modelValue?: boolean;
    disabled?: boolean;
  }>(),
  {
    modelValue: false,
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  change: [value: boolean];
}>();

const checked = computed({
  get: () => props.modelValue,
  set: (val: boolean) => {
    emit("update:modelValue", val);
    emit("change", val);
  },
});
</script>

<template>
  <label class="ui-checkbox" :class="{ 'is-disabled': disabled }">
    <Checkbox
      :model-value="checked"
      :disabled="disabled"
      @update:model-value="
        (val: boolean) => {
          checked = val;
        }
      "
    />
    <span class="ui-checkbox__label">
      <slot />
    </span>
  </label>
</template>
