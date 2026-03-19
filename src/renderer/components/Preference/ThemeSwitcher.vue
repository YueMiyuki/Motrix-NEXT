<template>
  <div class="theme-switcher">
    <div
      v-for="item in themeOptions"
      :key="item.value"
      :class="['theme-option', { active: currentValue === item.value }]"
      @click.prevent="() => handleChange(item.value)"
    >
      <div :class="['theme-preview', item.className]">
        <!-- Light preview -->
        <template v-if="item.value === 'light'">
          <div class="preview-sidebar preview-sidebar--light"></div>
          <div class="preview-content preview-content--light">
            <div class="preview-header preview-header--light"></div>
            <div class="preview-body">
              <div class="preview-line preview-line--light"></div>
              <div class="preview-line preview-line--light short"></div>
            </div>
          </div>
        </template>
        <!-- Dark preview -->
        <template v-else-if="item.value === 'dark'">
          <div class="preview-sidebar preview-sidebar--dark"></div>
          <div class="preview-content preview-content--dark">
            <div class="preview-header preview-header--dark"></div>
            <div class="preview-body">
              <div class="preview-line preview-line--dark"></div>
              <div class="preview-line preview-line--dark short"></div>
            </div>
          </div>
        </template>
        <!-- Auto preview (split) -->
        <template v-else>
          <div class="preview-split">
            <div class="preview-half preview-half--light">
              <div class="mini-sidebar"></div>
              <div class="mini-content"></div>
            </div>
            <div class="preview-half preview-half--dark">
              <div class="mini-sidebar"></div>
              <div class="mini-content"></div>
            </div>
          </div>
        </template>
      </div>
      <span class="theme-label">{{ item.text }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import { APP_THEME } from "@shared/constants";

export default {
  name: "mo-theme-switcher",
  props: {
    modelValue: {
      type: String,
      default: APP_THEME.AUTO,
    },
    // legacy v-model support
    value: {
      type: String,
      default: null,
    },
  },
  emits: ["update:modelValue", "change"],
  data() {
    return {
      currentValue: this.modelValue ?? this.value ?? APP_THEME.AUTO,
    };
  },
  computed: {
    themeOptions() {
      return [
        {
          className: "preview-auto",
          value: APP_THEME.AUTO,
          text: this.$t("preferences.theme-auto"),
        },
        {
          className: "preview-light",
          value: APP_THEME.LIGHT,
          text: this.$t("preferences.theme-light"),
        },
        {
          className: "preview-dark",
          value: APP_THEME.DARK,
          text: this.$t("preferences.theme-dark"),
        },
      ];
    },
  },
  watch: {
    modelValue(val) {
      if (val !== null && val !== this.currentValue) {
        this.currentValue = val;
      }
    },
    value(val) {
      if (val !== null && val !== this.currentValue) {
        this.currentValue = val;
      }
    },
    currentValue(val) {
      this.$emit("update:modelValue", val);
      this.$emit("change", val);
    },
  },
  methods: {
    handleChange(theme) {
      this.currentValue = theme;
    },
  },
};
</script>
