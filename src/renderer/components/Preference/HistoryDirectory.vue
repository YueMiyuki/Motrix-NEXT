<template>
  <div class="mo-history-directory">
    <Popover>
      <PopoverTrigger as-child>
        <ui-button size="sm" variant="ghost" class="history-button">
          <History :size="14" />
        </ui-button>
      </PopoverTrigger>
      <PopoverContent
        :style="{ width: width + 'px' }"
        class="mo-directory-popper"
        side="bottom"
        align="start"
      >
        <div class="mo-directory-empty" v-if="empty">
          {{ $t('task.no-task') }}
        </div>
        <ul class="mo-directory-list" v-if="favoriteDirectories.length > 0">
          <li
            v-for="directory in favoriteDirectories"
            :key="directory"
            @click.stop="() => handleSelectItem(directory)"
          >
            <span class="mo-directory-path" :title="directory">{{ directory }}</span>
            <span class="mo-directory-actions">
              <Star
                :size="18"
                class="history-icon icon-history-favorited"
                @click.stop="() => handleCancelFavoriteItem(directory)"
              />
              <Trash2
                :size="18"
                class="history-icon icon-history-remove"
                @click.stop="() => handleRemoveItem(directory)"
              />
            </span>
          </li>
        </ul>
        <div class="mo-directory-divider" v-if="showDivider" />
        <ul class="mo-directory-list" v-if="historyDirectories.length > 0">
          <li
            v-for="directory in historyDirectories"
            :key="directory"
            @click.stop="() => handleSelectItem(directory)"
          >
            <span class="mo-directory-path" :title="directory">{{ directory }}</span>
            <span class="mo-directory-actions">
              <StarOff
                v-if="showFavoriteAction"
                :size="18"
                class="history-icon icon-history-favorite"
                @click.stop="() => handleFavoriteItem(directory)"
              />
              <Trash2
                :size="18"
                class="history-icon icon-history-remove"
                @click.stop="() => handleRemoveItem(directory)"
              />
            </span>
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  </div>
</template>

<script lang="ts">
import logger from '@shared/utils/logger'
import { History, Star, StarOff, Trash2 } from 'lucide-vue-next'
import UiButton from '@/components/ui/compat/UiButton.vue'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { usePreferenceStore } from '@/store/preference'
import { MAX_NUM_OF_DIRECTORIES } from '@shared/constants'
import { cloneArray } from '@shared/utils'

export default {
  name: 'mo-history-directory',
  components: {
    [UiButton.name]: UiButton,
    Popover,
    PopoverContent,
    PopoverTrigger,
    History,
    Star,
    StarOff,
    Trash2,
  },
  props: {
    width: {
      type: Number,
      default: 360,
    },
  },
  data() {
    return {
      visible: false,
    }
  },
  computed: {
    historyDirectories() {
      return cloneArray((usePreferenceStore().config as any).historyDirectories, true)
    },
    favoriteDirectories() {
      return cloneArray((usePreferenceStore().config as any).favoriteDirectories, true)
    },
    empty() {
      const { favoriteDirectories, historyDirectories } = this
      return favoriteDirectories.length + historyDirectories.length === 0
    },
    popoverDisabled() {
      const { favoriteDirectories, historyDirectories } = this
      return favoriteDirectories.length === 0 && historyDirectories.length === 0
    },
    showDivider() {
      const { favoriteDirectories, historyDirectories } = this
      return favoriteDirectories.length > 0 && historyDirectories.length > 0
    },
    showFavoriteAction() {
      const { favoriteDirectories } = this
      return favoriteDirectories.length < MAX_NUM_OF_DIRECTORIES
    },
  },
  methods: {
    handleSelectItem(directory) {
      this.$emit('selected', directory.trim())
      this.visible = false
    },
    handleFavoriteItem(directory) {
      logger.log('handleFavoriteItem==>', directory)
      usePreferenceStore().favoriteDirectory(directory)
    },
    handleCancelFavoriteItem(directory) {
      logger.log('handleCancelFavoriteItem==>', directory)
      usePreferenceStore().cancelFavoriteDirectory(directory)
    },
    handleRemoveItem(directory) {
      logger.log('handleRemoveItem==>', directory)
      usePreferenceStore().removeDirectory(directory)
    },
  },
}
</script>
