<template>
  <div v-if="task">
    <div class="tracker-list" v-if="announceList">
      <Textarea readonly :model-value="announceList" />
    </div>
  </div>
</template>

<script lang="ts">
import is from '@/shims/platform'
import { Textarea } from '@/components/ui/textarea'
import { checkTaskIsBT, checkTaskIsSeeder } from '@shared/utils'
import { convertTrackerDataToLine } from '@shared/utils/tracker'
import { EMPTY_STRING } from '@shared/constants'

export default {
  name: 'mo-task-trackers',
  components: {
    Textarea,
  },
  props: {
    task: {
      type: Object,
    },
  },
  computed: {
    isRenderer: () => is.renderer(),
    isBT() {
      return checkTaskIsBT(this.task)
    },
    isSeeder() {
      return checkTaskIsSeeder(this.task)
    },
    announceList() {
      if (!this.isBT) {
        return EMPTY_STRING
      }

      const { bittorrent } = this.task
      const data = bittorrent.announceList.map((i: any) => i[0])
      return convertTrackerDataToLine(data)
    },
  },
}
</script>
