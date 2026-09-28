<script setup>
import { computed, reactive } from "vue";
import PcapFileInput from "../PcapFileInput.vue";
import { manager } from "../globals";

const state = reactive({
  downloadingExample: false,

  // computed
  statusText: null,
});

const loadDemo = (event) => {
  if (state.downloadingExample) return;
  state.downloadingExample = true;
  fetch(event.target.href)
    .then((response) => response.arrayBuffer())
    .then((buffer) => {
      state.downloadingExample = false;
      const file = new File([buffer], "shark1.pcapng");
      manager.openFile(file);
    });
};

state.statusText = computed(() => {
  if (state.downloadingExample) return "Please wait: downloading example...";
  if (manager.loadingFromUrl) return "Please wait: downloading file from URL...";
  if (manager.activeFile) return "Please wait: opening file...";

  if (manager.lastFileOpenError) {
    const { error, filename } = manager.lastFileOpenError;
    return `Error loading file ${filename}: ${error}`;
  }

  return null;
});
</script>

<template>
  <div class="welcome-container-wrap">
    <div class="welcome-container">
      <div class="welcome-bubble">Welcome to Wireview</div>

      <section>
        <h2>About</h2>
        <p>
          Use Wireview to open and view packet capture files (.pcap, .pcapng,
          etc) on the web. Wireview is built with Vue.js and powered by
          Wireshark compiled to WebAssembly.
        </p>
        <p>
          All operations are done on the browser and no data is uploaded to any
          server.
        </p>
        <p>
          <a
            href="https://github.com/radiantly/Wireview"
            target="_blank"
            class="muted"
            >View the project source on GitHub.</a
          >
          Made possible by the
          <a
            href="https://github.com/good-tools/wiregasm"
            target="_blank"
            class="muted"
            >Wiregasm</a
          >
          and
          <a href="https://www.wireshark.org/" target="_blank" class="muted"
            >Wireshark</a
          >
          projects.
        </p>
      </section>
      <section>
        <h2>Open</h2>
        <p v-if="manager.initialized">
          Load successful. Select a file or
          <a href="/shark1.pcapng" @click.prevent="loadDemo"
            >try out an example</a
          >.
        </p>
        <p v-else>Please wait, loading WASM binary...</p>
        <label>
          <PcapFileInput />
        </label>
        <p>
          {{ state.statusText }}
        </p>
      </section>
    </div>
  </div>
</template>
<style scoped>
p {
  max-width: 80ch;
}
h2 {
  color: #888;
  margin: 0;
}
section {
  display: flex;
  flex-direction: column;
}
a.muted {
  color: inherit;
  text-decoration: underline dotted;
}
a.muted:hover {
  opacity: 0.75;
  text-decoration: underline solid;
}
.welcome-container-wrap {
  flex-grow: 1;

  display: flex;
  justify-content: center;
  background-color: white;
  line-height: 1.5;
  color: #111;
}
.welcome-container {
  width: 80vw;
  padding: 4vh 0;

  display: flex;
  flex-direction: column;
  gap: 4vh;
}
.welcome-bubble {
  align-self: flex-start;
  background-color: var(--ws-nice-blue);
  padding: 6px 9px;
  border-radius: 5px;
}
</style>
