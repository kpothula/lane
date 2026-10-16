import assert from "node:assert/strict";
import test from "node:test";
import { blockedTarget, pageCount, pageKey, recordHit } from "../lib/blocks.js";

test("page counts ignore the fragment and keep a running total", () => {
  let counts = recordHit(null, "https://reddit.com/r/all#hot");
  counts = recordHit(counts, "https://reddit.com/r/all");
  counts = recordHit(counts, "https://example.com/secret");

  assert.equal(pageKey("https://reddit.com/r/all#hot"), "https://reddit.com/r/all");
  assert.equal(counts.total, 3);
  assert.equal(pageCount(counts, "https://reddit.com/r/all"), 2);
  assert.equal(pageCount(counts, "https://example.com/secret"), 1);
  assert.equal(pageCount(counts, ""), 0);
});

test("a blocked-page hash is the page that was stopped", () => {
  const target = blockedTarget("#https://www.reddit.com/r/all");
  const counts = recordHit(null, target);
  assert.equal(pageCount(counts, blockedTarget("#https://www.reddit.com/r/all")), 1);
});
