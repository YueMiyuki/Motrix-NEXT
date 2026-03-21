<template>
  <div style="display: none"></div>
</template>

<script lang="ts">
import { useAppStore } from '@/store/app'
import { ADD_TASK_TYPE } from '@shared/constants'

export default {
  name: 'mo-dragger',
  mounted() {
    this.preventDefault = (ev) => ev.preventDefault()
    let count = 0
    this.onDragEnter = (ev) => {
      if (count === 0) {
        useAppStore().showAddTaskDialog(ADD_TASK_TYPE.TORRENT)
      }
      count++
    }

    this.onDragLeave = (ev) => {
      count--
      if (count === 0) {
        useAppStore().hideAddTaskDialog()
      }
    }

    this.onDrop = (ev) => {
      count = 0

      const fileList = [...ev.dataTransfer.files]
        .map((item) => ({ raw: item, name: item.name }))
        .filter((item) => /\.torrent$/.test(item.name))
      if (!fileList.length) {
        this.$msg.error(this.$t('task.select-torrent'))
      }
    }

    document.addEventListener('dragover', this.preventDefault)
    document.body.addEventListener('dragenter', this.onDragEnter)
    document.body.addEventListener('dragleave', this.onDragLeave)
    document.body.addEventListener('drop', this.onDrop)
  },
  beforeUnmount() {
    document.removeEventListener('dragover', this.preventDefault)
    document.body.removeEventListener('dragenter', this.onDragEnter)
    document.body.removeEventListener('dragleave', this.onDragLeave)
    document.body.removeEventListener('drop', this.onDrop)
  },
}
</script>
