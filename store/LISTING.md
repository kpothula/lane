# Chrome Web Store listing

Paste these fields into the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole). Build the package first with `./scripts/pack-store.sh` and upload `dist/lane-<version>.zip`.

The package does not load remote code. Fonts are files inside the extension.

## Product identity

| Field | Value |
| --- | --- |
| Name | Lane |
| Category | Productivity |
| Language | English |
| Mature content | No |
| Visibility | Public, unless you want it unlisted |

## Summary

132 characters is the limit. This summary is 125 characters.

```
Redirect a page, swap its domain and keep the path, or block a site. Use exact, wildcard, or regex rules, and pause them all.
```

## Description

```
Lane changes where a page goes, or stops it, using rules you write.

Redirect
Send one address to another. A regex rule can keep part of the old address with \1.

Domain swap
Replace the host and keep the path and query. An exact domain such as twitter.com also matches www.twitter.com.

Block
Stop a single page, or a whole domain and its subdomains. The tab opens a short blocked page instead of the site.

Matching
Exact, wildcard (* for any sequence, ? for one character), or regular expressions. Chrome uses RE2, which does not support lookahead or lookbehind.

Controls
Turn each rule on or off. Pause everything from the toolbar without deleting your rules. When several rules match, the one higher in the list wins.

Counts
Settings shows how many times pages have been blocked in total. The toolbar popup shows how many times the current page has been blocked.

Privacy
Rules and blocked-page counts stay on your device. Lane does not send them to a server.

Lane cannot change chrome:// pages or the Chrome Web Store. A rule affects the top-level page, not the images and scripts inside it.
```

## Graphic assets

| Asset | File | Size |
| --- | --- | --- |
| Store icon | `icons/icon128.png` | 128×128 |
| Screenshot 1 | `store/screenshots/options.png` | 1280×800 |
| Screenshot 2 | `store/screenshots/blocked.png` | 1280×800 |
| Screenshot 3 | `store/screenshots/popup.png` | 1280×800 |
| Small promo tile | `store/screenshots/promo-440x280.png` | 440×280 |

Screenshot captions, if the form asks:

1. Write a redirect, domain swap, or block rule.
2. A blocked page, with a link back to your rules.
3. Pause rules, and see how many times this page was blocked.

## Single purpose

```
Lane redirects or blocks web pages according to rules the user creates. It does not inject content into sites, read page contents, or send browsing data off the device.
```

## Permission justifications

**Host access (`<all_urls>`)**

```
Lane applies redirect and block rules to addresses the user chooses. Those addresses can be on any site, so the extension needs access to all URLs. It does not read page contents. It matches the address of a top-level navigation and redirects or blocks that navigation.
```

**declarativeNetRequest**

```
Used to install the redirect and block rules the user creates, so Chrome applies them to top-level navigations. Rules are built on the device from what the user types. The extension does not download a ruleset.
```

**storage**

```
Saves the user's rules, whether rules are paused, and how many times each blocked address has been opened. This stays in chrome.storage.local on the device and is not uploaded.
```

**activeTab**

```
When the user opens the toolbar popup, Lane reads the current tab's address so it can show how many times that page has been blocked. It does not read the page contents. On Lane's own blocked page, it reads the blocked address from that page.
```

## Privacy practices

Answer **yes** only for web history. Answer **no** for personally identifiable information, health, financial and payment information, authentication information, personal communications, location, user activity, and website content.

Web history disclosure:

```
Lane stores the address of a page when one of the user's block rules stops it, plus a count of how many times that address was blocked. The count is shown in the popup for the current page and as a total in settings. The addresses and counts stay in local extension storage. They are not sent to a server, sold, or used for advertising.
```

Certify all three of these:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

Remote code: **No**. The extension does not use remote code.

## Privacy policy URL

The dashboard requires a public URL because blocked addresses are stored. Host [PRIVACY.md](../PRIVACY.md) where a reviewer can open it without signing in.

If the GitHub repository is public, use:

```
https://github.com/kpothula/lane/blob/main/PRIVACY.md
```

A private repository will not work for review. Publish the file, or put the same text on any public page, and paste that URL into the privacy policy field.

## Account and distribution checklist

1. Register a Chrome Web Store developer account. There is a one-time fee.
2. Create a new item and upload `dist/lane-<version>.zip`.
3. Paste the summary, description, category, and language from this file.
4. Upload the icon, three screenshots, and the small promo tile.
5. Complete the privacy tab with the answers above and a public privacy policy URL.
6. Submit for review.

After review, a new version is a new zip. The patch number in `manifest.json` increases on every git commit, so the uploaded version will be higher than the last one you published.
