<template>
  <div class="mo-number-input-wrap">
    <input
      type="number"
      class="mo-input-number"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      @input="onInput"
      @blur="onBlur"
    />
    <div class="mo-number-btns">
      <button
        type="button"
        class="mo-number-btn"
        tabindex="-1"
        @click="increment($event)"
        @mousedown.prevent
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>
      <button
        type="button"
        class="mo-number-btn"
        tabindex="-1"
        @click="decrement($event)"
        @mousedown.prevent
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue?: number;
    min?: number;
    max?: number;
    step?: number;
  }>(),
  {
    modelValue: 0,
    min: 0,
    max: Infinity,
    step: 1,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: number): void;
}>();

const clickResetTimers = new WeakMap<HTMLElement, number>();

function clamp(val: number): number {
  return Math.min(props.max, Math.max(props.min, val));
}

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  if (raw === "") return;
  const num = parseFloat(raw);
  if (!isNaN(num)) {
    emit("update:modelValue", num);
  }
}

function onBlur(e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  const num = parseFloat(raw);
  if (isNaN(num)) {
    emit("update:modelValue", props.min);
  } else {
    emit("update:modelValue", clamp(num));
  }
}

function animateBtn(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return;
  const previousTimer = clickResetTimers.get(el);
  if (previousTimer !== undefined) {
    window.clearTimeout(previousTimer);
  }
  el.classList.remove("is-clicked");
  // Force reflow so repeated fast clicks can replay the animation.
  el.getBoundingClientRect();
  el.classList.add("is-clicked");
  const timer = window.setTimeout(() => {
    clickResetTimers.delete(el);
    el.classList.remove("is-clicked");
  }, 180);
  clickResetTimers.set(el, timer);
}

function increment(event?: MouseEvent) {
  animateBtn(event?.currentTarget ?? null);
  emit("update:modelValue", clamp((props.modelValue ?? 0) + props.step));
}

function decrement(event?: MouseEvent) {
  animateBtn(event?.currentTarget ?? null);
  emit("update:modelValue", clamp((props.modelValue ?? 0) - props.step));
}
</script>
