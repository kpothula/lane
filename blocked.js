import { blockedTarget } from "./lib/blocks.js";

const shown = blockedTarget(location.hash);
const slot = document.querySelector("#url");

slot.textContent = shown || "The address was not included with this block.";

if (shown) {
  chrome.runtime.sendMessage({ type: "block-hit", url: shown }).catch(() => {});
}

document.querySelector("#open").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
