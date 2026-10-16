import { blockedTarget, pageCount } from "./lib/blocks.js";
import { loadState, setPaused } from "./lib/storage.js";

const pauseButton = document.querySelector("#pause");
const openButton = document.querySelector("#open");

pauseButton.addEventListener("click", async () => {
  const state = await loadState();
  await setPaused(!state.paused);
});

openButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") render();
});

render();

async function render() {
  const state = await loadState();
  const enabled = state.rules.filter((rule) => rule.enabled);
  const counts = { redirect: 0, domain: 0, block: 0 };
  for (const rule of enabled) {
    if (counts[rule.type] != null) counts[rule.type] += 1;
  }

  document.body.classList.toggle("is-paused", state.paused);
  pauseButton.setAttribute("aria-pressed", String(state.paused));
  document.querySelector("#pause-label").textContent = state.paused ? "Paused" : "Rules are live";
  document.querySelector("#pause-verb").textContent = state.paused ? "Resume" : "Pause";
  document.querySelector("#count-redirect").textContent = String(counts.redirect);
  document.querySelector("#count-domain").textContent = String(counts.domain);
  document.querySelector("#count-block").textContent = String(counts.block);
  document.querySelector("#summary").textContent = summary(state.paused, enabled.length);
  await renderPageCount(state.blockCounts);
}

async function renderPageCount(blockCounts) {
  const url = await currentPageUrl();
  const count = pageCount(blockCounts, url);
  const urlNode = document.querySelector("#here-url");
  document.querySelector("#here-count").textContent = count.toLocaleString();
  document.querySelector("#here-noun").textContent = count === 1 ? "block" : "blocks";
  urlNode.textContent = url ? shortUrl(url) : "Open a page to see its count";
  urlNode.title = url;
}

async function currentPageUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return "";
  if (tab.url.startsWith(`chrome-extension://${chrome.runtime.id}/blocked.html`)) {
    return blockedTarget(new URL(tab.url).hash);
  }
  return tab.url;
}

function shortUrl(url) {
  try {
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search}`;
    return `${parsed.host}${path === "/" ? "" : path}`;
  } catch {
    return url;
  }
}

function summary(paused, total) {
  const noun = total === 1 ? "rule" : "rules";
  if (paused) return total ? `${total} saved ${noun} ${total === 1 ? "is" : "are"} paused.` : "Paused. No rules yet.";
  if (!total) return "No rules yet.";
  return `${total} ${noun} ${total === 1 ? "is" : "are"} live.`;
}
