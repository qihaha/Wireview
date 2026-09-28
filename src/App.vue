<script setup>
import { onBeforeUnmount, onMounted } from "vue";
import IconRibbon from "./components/IconRibbon.vue";
import DisplayFilter from "./components/DisplayFilter.vue";
import DefaultLayout from "./components/layouts/DefaultLayout.vue";
import PacketList from "./components/panes/PacketList.vue";
import PacketBytes from "./components/panes/PacketBytes.vue";
import PacketDetails from "./components/panes/PacketDetails.vue";
import StatusBar from "./components/StatusBar.vue";
import { manager } from "./globals";
import Welcome from "./components/Welcome.vue";
import FindFrameBar from "./components/FindFrameBar.vue";
onMounted(() => {
  manager.initialize();

  const params = new URLSearchParams(window.location.search);
  const fileUrl = params.get("file");
  if (fileUrl) {
    manager.openFileFromUrl(fileUrl);
  }
});

onBeforeUnmount(() => {
  manager.deinitialize();
});
</script>

<template>
  <IconRibbon />
  <DisplayFilter />
  <Welcome v-if="manager.sessionInfo === null" />
  <template v-else>
    <FindFrameBar v-show="!manager.findFrameBarHidden" />
    <DefaultLayout
      :style="{
        '--ws-row-height': manager.rowHeight + 'px',
        '--ws-font-size-monospace': manager.fontSize + 'px',
      }"
    >
      <template #slot1>
        <PacketList />
      </template>
      <template #slot2>
        <PacketDetails />
      </template>
      <template #slot3>
        <PacketBytes />
      </template>
    </DefaultLayout>
  </template>
  <StatusBar />
</template>
