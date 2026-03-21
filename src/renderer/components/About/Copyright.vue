<template>
  <ui-row class="copyright">
    <ui-col :span="6" class="copyright-left">
      <a target="_blank" rel="noopener noreferrer" href="https://motrix.app/">
        &copy;{{ year }} Motrix
      </a>
    </ui-col>
    <ui-col :span="18" class="copyright-right">
      <a target="_blank" rel="noopener noreferrer" href="https://motrix.app/license">
        {{ $t('about.license') }}
      </a>
      <a target="_blank" rel="noopener noreferrer" href="https://motrix.app/about">
        {{ $t('about.about') }}
      </a>
      <a target="_blank" rel="noopener noreferrer" href="https://motrix.app/support">
        {{ $t('about.support') }}
      </a>
      <a target="_blank" rel="noopener noreferrer" href="https://motrix.app/release">
        {{ $t('about.release') }}
      </a>
    </ui-col>
  </ui-row>
</template>

<script lang="ts">
export default {
  name: 'mo-copyright',
  data() {
    const year = new Date().getFullYear()
    return {
      year,
    }
  },
}
</script>
