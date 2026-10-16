import { compileRule } from "./rules.js";

const ACTIVE_BADGE = "#0F766E";
const PAUSED_BADGE = "#71717A";

export async function applyRules(state) {
  const extensionId = chrome.runtime.id;
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((rule) => rule.id);
  const errors = {};

  if (state.paused) {
    await replaceRules(removeRuleIds, []);
    await setBadge(state);
    return errors;
  }

  const ready = [];
  state.rules.forEach((rule, index) => {
    if (!rule.enabled) return;
    try {
      ready.push({
        ruleId: rule.id,
        dnr: compileRule(rule, {
          priority: state.rules.length - index,
          extensionId,
        }),
      });
    } catch (error) {
      errors[rule.id] = error.message || String(error);
    }
  });

  try {
    await replaceRules(removeRuleIds, ready.map((item) => item.dnr));
  } catch {
    await replaceRules(removeRuleIds, []);
    for (const item of ready) {
      try {
        await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [item.dnr] });
      } catch (error) {
        errors[item.ruleId] = error?.message || String(error);
      }
    }
  }

  await setBadge(state);
  return errors;
}

async function replaceRules(removeRuleIds, addRules) {
  if (!removeRuleIds.length && !addRules.length) return;
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
}

async function setBadge(state) {
  if (state.paused) {
    await chrome.action.setBadgeText({ text: "OFF" });
    await chrome.action.setBadgeBackgroundColor({ color: PAUSED_BADGE });
    await chrome.action.setTitle({ title: "Lane — paused" });
    return;
  }

  const live = state.rules.filter((rule) => rule.enabled).length;
  await chrome.action.setBadgeText({ text: live ? String(Math.min(live, 999)) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: ACTIVE_BADGE });
  await chrome.action.setTitle({ title: live ? `Lane — ${live} live` : "Lane" });
}
