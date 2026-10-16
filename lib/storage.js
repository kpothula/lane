import { EMPTY_COUNTS, normalizeCounts } from "./blocks.js";

export const EMPTY_STATE = {
  rules: [],
  paused: false,
  nextDnrId: 1,
  ruleErrors: {},
  blockCounts: EMPTY_COUNTS,
};

export async function loadState() {
  const stored = await chrome.storage.local.get(EMPTY_STATE);
  return {
    rules: Array.isArray(stored.rules) ? stored.rules : [],
    paused: Boolean(stored.paused),
    nextDnrId: Number.isInteger(stored.nextDnrId) && stored.nextDnrId > 0 ? stored.nextDnrId : 1,
    ruleErrors: stored.ruleErrors && typeof stored.ruleErrors === "object" ? stored.ruleErrors : {},
    blockCounts: normalizeCounts(stored.blockCounts),
  };
}

export async function saveBlockCounts(blockCounts) {
  await chrome.storage.local.set({ blockCounts });
}

export async function saveRules(rules, nextDnrId) {
  await chrome.storage.local.set({ rules, nextDnrId });
}

export async function setPaused(paused) {
  await chrome.storage.local.set({ paused: Boolean(paused) });
}

export async function setRuleErrors(ruleErrors) {
  await chrome.storage.local.set({ ruleErrors });
}
