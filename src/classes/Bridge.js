import { computed, reactive, shallowReactive } from "vue";
import SharkWorker from "../worker.js?no-inline&url";

const generateUUID = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

class Bridge {
  #core;
  #state;
  #shallowState;

  constructor() {
    this.#core = {
      worker: null,
      callbacks: new Map(),
    };

    this.#state = reactive({
      activeRequests: new Map(),

      // computed
      activeRequest: null,
      initialized: false,
      initializationError: "",
      columns: [],
    });

    this.#shallowState = shallowReactive({
      initializationResult: null,
    });

    this.#state.activeRequest = computed(
      () => this.#state.activeRequests.values().next().value ?? null
    );

    this.#state.initialized = computed(
      () => this.#shallowState.initializationResult?.success ?? false
    );
    this.#state.initializationError = computed(
      () => this.#shallowState.initializationResult?.error ?? "Unknown"
    );
    this.#state.columns = computed(
      () => this.#shallowState.initializationResult?.columns ?? []
    );
  }

  get initialized() {
    return this.#state.initialized;
  }

  get initializationError() {
    return this.#state.initializationError;
  }

  get columns() {
    return this.#state.columns;
  }

  get activeRequest() {
    return this.#state.activeRequest;
  }

  initialize() {
    this.#core.worker = new Worker(SharkWorker);
    this.#core.worker.addEventListener("message", (e) =>
      this.#processMessage(e)
    );
  }

  deinitialize() {
    this.#core.worker.terminate();
    this.#shallowState.initializationResult = null;
  }

  #processMessage({ data }) {
    const req = this.#state.activeRequests.get(data.id);
    if (req) {
      const timeTaken = Date.now() - req.timestamp;
      this.#state.activeRequests.delete(data.id);
      console.log(timeTaken + "ms", data);
    } else console.log(data);

    if (data.type === "init") this.#shallowState.initializationResult = data;

    this.#core.callbacks.get(data.id)?.(data);
    this.#core.callbacks.delete(data.id);
  }

  #postMessage(data) {
    data.id = generateUUID();
    const req = { timestamp: Date.now(), type: data.type };
    this.#state.activeRequests.set(data.id, req);
    const promise = new Promise((resolve) =>
      this.#core.callbacks.set(data.id, resolve)
    );
    this.#core.worker.postMessage(data);
    return promise;
  }

  async getFrame(number) {
    const { frame } = await this.#postMessage({
      type: "frame",
      number,
    });
    return frame;
  }

  async getFrames(filter, skip, limit) {
    const { frames } = await this.#postMessage({
      type: "frames",
      filter,
      skip,
      limit,
    });
    return frames;
  }

  async findFrame(params) {
    const { result } = await this.#postMessage({
      type: "find",
      params,
    });
    return result;
  }

  async checkFilter(filter) {
    const { result } = await this.#postMessage({
      type: "check-filter",
      filter,
    });
    return result;
  }

  async createSession(file) {
    const { result } = await this.#postMessage({ type: "open", file });
    return result;
  }

  async closeSession() {
    await this.#postMessage({ type: "close" });
  }
}

export default Bridge;
