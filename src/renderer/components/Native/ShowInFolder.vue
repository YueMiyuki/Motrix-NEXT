<template>
  <i @click.stop="onFolderClick">
    <Folder :size="10" />
  </i>
</template>

<script lang="ts">
import { Folder } from 'lucide-vue-next'
import { showItemInFolder } from '@/utils/native'

export default {
  name: 'mo-show-in-folder',
  components: {
    Folder,
  },
  props: {
    path: {
      type: String,
    },
  },
  computed: {},
  methods: {
    onFolderClick() {
      if (!this.path) {
        return
      }
      showItemInFolder(this.path, {
        errorMsg: this.$t('task.file-not-exist'),
      })
    },
  },
}
</script>
