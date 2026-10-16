import assert from "node:assert/strict";
import test from "node:test";
import { allocateDnrId, compileRules, normalizeRule, preview } from "../lib/rules.js";

const EXTENSION_ID = "abcdefghijklmnopqrstuvwxyzabcdef";

function rule(overrides) {
  const result = normalizeRule({
    type: "redirect",
    match: "exact",
    pattern: "https://example.com/old",
    destination: "https://example.com/new",
    name: "",
    ...overrides,
  });
  assert.equal(result.ok, true, result.error);
  return {
    id: "rule-1",
    dnrId: 1,
    enabled: true,
    ...result.rule,
    ...overrides,
    pattern: result.rule.pattern,
    destination: result.rule.destination,
  };
}

test("exact redirect matches only the full URL", () => {
  const stored = rule();
  const compiled = compileRules([stored], EXTENSION_ID);
  assert.equal(compiled.length, 1);
  assert.equal(compiled[0].condition.regexFilter, "^https://example\\.com/old$");
  assert.deepEqual(compiled[0].condition.resourceTypes, ["main_frame"]);
  assert.equal(compiled[0].action.redirect.url, "https://example.com/new");
  assert.equal(compiled[0].priority, 1);

  assert.equal(preview([stored], "https://example.com/old").status, "match");
  assert.equal(preview([stored], "https://example.com/old/extra").status, "none");
  assert.match(preview([stored], "https://example.com/old").summary, /https:\/\/example.com\/new/);

  const query = rule({
    pattern: "https://example.com/a?b=1",
    destination: "https://example.com/done",
  });
  assert.equal(preview([query], "https://example.com/a?b=1").status, "match");
  assert.equal(preview([query], "https://example.com/axb=1").status, "none");
});

test("wildcard uses star and question mark", () => {
  const stored = rule({
    match: "wildcard",
    pattern: "https://example.com/a?c/*",
    destination: "https://example.com/elsewhere",
  });
  assert.equal(preview([stored], "https://example.com/abc/more").status, "match");
  assert.equal(preview([stored], "https://example.com/ac/more").status, "none");
  assert.equal(preview([stored], "https://example.com/abbc/more").status, "none");
  assert.equal(preview([stored], "http://example.com/abc/more").status, "none");
});

test("regex redirect keeps capture groups in the destination", () => {
  const stored = rule({
    match: "regex",
    pattern: "^https://example\\.com/old/(.*)",
    destination: "https://example.com/new/\\1",
  });
  const compiled = compileRules([stored], EXTENSION_ID)[0];
  assert.equal(compiled.action.redirect.regexSubstitution, "https://example.com/new/\\1");
  assert.equal(
    preview([stored], "https://example.com/old/page").summary,
    "Redirects to https://example.com/new/page.",
  );
});

test("exact domain matches subdomains and keeps the rest of the URL", () => {
  const stored = rule({
    type: "domain",
    match: "exact",
    pattern: "Twitter.com",
    destination: "x.com",
  });
  assert.equal(stored.pattern, "twitter.com");
  const compiled = compileRules([stored], EXTENSION_ID)[0];
  assert.equal(compiled.action.redirect.transform.host, "x.com");
  assert.match(compiled.condition.regexFilter, /^\(\?i\)/);

  const hit = preview([stored], "https://www.twitter.com/user/status?x=1");
  assert.equal(hit.status, "match");
  assert.match(hit.summary, /https:\/\/x.com\/user\/status\?x=1/);
  assert.equal(preview([stored], "https://twitter.com/home").status, "match");
  assert.equal(preview([stored], "http://twitter.com:8080/a").status, "match");
  assert.equal(preview([stored], "https://nottwitter.com/").status, "none");
  assert.equal(preview([stored], "https://twitter.com.evil.com/").status, "none");
});

test("domain wildcard narrows the host", () => {
  const stored = rule({
    type: "domain",
    match: "wildcard",
    pattern: "*.reddit.com",
    destination: "oldreddit.example",
  });
  assert.equal(preview([stored], "https://www.reddit.com/r/test").status, "match");
  assert.equal(preview([stored], "https://reddit.com/r/test").status, "none");
  assert.equal(preview([stored], "https://www.reddit.com.evil.com/").status, "none");
});

test("domain regex runs against the full URL", () => {
  const stored = rule({
    type: "domain",
    match: "regex",
    pattern: "^https://old\\.reddit\\.com",
    destination: "reddit.com",
  });
  assert.equal(preview([stored], "https://old.reddit.com/r/test").status, "match");
  assert.equal(preview([stored], "http://old.reddit.com/r/test").status, "none");
});

test("a domain block covers the host and its subdomains", () => {
  const stored = rule({
    type: "block",
    match: "exact",
    scope: "domain",
    pattern: "Reddit.com",
    destination: "",
  });
  assert.equal(stored.scope, "domain");
  assert.equal(stored.pattern, "reddit.com");
  const compiled = compileRules([stored], EXTENSION_ID)[0];
  assert.match(compiled.condition.regexFilter, /^\(\?i\)\^https\?:\/\//);
  assert.equal(preview([stored], "https://www.reddit.com/r/all").status, "match");
  assert.equal(preview([stored], "https://reddit.com/").status, "match");
  assert.equal(preview([stored], "https://notreddit.com/").status, "none");
  assert.equal(preview([stored], "https://old.reddit.com/r/test?x=1").summary, "Blocked by a block rule.");
});

test("block rules redirect the top frame to the extension page", () => {
  const stored = rule({
    type: "block",
    match: "wildcard",
    pattern: "https://example.com/secret*",
    destination: "",
  });
  const compiled = compileRules([stored], EXTENSION_ID)[0];
  assert.equal(
    compiled.action.redirect.regexSubstitution,
    `chrome-extension://${EXTENSION_ID}/blocked.html#\\0`,
  );
  assert.equal(preview([stored], "https://example.com/secret/page").summary, "Blocked by a block rule.");
});

test("higher rules win and disabled rules are skipped", () => {
  const first = rule({ name: "First", dnrId: 4 });
  const second = rule({
    name: "Second",
    dnrId: 5,
    pattern: "https://example.com/old",
    destination: "https://example.com/second",
  });
  const disabled = { ...first, id: "off", dnrId: 6, enabled: false, name: "Off" };
  const compiled = compileRules([disabled, first, second], EXTENSION_ID);
  assert.deepEqual(compiled.map((item) => item.id), [4, 5]);
  assert.deepEqual(compiled.map((item) => item.priority), [2, 1]);
  assert.match(preview([first, second], "https://example.com/old").summary, /https:\/\/example.com\/new/);
  assert.equal(preview([disabled], "https://example.com/old").status, "none");
});

test("pause, invalid URLs, and browser pages are reported", () => {
  const stored = rule();
  assert.equal(preview([stored], "https://example.com/old", { paused: true }).status, "paused");
  assert.equal(preview([stored], "example.com").status, "invalid");
  assert.equal(preview([stored], "chrome://extensions").status, "unsupported");
  assert.equal(preview([stored], "https://chromewebstore.google.com/detail/x").status, "unsupported");
});

test("validation rejects loops, lookaround, and bad destinations", () => {
  const loop = normalizeRule({
    type: "redirect",
    match: "wildcard",
    pattern: "https://example.com/*",
    destination: "https://example.com/new",
  });
  assert.equal(loop.ok, false);
  assert.match(loop.error, /forever/);

  const domainLoop = normalizeRule({
    type: "domain",
    match: "exact",
    pattern: "x.com",
    destination: "www.x.com",
  });
  assert.equal(domainLoop.ok, false);

  const lookaround = normalizeRule({
    type: "block",
    match: "regex",
    pattern: "example(?=\\.com)",
  });
  assert.equal(lookaround.ok, false);
  assert.match(lookaround.error, /RE2/);

  const missingGroup = normalizeRule({
    type: "redirect",
    match: "regex",
    pattern: "^https://example\\.com/.*",
    destination: "https://example.com/\\1",
  });
  assert.equal(missingGroup.ok, false);

  const badDest = normalizeRule({
    type: "redirect",
    match: "exact",
    pattern: "https://example.com/old",
    destination: "javascript:alert(1)",
  });
  assert.equal(badDest.ok, false);

  const schemeInDomain = normalizeRule({
    type: "domain",
    match: "exact",
    pattern: "https://twitter.com/home",
    destination: "x.com",
  });
  assert.equal(schemeInDomain.ok, false);

  const chromePage = normalizeRule({
    type: "block",
    match: "exact",
    pattern: "chrome://settings",
  });
  assert.equal(chromePage.ok, false);

  const backreference = normalizeRule({
    type: "block",
    match: "regex",
    pattern: "(https)://\\1.example",
  });
  assert.equal(backreference.ok, false);
});

test("network ids stay above ids already stored", () => {
  assert.equal(allocateDnrId([], 1), 1);
  assert.equal(allocateDnrId([{ dnrId: 7 }], 5), 8);
  assert.equal(allocateDnrId([{ dnrId: 2 }], 9), 9);
});
