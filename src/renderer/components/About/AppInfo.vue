<template>
  <div class="app-info">
    <div class="app-version">
      <mo-logo :width="93" :height="21" style="vertical-align: bottom" />
      <span>Version {{ version }}</span>
    </div>
    <div class="app-icon"></div>
    <div class="engine-info" v-if="!!engine">
      <h4>{{ $t('about.engine-version') }} {{ engine.version }}</h4>
      <ul v-if="!isMas()">
        <li v-for="(feature, index) in engine.enabledFeatures" v-bind:key="`feature-${index}`">
          {{ feature }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script lang="ts">
import is from '@/shims/platform'
import Logo from '@/components/Logo/Logo.vue'

export default {
  name: 'mo-app-info',
  components: {
    [Logo.name]: Logo,
  },
  props: {
    version: {
      type: String,
      default: '',
    },
    engine: {
      type: Object,
      default() {
        return {
          version: '',
          enabledFeatures: [],
        }
      },
    },
  },
  methods: {
    isMas: is.mas,
  },
}
</script>
