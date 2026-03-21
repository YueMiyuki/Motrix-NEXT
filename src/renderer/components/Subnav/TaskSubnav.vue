<template>
  <nav class="subnav-inner">
    <h3>{{ title }}</h3>
    <ul>
      <li
        @click="() => nav('active')"
        :class="[current === 'active' ? 'active' : '']"
        style="--stagger-index: 0"
      >
        <i class="subnav-icon">
          <Play :size="20" />
        </i>
        <span>{{ $t('task.active') }}</span>
      </li>
      <li
        @click="() => nav('waiting')"
        :class="[current === 'waiting' ? 'active' : '']"
        style="--stagger-index: 1"
      >
        <i class="subnav-icon">
          <Pause :size="20" />
        </i>
        <span>{{ $t('task.waiting') }}</span>
      </li>
      <li
        @click="() => nav('stopped')"
        :class="[current === 'stopped' ? 'active' : '']"
        style="--stagger-index: 2"
      >
        <i class="subnav-icon">
          <Square :size="20" />
        </i>
        <span>{{ $t('task.stopped') }}</span>
      </li>
    </ul>
  </nav>
</template>

<script lang="ts">
import logger from '@shared/utils/logger'
import { Pause, Play, Square } from 'lucide-vue-next'

export default {
  name: 'mo-task-subnav',
  components: {
    Pause,
    Play,
    Square,
  },
  props: {
    current: {
      type: String,
      default: 'active',
    },
  },
  computed: {
    title() {
      return this.$t('subnav.task-list')
    },
  },
  methods: {
    nav(status = 'active') {
      this.$router
        .push({
          path: `/task/${status}`,
        })
        .catch((err) => {
          logger.log(err)
        })
    },
  },
}
</script>
