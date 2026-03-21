<template>
  <Dialog :open="visible" @update:open="handleDialogOpenChange">
    <DialogContent class="app-about-dialog" :show-close-button="true">
      <mo-app-info :version="version" :engine="engineInfo" />
      <DialogFooter>
        <mo-copyright />
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script lang="ts">
import { useAppStore } from '@/store/app'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import AppInfo from '@/components/About/AppInfo.vue'
import Copyright from '@/components/About/Copyright.vue'
import { getVersion } from '@tauri-apps/api/app'

export default {
  name: 'mo-about-panel',
  components: {
    Dialog,
    DialogContent,
    DialogFooter,
    [AppInfo.name]: AppInfo,
    [Copyright.name]: Copyright,
  },
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      version: '',
    }
  },
  async created() {
    try {
      this.version = await getVersion()
    } catch {
      this.version = ''
    }
  },
  computed: {
    engineInfo() {
      return useAppStore().engineInfo
    },
  },
  watch: {
    visible(val) {
      if (val) {
        this.handleOpen()
      }
    },
  },
  methods: {
    handleOpen() {
      useAppStore().fetchEngineInfo()
    },
    handleDialogOpenChange(open) {
      if (!open) {
        this.handleClose()
      }
    },
    handleClose() {
      useAppStore().hideAboutPanel()
    },
  },
}
</script>
