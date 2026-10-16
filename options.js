import { allocateDnrId, normalizeRule, preview } from "./lib/rules.js";
import { loadState, saveRules, setPaused } from "./lib/storage.js";

const HINTS = {
  redirect: {
    exact: "The full URL must match exactly, including the scheme and path.",
    wildcard: "Matched against the full URL. * is any sequence, ? is one character. A literal question mark belongs in a regex rule.",
    regex: "RE2 regex against the full URL. Use \\1 in the destination to insert a capture group.",
  },
  domain: {
    exact: "Matches this host and its subdomains. Only the host changes; path and query stay.",
    wildcard: "Glob against the hostname only. *.reddit.com matches www.reddit.com and not reddit.com.",
    regex: "RE2 regex against the full URL. When it matches, the host is replaced.",
  },
  block: {
    url: {
      exact: "The full URL must match exactly. The tab opens Lane’s blocked page.",
      wildcard: "Matched against the full URL. * is any sequence, ? is one character.",
      regex: "RE2 regex against the full URL. A match opens Lane’s blocked page.",
    },
    domain: {
      exact: "Matches this host and its subdomains. The tab opens Lane’s blocked page.",
      wildcard: "Glob against the hostname only. *.reddit.com blocks www.reddit.com and not reddit.com.",
      regex: "RE2 regex against the full URL. A match opens Lane’s blocked page.",
    },
  },
};

const PLACEHOLDERS = {
  redirect: {
    exact: "https://example.com/old",
    wildcard: "https://example.com/old/*",
    regex: "^https://example\\.com/old/(.*)",
  },
  domain: {
    exact: "twitter.com",
    wildcard: "*.reddit.com",
    regex: "^https://old\\.reddit\\.com",
  },
  block: {
    url: {
      exact: "https://example.com/distraction",
      wildcard: "https://example.com/distraction*",
      regex: "example\\.com/distraction",
    },
    domain: {
      exact: "reddit.com",
      wildcard: "*.reddit.com",
      regex: "^https?://([^/]+\\.)?reddit\\.com",
    },
  },
};

const DESTINATION_PLACEHOLDERS = {
  redirect: {
    exact: "https://example.com/new",
    wildcard: "https://example.com/new",
    regex: "https://example.com/new/\\1",
  },
  domain: {
    exact: "x.com",
    wildcard: "oldreddit.example",
    regex: "reddit.com",
  },
};

const PATTERN_LABEL = { redirect: "URL", domain: "Domain", block: "URL to block" };
const SCOPE_LABEL = { url: "Page", domain: "Domain" };
const DESTINATION_LABEL = { redirect: "Send to", domain: "New domain" };
const TYPE_LABEL = { redirect: "Redirect", domain: "Domain", block: "Block" };
const MATCH_LABEL = { exact: "Exact", wildcard: "Wildcard", regex: "Regex" };

const form = document.querySelector("#rule-form");
const pauseButton = document.querySelector("#pause");
const list = document.querySelector("#list");
const probe = document.querySelector("#probe");
const probeResult = document.querySelector("#probe-result");
const formError = document.querySelector("#form-error");
const cancelButton = document.querySelector("#cancel");
const saveButton = document.querySelector("#save");
const sheet = document.querySelector(".sheet");

let state = { rules: [], paused: false, nextDnrId: 1, ruleErrors: {} };
let editingId = null;
let pendingDeleteId = null;
let refreshToken = 0;

form.addEventListener("change", syncForm);
form.addEventListener("input", clearFormError);
form.addEventListener("submit", onSubmit);
cancelButton.addEventListener("click", resetForm);
pauseButton.addEventListener("click", () => setPaused(!state.paused));
probe.addEventListener("input", renderProbe);
list.addEventListener("click", onListClick);
list.addEventListener("change", onListChange);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && editingId) resetForm();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  refresh();
});

syncForm();
refresh();

async function refresh() {
  const token = ++refreshToken;
  const next = await loadState();
  if (token !== refreshToken) return;
  state = next;
  if (editingId && !state.rules.some((rule) => rule.id === editingId)) resetForm();
  renderPause();
  renderBlockTotal();
  renderList();
  renderProbe();
}

function renderBlockTotal() {
  const total = state.blockCounts?.total || 0;
  const node = document.querySelector("#block-total");
  node.replaceChildren(document.createTextNode("Blocked "), el("strong", "", total.toLocaleString()), document.createTextNode(total === 1 ? " time" : " times"));
}

function renderPause() {
  const paused = state.paused;
  sheet.classList.toggle("is-paused", paused);
  pauseButton.setAttribute("aria-pressed", String(paused));
  document.querySelector("#pause-kicker").textContent = paused ? "Off" : "On";
  document.querySelector("#pause-title").textContent = paused ? "Paused" : "Rules are live";
  document.querySelector("#pause-detail").textContent = paused
    ? "Your rules are saved. Nothing is redirected or blocked."
    : "Matching pages change on the next navigation.";
  document.querySelector("#pause-verb").textContent = paused ? "Resume" : "Pause";
}

function renderList() {
  list.replaceChildren();
  document.querySelector("#list-title").textContent = state.rules.length
    ? `Rules · ${state.rules.length}`
    : "Rules";

  if (!state.rules.length) {
    list.append(el("li", "empty", "No rules yet. Add one above and it will apply to the next navigation."));
    return;
  }

  state.rules.forEach((rule, index) => {
    const item = el("li", rule.enabled ? "rule" : "rule is-off");
    item.dataset.id = rule.id;

    const indexNode = el("span", "rule-index", String(index + 1).padStart(2, "0"));
    const body = el("div", "rule-body");
    const kicker = el("div", "rule-kicker");
    kicker.append(
      el("span", `stamp stamp-${rule.type}`, TYPE_LABEL[rule.type]),
      el("span", "match", MATCH_LABEL[rule.match]),
    );
    if (rule.type === "block") {
      kicker.append(el("span", "match", SCOPE_LABEL[rule.scope === "domain" ? "domain" : "url"]));
    }
    if (rule.name) kicker.append(el("span", "rule-name", rule.name));
    body.append(kicker, el("p", "pattern", rule.pattern));
    if (rule.type !== "block") body.append(el("p", "goes", `→ ${rule.destination}`));

    const error = state.ruleErrors?.[rule.id];
    if (error) body.append(el("p", "rule-error", error));

    const actions = el("div", "rule-actions");
    actions.append(toggle(rule), actionButton(rule, "up", "Up", index === 0));
    actions.append(actionButton(rule, "down", "Down", index === state.rules.length - 1));
    actions.append(actionButton(rule, "edit", "Edit", false));
    const deleting = pendingDeleteId === rule.id;
    actions.append(actionButton(rule, "delete", deleting ? "Confirm" : "Delete", false, deleting));

    item.append(indexNode, body, actions);
    list.append(item);
  });
}

function renderProbe() {
  const value = probe.value.trim();
  if (!value) {
    probeResult.dataset.status = "idle";
    probeResult.textContent = "Type a URL to see which rule wins.";
    return;
  }
  const result = preview(state.rules, value, { paused: state.paused });
  probeResult.dataset.status = result.status;
  probeResult.textContent = result.summary;
}

function syncForm() {
  const type = selected("type");
  const match = selected("match");
  const scope = type === "block" ? selected("scope") : "url";
  document.querySelector("#scope-field").hidden = type !== "block";
  document.querySelector("#pattern-label").textContent = type === "block" && scope === "domain"
    ? "Domain"
    : PATTERN_LABEL[type];
  document.querySelector("#hint").textContent = type === "block" ? HINTS.block[scope][match] : HINTS[type][match];
  document.querySelector("#pattern").placeholder = type === "block"
    ? PLACEHOLDERS.block[scope][match]
    : PLACEHOLDERS[type][match];
  const destinationField = document.querySelector("#destination-field");
  destinationField.hidden = type === "block";
  if (type !== "block") {
    document.querySelector("#destination-label").textContent = DESTINATION_LABEL[type];
    document.querySelector("#destination").placeholder = DESTINATION_PLACEHOLDERS[type][match];
  }
}

async function onSubmit(event) {
  event.preventDefault();
  clearFormError();
  const type = selected("type");
  const result = normalizeRule({
    type,
    match: selected("match"),
    pattern: document.querySelector("#pattern").value,
    destination: type === "block" ? "" : document.querySelector("#destination").value,
    name: document.querySelector("#rule-name").value,
    scope: type === "block" ? selected("scope") : "url",
  });
  if (!result.ok) {
    showFormError(result.error);
    return;
  }

  try {
    if (editingId) {
      const rules = state.rules.map((rule) => (
        rule.id === editingId ? { ...rule, ...result.rule } : rule
      ));
      await saveRules(rules, state.nextDnrId);
      resetForm();
      return;
    }

    const dnrId = allocateDnrId(state.rules, state.nextDnrId);
    const created = {
      id: crypto.randomUUID(),
      dnrId,
      enabled: true,
      ...result.rule,
    };
    await saveRules([...state.rules, created], dnrId + 1);
    resetForm();
    document.querySelector("#pattern").focus();
  } catch (error) {
    showFormError(error?.message || "Could not save this rule.");
  }
}

function onListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = button.closest("[data-id]").dataset.id;
  const action = button.dataset.action;
  if (action === "edit") {
    pendingDeleteId = null;
    startEdit(id);
    return;
  }
  if (action === "delete") {
    if (pendingDeleteId !== id) {
      pendingDeleteId = id;
      renderList();
      return;
    }
    pendingDeleteId = null;
    if (editingId === id) resetForm();
    saveRules(state.rules.filter((rule) => rule.id !== id), state.nextDnrId);
    return;
  }
  pendingDeleteId = null;
  const index = state.rules.findIndex((rule) => rule.id === id);
  const next = action === "up" ? index - 1 : index + 1;
  if (next < 0 || next >= state.rules.length) return;
  const rules = state.rules.slice();
  [rules[index], rules[next]] = [rules[next], rules[index]];
  saveRules(rules, state.nextDnrId);
}

function onListChange(event) {
  const input = event.target.closest("input[data-action='toggle']");
  if (!input) return;
  const id = input.closest("[data-id]").dataset.id;
  const rules = state.rules.map((rule) => (
    rule.id === id ? { ...rule, enabled: input.checked } : rule
  ));
  saveRules(rules, state.nextDnrId);
}

function startEdit(id) {
  const rule = state.rules.find((item) => item.id === id);
  if (!rule) return;
  editingId = id;
  document.querySelector("#rule-name").value = rule.name || "";
  form.querySelector(`input[name="type"][value="${rule.type}"]`).checked = true;
  form.querySelector(`input[name="match"][value="${rule.match}"]`).checked = true;
  form.querySelector(`input[name="scope"][value="${rule.scope === "domain" ? "domain" : "url"}"]`).checked = true;
  document.querySelector("#pattern").value = rule.pattern;
  document.querySelector("#destination").value = rule.destination || "";
  document.querySelector("#editor-title").textContent = "Edit rule";
  saveButton.textContent = "Save changes";
  cancelButton.hidden = false;
  clearFormError();
  syncForm();
  document.querySelector("#editor").scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm() {
  editingId = null;
  form.reset();
  document.querySelector("#editor-title").textContent = "New rule";
  saveButton.textContent = "Add rule";
  cancelButton.hidden = true;
  clearFormError();
  syncForm();
}

function showFormError(message) {
  formError.hidden = false;
  formError.textContent = message;
}

function clearFormError() {
  formError.hidden = true;
  formError.textContent = "";
}

function selected(name) {
  return form.querySelector(`input[name="${name}"]:checked`).value;
}

function toggle(rule) {
  const label = el("label", "switch");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = rule.enabled;
  input.dataset.action = "toggle";
  input.setAttribute("aria-label", rule.enabled ? "Disable rule" : "Enable rule");
  label.append(input, el("span", "track"));
  return label;
}

function actionButton(rule, action, text, disabled, danger = false) {
  const button = el("button", danger ? "text-button danger" : "text-button", text);
  button.type = "button";
  button.dataset.action = action;
  button.disabled = disabled;
  const label = rule.name || rule.pattern;
  button.setAttribute("aria-label", `${text} ${label}`);
  return button;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
