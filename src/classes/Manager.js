import { computed, reactive, shallowReactive, watch } from "vue";
import { calculateFontSize, clamp } from "../util";
import Bridge from "./Bridge";
import FrameDetailsTree from "./FrameDetailsTree";

class Manager {
  #core;
  #state;
  #shallowState;

  constructor() {
    this.#core = {
      bridge: new Bridge(),
      checkFilterCache: new Map(),
    };
    this.#state = reactive({
      rowHeight: 14, // TODO: Originally I thought we'd manipulate this to change text size, but in-browser zoom seems to work fine for this
      activeFrameIndex: null,
      displayFilter: "",
      findFrameBarHidden: true,

      // computed
      fontSize: 0,
      activeFrameNumber: null,
      packetCount: 0,
      frameCount: 0,
      canOpenFile: false,
    });
    this.#shallowState = shallowReactive({
      activeFrameDetails: null,
      activeFieldInfo: null,
      sessionInfo: null,
      filteredFrames: null,
      filteredFramesRequest: null,
      activeFile: null,
      lastFileOpenError: false,
      loadingFromUrl: false,
    });
    this.#state.fontSize = computed(() =>
      calculateFontSize(this.#state.rowHeight)
    );
    this.#state.activeFrameNumber = computed(() => {
      const index = this.#state.activeFrameIndex;
      if (index === null) return null;
      return this.#shallowState.filteredFrames?.[index]?.number ?? index + 1;
    });
    this.#state.packetCount = computed(
      () => this.#shallowState.sessionInfo?.packet_count ?? 0
    );
    this.#state.frameCount = computed(
      () => this.#shallowState.filteredFrames?.length ?? this.#state.packetCount
    );
    this.#state.canOpenFile = computed(
      () =>
        this.#core.bridge.initialized &&
        (!this.#shallowState.activeFile || this.#shallowState.sessionInfo)
    );
    watch(
      () => this.#state.displayFilter,
      async (filter) => {
        if (this.#shallowState.sessionInfo === null) return;

        // get currently active frame
        const frameNumber =
          this.#shallowState.filteredFramesRequest?.frameNumber ??
          this.#state.activeFrameNumber;

        if (filter === "") {
          this.#shallowState.filteredFrames = null;
          this.#shallowState.filteredFramesRequest = null;
          if (frameNumber) this.#state.activeFrameIndex = frameNumber - 1;
          return;
        }

        this.#shallowState.filteredFrames = [];
        this.#shallowState.filteredFramesRequest = {
          promise: this.#core.bridge.getFrames(filter, 0, 0),
          frameNumber,
        };
        const frames = await this.#shallowState.filteredFramesRequest.promise;

        // the display filter may have changed while awaiting
        if (filter !== this.#state.displayFilter) return;

        this.#shallowState.filteredFrames = frames;
        this.#shallowState.filteredFramesRequest.frameNumber = null;
        this.#state.activeFrameIndex =
          this.#getFrameIndex(frameNumber) ?? (frames.length ? 0 : null);
      }
    );

    // This watcher isn't a computed property because of the async request
    watch(
      () => this.#state.activeFrameNumber,
      async (frameNumber) => {
        if (frameNumber === null || frameNumber <= 0) {
          this.#shallowState.activeFrameDetails = null;
          return;
        }
        const rawFrameDetails = await this.#core.bridge.getFrame(frameNumber);
        this.#shallowState.activeFrameDetails = new FrameDetailsTree(
          rawFrameDetails
        );
      }
    );
  }

  get initialized() {
    return this.#core.bridge.initialized;
  }

  get columns() {
    return this.#core.bridge.columns;
  }

  get activeBridgeRequest() {
    return this.#core.bridge.activeRequest;
  }

  get rowHeight() {
    return this.#state.rowHeight;
  }

  get fontSize() {
    return this.#state.fontSize;
  }

  get displayFilter() {
    return this.#state.displayFilter;
  }

  async setDisplayFilter(filter) {
    const result = await this.checkFilter(filter);
    if (result.ok) this.#state.displayFilter = filter;
  }

  get activeFrameNumber() {
    return this.#state.activeFrameNumber;
  }

  get activeFrameIndex() {
    return this.#state.activeFrameIndex;
  }

  setActiveFrameIndex(index) {
    if (index < 0) index = this.#state.frameCount + index;
    this.#state.activeFrameIndex = index;
  }

  setActiveFrameNumber(number) {
    if (this.displayFilter == "") {
      this.#state.activeFrameIndex = number - 1;
      return;
    }

    const frames = this.#shallowState.filteredFrames;

    if (frames === null)
      return console.error("TODO: wait for filtered frames to load");

    const n = frames.length;
    if (n === 0) return;

    // binary search
    let i = 0;
    for (let jump = n; jump; jump >>= 1)
      while (i + jump < n && frames[i + jump].number <= number) i += jump;

    if (frames[i].number === number) this.#state.activeFrameIndex = i;
    else console.error("Could not find frame", number);
  }

  get packetCount() {
    return this.#state.packetCount;
  }

  get frameCount() {
    return this.#state.frameCount;
  }

  get findFrameBarHidden() {
    return this.#state.findFrameBarHidden;
  }

  get activeFile() {
    return this.#shallowState.activeFile;
  }

  get lastFileOpenError() {
    return this.#shallowState.lastFileOpenError;
  }

  get loadingFromUrl() {
    return this.#shallowState.loadingFromUrl;
  }

  get canOpenFile() {
    return this.#state.canOpenFile;
  }

  get sessionInfo() {
    return this.#shallowState.sessionInfo;
  }

  get activeFrameDetails() {
    return this.#shallowState.activeFrameDetails;
  }

  get activeFieldInfo() {
    return this.#shallowState.activeFieldInfo;
  }

  setActiveFieldInfo(field_info_ptr, range = null) {
    this.#shallowState.activeFieldInfo = { ptr: field_info_ptr, range };
  }

  get canGoToPreviousPacket() {
    if (this.#state.activeFrameIndex === null) return false;
    return this.#state.activeFrameIndex > 0;
  }

  get canGoToNextPacket() {
    if (this.#state.activeFrameIndex === null) return false;
    return this.#state.activeFrameIndex + 1 < this.#state.frameCount;
  }

  goToNearbyPacket(distance) {
    if (this.#state.activeFrameIndex === null) return;

    const minDistance = -this.#state.activeFrameIndex;
    const maxDistance =
      this.#state.frameCount - 1 - this.#state.activeFrameIndex;
    distance = clamp(minDistance, distance, maxDistance);
    this.#state.activeFrameIndex += distance;
  }

  initialize() {
    this.#core.bridge.initialize();

    // FOR DEBUG
    window.manager = this;
  }

  deinitialize() {
    this.#core.bridge.deinitialize();
  }

  async openFile(file) {
    if (this.#shallowState.activeFile) await this.closeFile();

    this.#shallowState.activeFile = file;
    const result = await this.#core.bridge.createSession(file);

    // handle error
    if (result.code) {
      this.#shallowState.lastFileOpenError = {
        ...result,
        filename: file.name,
      };
      this.#shallowState.activeFile = null;
      this.#core.bridge.closeSession();
      return;
    }

    this.#shallowState.sessionInfo = result.summary;
    this.#state.activeFrameIndex = result.summary.packet_count ? 0 : null;
  }

  async openFileFromUrl(url) {
    // Wait for the WASM bridge to be ready
    if (!this.canOpenFile) {
      await new Promise((resolve) => {
        const stop = watch(
          () => this.canOpenFile,
          (val) => {
            if (val) {
              stop();
              resolve();
            }
          }
        );
      });
    }

    // Extract filename from URL
    let filename;
    try {
      const pathname = new URL(url, window.location.href).pathname;
      filename = decodeURIComponent(pathname.split("/").pop()) || "download.pcap";
    } catch {
      filename = "download.pcap";
    }

    this.#shallowState.loadingFromUrl = true;
    this.#shallowState.lastFileOpenError = false;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      const file = new File([buffer], filename);
      await this.openFile(file);
    } catch (error) {
      this.#shallowState.lastFileOpenError = {
        code: -1,
        error: `Failed to download file: ${error.message}`,
        filename,
      };
    } finally {
      this.#shallowState.loadingFromUrl = false;
    }
  }

  async closeFile() {
    this.#state.activeFrameIndex = null;
    this.#shallowState.sessionInfo = null;
    this.#shallowState.lastFileOpenError = null;
    this.#shallowState.activeFile = null;
    await this.#core.bridge.closeSession();
  }

  // say you want n frames from the mth position
  // n = limit, m = skip
  // returns a frames array, where you should start reading from frames[offset]
  async getFrames(filter, skip, limit) {
    if (this.#shallowState.sessionInfo === null)
      return { frames: [], offset: 0 };

    if (
      filter === this.#state.displayFilter &&
      this.#shallowState.filteredFramesRequest
    ) {
      const frames = await this.#shallowState.filteredFramesRequest.promise;
      return { frames, offset: skip };
    }
    const frames = await this.#core.bridge.getFrames(filter, skip, limit);
    return { frames, offset: 0 };
  }

  async checkFilter(filter) {
    if (!this.#core.checkFilterCache.has(filter)) {
      const result = await this.#core.bridge.checkFilter(filter);
      this.#core.checkFilterCache.set(filter, result);
    }
    return this.#core.checkFilterCache.get(filter);
  }

  async findFrame(params) {
    return this.#core.bridge.findFrame(params);
  }

  // returns index of the largest frame that has a number smaller or equal to the passed frame number
  // returns null if it does not exist
  #getFrameIndex(frameNumber) {
    if (frameNumber === null) return null;

    const frames = this.#shallowState.filteredFrames;
    if (frames === null) return frameNumber ? frameNumber - 1 : null;

    // binary search, the way I like it
    let index = 0;
    for (let n = frames.length; n; n >>= 1)
      while (
        index + n < frames.length &&
        frames[index + n].number <= frameNumber
      )
        index += n;

    return index;
  }

  setFindFrameBarHidden(state) {
    this.#state.findFrameBarHidden = state ?? !this.#state.findFrameBarHidden;
  }
}

export default Manager;
