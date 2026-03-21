<template>
  <ui-button variant="ghost" size="sm" class="select-directory" @click.stop="onFolderClick">
    <Folder :size="14" />
  </ui-button>
</template>

<script lang="ts">
import { open } from '@tauri-apps/plugin-dialog'
import { Folder } from 'lucide-vue-next'
import UiButton from '@/components/ui/compat/UiButton.vue'

export default {
  name: 'mo-select-directory',
  components: {
    [UiButton.name]: UiButton,
    Folder,
  },
  props: {},
  methods: {
    async onFolderClick() {
      const selected = await open({
        directory: true,
        multiple: false,
      })

      if (selected) {
        this.$emit('selected', selected)
      }
    },
  },
}
</script>
