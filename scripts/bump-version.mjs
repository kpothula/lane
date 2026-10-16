import { readFileSync, writeFileSync } from "node:fs";

const manifestPath = new URL("../manifest.json", import.meta.url);
const text = readFileSync(manifestPath, "utf8");
const match = text.match(/"version": "(\d+)\.(\d+)\.(\d+)"/);

if (!match) {
  console.error("manifest.json is missing a semver version.");
  process.exit(1);
}

const next = `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
writeFileSync(manifestPath, text.replace(match[0], `"version": "${next}"`));
console.log(next);
