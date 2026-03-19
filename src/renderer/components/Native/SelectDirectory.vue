<template>
  <ui-button
    variant="ghost"
    size="sm"
    class="select-directory"
    @click.stop="onFolderClick"
  >
    <Folder :size="14" />
  </ui-button>
</template>

<script lang="ts">
import { dialog } from "@electron/remote";
import { Folder } from "lucide-vue-next";
import UiButton from "@/components/ui/compat/UiButton.vue";

export default {
  name: "mo-select-directory",
  components: {
    [UiButton.name]: UiButton,
    Folder,
  },
  props: {},
  methods: {
    onFolderClick() {
      const self = this;
      dialog
        .showOpenDialog({
          properties: ["openDirectory", "createDirectory"],
        })
        .then(({ canceled, filePaths }) => {
          if (canceled || filePaths.length === 0) {
            return;
          }

          const [path] = filePaths;
          self.$emit("selected", path);
        });
    },
  },
};
</script>
