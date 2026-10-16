# Lane

Lane is a Chrome extension that redirects a page, swaps a domain while keeping the path, or blocks a site. You write the rules. They run on your device.

## What it can do

- **Redirect** a full URL to another `http` or `https` address. In a regex rule, `\1` inserts a capture group.
- **Swap a domain** and keep the path and query. An exact domain such as `twitter.com` also matches its subdomains, so `www.twitter.com/user` becomes `x.com/user`.
- **Block** one page, or a whole domain and its subdomains. The tab opens Lane’s blocked page.
- Match by **exact** text, a **wildcard** (`*` is any sequence, `?` is one character), or a **regex**. Chrome applies [RE2](https://github.com/google/re2/wiki/Syntax), which has no lookahead or lookbehind.
- Turn each rule on or off. **Pause** stops every rule without deleting the list. The top rule wins when several match.
- Count blocked visits. Settings shows the total. The toolbar popup shows the count for the current page.

Lane only changes the top-level page. It does not change images or scripts inside a page, and it cannot change `chrome://` pages or the Chrome Web Store.

## Install for development

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this folder.

Chrome warns that Lane can read and change data on all sites. That access is what lets a rule match an address you choose.

## Privacy

Rules, the pause switch, and blocked-page counts stay in `chrome.storage.local` on your device. Lane does not send them anywhere. See [PRIVACY.md](PRIVACY.md).

## Project layout

| Path | Purpose |
| --- | --- |
| `manifest.json` | Manifest V3, permissions, and version |
| `background.js` | Applies rules and records block counts |
| `lib/rules.js` | Validates rules and compiles them for Chrome |
| `options.html` | Rule editor |
| `popup.html` | Pause switch and the current page’s block count |
| `blocked.html` | Page shown when a navigation is blocked |
| `scripts/hooks/pre-commit` | Bumps the patch version in `manifest.json` on every commit |
| `scripts/pack-store.sh` | Builds the zip to upload to the Chrome Web Store |
| `store/LISTING.md` | Text to paste into the Chrome Web Store dashboard |

## Tests

```sh
node --test test/*.test.js
```

## Publish

The store listing, permission justifications, privacy answers, and screenshot notes are in [store/LISTING.md](store/LISTING.md).

Build the upload package:

```sh
./scripts/pack-store.sh
```

That writes `dist/lane-<version>.zip`. The zip contains only the extension. It does not include tests, the README, or the store screenshots.

A push to `main` runs [`.github/workflows/release.yml`](.github/workflows/release.yml). It reads the version from `manifest.json`, builds that zip, and publishes a GitHub release tagged `v<version>` with the zip attached. If that tag already exists, the workflow leaves the release alone.

## Version

`manifest.json` holds the version. A git hook bumps the patch number on every commit. The hook for this clone is installed at `.git/hooks/pre-commit`. The copy in the repository is `scripts/hooks/pre-commit`.

## Fonts

Geist and Geist Mono are bundled under `fonts/` and licensed under the SIL Open Font License. The license is in `fonts/OFL.txt`.
