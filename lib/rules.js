const TYPES = new Set(["redirect", "domain", "block"]);
const MATCHES = new Set(["exact", "wildcard", "regex"]);
const NAME_LIMIT = 80;

const LOOKAROUND = /\(\?(?:[=!]|<[=!])/;

export function normalizeRule(input) {
  const type = input?.type;
  const match = input?.match;
  if (!TYPES.has(type)) {
    return fail("Choose redirect, domain, or block.");
  }
  if (!MATCHES.has(match)) {
    return fail("Choose exact, wildcard, or regex.");
  }

  const name = String(input?.name ?? "").trim();
  if (name.length > NAME_LIMIT) {
    return fail(`Name must be ${NAME_LIMIT} characters or fewer.`);
  }

  const scope = type === "block" && input?.scope === "domain" ? "domain" : "url";
  const hostScoped = type === "domain" || scope === "domain";

  const rawPattern = String(input?.pattern ?? "").trim();
  if (!rawPattern) {
    return fail(hostScoped ? "Enter a domain." : "Enter a URL pattern.");
  }

  const chromeNote = unsupportedPattern(rawPattern, match);
  if (chromeNote) return fail(chromeNote);

  let pattern = rawPattern;
  if (hostScoped && match !== "regex") {
    const host = match === "exact" ? canonicalHost(rawPattern) : wildcardHost(rawPattern);
    if (!host.ok) return fail(host.error);
    pattern = host.value;
  } else if (match === "exact") {
    if (!isHttpUrl(rawPattern)) {
      return fail("Exact rules need a full http or https URL.");
    }
    pattern = rawPattern;
  } else if (match === "regex") {
    if (LOOKAROUND.test(rawPattern)) {
      return fail("Chrome uses RE2, which does not support lookahead or lookbehind.");
    }
    if (/(^|[^\\])\\[1-9]/.test(rawPattern)) {
      return fail("Chrome's RE2 engine does not support backreferences inside the pattern.");
    }
    if (!isCompilableRegex(rawPattern)) {
      return fail("This regex isn't valid.");
    }
  }

  let destination = "";
  if (type === "redirect") {
    destination = String(input?.destination ?? "").trim();
    if (!isHttpUrl(destination)) {
      return fail("Send the tab to a full http or https URL.");
    }
    if (match === "regex" && /\\[1-9]/.test(destination) && !hasCapturingGroup(pattern)) {
      return fail("The destination uses a capture group, but the pattern has none.");
    }
  } else if (type === "domain") {
    const host = canonicalHost(String(input?.destination ?? "").trim());
    if (!host.ok) {
      return fail(host.error === "Enter a hostname, like twitter.com, without a scheme or path."
        ? "Enter the new domain only, like x.com."
        : host.error);
    }
    destination = host.value;
  }

  const rule = { type, match, pattern, destination, name, scope };
  if (loops(rule)) {
    return fail("This destination matches the rule, so it would redirect forever.");
  }

  return { ok: true, rule };
}

export function allocateDnrId(rules, nextDnrId) {
  const max = (rules ?? []).reduce((highest, rule) => Math.max(highest, rule?.dnrId || 0), 0);
  const candidate = Number.isInteger(nextDnrId) && nextDnrId > 0 ? nextDnrId : 1;
  return Math.max(candidate, max + 1);
}

export function compileRule(rule, { priority, extensionId }) {
  if (!Number.isInteger(rule?.dnrId) || rule.dnrId < 1) {
    throw new Error("Rule is missing a network id.");
  }
  if (!Number.isInteger(priority) || priority < 1) {
    throw new Error("Rule priority must be a positive integer.");
  }

  return {
    id: rule.dnrId,
    priority,
    action: actionFor(rule, extensionId),
    condition: {
      regexFilter: regexFilterFor(rule),
      resourceTypes: ["main_frame"],
    },
  };
}

export function compileRules(rules, extensionId) {
  const compiled = [];
  rules.forEach((rule, index) => {
    if (!rule.enabled) return;
    compiled.push(compileRule(rule, {
      priority: rules.length - index,
      extensionId,
    }));
  });
  return compiled;
}

export function matches(rule, url) {
  let regexp;
  try {
    regexp = previewRegExp(regexFilterFor(rule));
  } catch {
    return false;
  }
  return regexp.test(url);
}

export function preview(rules, rawUrl, { paused = false } = {}) {
  if (paused) {
    return { status: "paused", rule: null, summary: "Paused. Nothing will change." };
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { status: "invalid", rule: null, summary: "Enter a full URL, including https://." };
  }

  if (isUnsupportedUrl(url)) {
    return {
      status: "unsupported",
      rule: null,
      summary: "Chrome does not let extensions change this page.",
    };
  }

  const href = String(rawUrl).trim();
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (!matches(rule, href)) continue;
    return { status: "match", rule, summary: describeEffect(rule, href) };
  }

  return { status: "none", rule: null, summary: "No enabled rule matches." };
}

function actionFor(rule, extensionId) {
  if (rule.type === "block") {
    return {
      type: "redirect",
      redirect: {
        regexSubstitution: `chrome-extension://${extensionId}/blocked.html#\\0`,
      },
    };
  }

  if (rule.type === "domain") {
    return {
      type: "redirect",
      redirect: { transform: { host: rule.destination } },
    };
  }

  if (/\\[0-9]/.test(rule.destination)) {
    return {
      type: "redirect",
      redirect: { regexSubstitution: rule.destination },
    };
  }

  return {
    type: "redirect",
    redirect: { url: rule.destination },
  };
}

function describeEffect(rule, url) {
  if (rule.type === "block") {
    const label = rule.name ? `“${rule.name}”` : "a block rule";
    return `Blocked by ${label}.`;
  }
  if (rule.type === "domain") {
    return `Domain becomes ${redirectTarget(rule, url)}.`;
  }
  return `Redirects to ${redirectTarget(rule, url)}.`;
}

function redirectTarget(rule, url) {
  if (rule.type === "domain") {
    const next = new URL(url);
    next.hostname = rule.destination;
    return next.toString();
  }
  if (!/\\[0-9]/.test(rule.destination)) return rule.destination;
  const match = previewRegExp(regexFilterFor(rule)).exec(url);
  if (!match) return rule.destination;
  return rule.destination.replace(/\\([0-9])/g, (_, digit) => match[Number(digit)] ?? "");
}

function loops(rule) {
  if (rule.type === "block") return false;
  if (rule.type === "redirect" && /\\[0-9]/.test(rule.destination)) return false;
  const probe = rule.type === "domain" ? `https://${rule.destination}/` : rule.destination;
  return matches(rule, probe);
}

function blocksDomain(rule) {
  return rule.type === "block" && rule.scope === "domain";
}

function regexFilterFor(rule) {
  if ((rule.type === "domain" || blocksDomain(rule)) && rule.match === "exact") {
    return `(?i)${exactDomainSource(rule.pattern)}`;
  }
  if ((rule.type === "domain" || blocksDomain(rule)) && rule.match === "wildcard") {
    return `(?i)^https?://${globBody(rule.pattern)}(?::\\d+)?(?:[/?#]|$)`;
  }
  if (rule.match === "exact") return `^${escapeRegex(rule.pattern)}$`;
  if (rule.match === "wildcard") return `^${globBody(rule.pattern)}$`;
  return rule.pattern;
}

function exactDomainSource(host) {
  const escaped = escapeRegex(host);
  if (isIp(host)) {
    return `^https?://${escaped}(?::\\d+)?(?:[/?#]|$)`;
  }
  return `^https?://(?:[^/?#]+\\.)*${escaped}(?::\\d+)?(?:[/?#]|$)`;
}

function globBody(glob) {
  let out = "";
  for (const char of glob) {
    if (char === "*") out += ".*";
    else if (char === "?") out += ".";
    else out += escapeRegex(char);
  }
  return out;
}

function escapeRegex(value) {
  return value.replace(/[\\^$*+?.()|[\]{}]/g, "\\$&");
}

function previewRegExp(filter) {
  let source = filter;
  let flags = "";
  if (source.startsWith("(?i)")) {
    source = source.slice(4);
    flags = "i";
  }
  return new RegExp(source, flags);
}

function canonicalHost(value) {
  if (!value) return fail("Enter a hostname, like twitter.com, without a scheme or path.");
  if (value.includes("://") || value.includes("/")) {
    return fail("Enter a hostname, like twitter.com, without a scheme or path.");
  }
  if (value.includes(":")) {
    return fail("Enter a hostname without a port.");
  }

  let url;
  try {
    url = new URL(`http://${value}`);
  } catch {
    return fail("Enter a hostname, like twitter.com.");
  }

  if (url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash || !url.hostname) {
    return fail("Enter a hostname, like twitter.com, without a scheme or path.");
  }
  return { ok: true, value: url.hostname };
}

function wildcardHost(value) {
  if (!value || value.includes("://") || value.includes("/") || value.includes(":")) {
    return fail("Wildcard domains match the hostname only, like *.reddit.com.");
  }
  const labels = value.split(".");
  const labelOk = labels.every((label) => label.length > 0 && /^[a-z0-9*?-]+$/i.test(label));
  if (!labelOk) {
    return fail("Wildcard domains match the hostname only, like *.reddit.com.");
  }
  return { ok: true, value: value.toLowerCase() };
}

function isIp(host) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isUnsupportedUrl(url) {
  if (["chrome:", "chrome-extension:", "edge:", "about:", "devtools:"].includes(url.protocol)) {
    return true;
  }
  if (url.hostname === "chromewebstore.google.com") return true;
  return url.hostname === "chrome.google.com" && url.pathname.startsWith("/webstore");
}

function unsupportedPattern(pattern, match) {
  if (match === "regex") return "";
  const lower = pattern.toLowerCase();
  if (lower.startsWith("chrome:") || lower.startsWith("chrome-extension:") || lower.startsWith("edge:") || lower.startsWith("about:")) {
    return "Chrome does not let extensions change this page.";
  }
  if (lower.includes("chrome.google.com/webstore") || lower.includes("chromewebstore.google.com")) {
    return "Chrome does not let extensions change the Chrome Web Store.";
  }
  return "";
}

function isCompilableRegex(pattern) {
  let source = pattern;
  if (source.startsWith("(?i)")) source = source.slice(4);
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
}

function hasCapturingGroup(pattern) {
  return /(?:^|[^\\])\((?!\?)/.test(pattern);
}

function fail(error) {
  return { ok: false, error };
}
