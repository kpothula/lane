import { applyRules } from "./lib/apply.js";
import { pageCount, recordHit } from "./lib/blocks.js";
import { loadState, saveBlockCounts, setRuleErrors } from "./lib/storage.js";

let running = false;
let queued = false;

async function sync() {
  if (running) {
    queued = true;
    return;
  }

  running = true;
  try {
    do {
      queued = false;
      try {
        const state = await loadState();
        const errors = await applyRules(state);
        await setRuleErrors(errors);
      } catch (error) {
        console.error("Lane could not apply rules", error);
      }
    } while (queued);
  } finally {
    running = false;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  sync();
});

chrome.runtime.onStartup.addListener(() => {
  sync();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (!changes.rules && !changes.paused) return;
  sync();
});

let recording = Promise.resolve();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "block-hit") return;
  recording = recording
    .then(() => noteBlock(message.url))
    .then((counts) => sendResponse({
      total: counts.total,
      page: pageCount(counts, message.url),
    }))
    .catch((error) => sendResponse({ error: error?.message || String(error) }));
  return true;
});

async function noteBlock(url) {
  const state = await loadState();
  const blockCounts = recordHit(state.blockCounts, url);
  await saveBlockCounts(blockCounts);
  return blockCounts;
}
