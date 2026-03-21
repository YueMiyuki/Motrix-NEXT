<template>
  <nav class="subnav-inner">
    <h3>{{ title }}</h3>
    <ul>
      <li
        @click="() => nav('basic')"
        :class="[current === 'basic' ? 'active' : '']"
        style="--stagger-index: 0"
      >
        <i class="subnav-icon">
          <SlidersHorizontal :size="20" />
        </i>
        <span>{{ $t('preferences.basic') }}</span>
      </li>
      <li
        @click="() => nav('advanced')"
        :class="[current === 'advanced' ? 'active' : '']"
        style="--stagger-index: 1"
      >
        <i class="subnav-icon">
          <Wrench :size="20" />
        </i>
        <span>{{ $t('preferences.advanced') }}</span>
      </li>
      <li
        @click="() => nav('lab')"
        :class="[current === 'lab' ? 'active' : '']"
        style="--stagger-index: 2"
      >
        <i class="subnav-icon">
          <FlaskConical :size="20" />
        </i>
        <span>{{ $t('preferences.lab') }}</span>
      </li>
    </ul>
  </nav>
</template>

<script lang="ts">
import logger from '@shared/utils/logger'
import { FlaskConical, SlidersHorizontal, Wrench } from 'lucide-vue-next'

export default {
  name: 'mo-preference-subnav',
  components: {
    FlaskConical,
    SlidersHorizontal,
    Wrench,
  },
  props: {
    current: {
      type: String,
      default: 'basic',
    },
  },
  computed: {
    title() {
      return this.$t('subnav.preferences')
    },
  },
  methods: {
    nav(category = 'basic') {
      this.$router
        .push({
          path: `/preference/${category}`,
        })
        .catch((err) => {
          logger.log(err)
        })
    },
  },
}
</script>
