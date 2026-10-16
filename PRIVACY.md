# Lane privacy policy

Lane is a Chrome extension that redirects or blocks pages using rules you create. This policy describes the only data Lane handles.

## Data stored on your device

Lane stores the following in Chrome’s local extension storage (`chrome.storage.local`):

- The rules you create, including patterns, destinations, names, and whether each rule is enabled.
- Whether all rules are paused.
- A count of blocked visits, both the total and the count for each blocked address.

That data stays on the device where you installed Lane. Creating a rule or opening a blocked page does not send the address, the rule, or the count to the developer or to any other server.

Lane does not read the contents of a page. It matches the address of a top-level navigation so Chrome can redirect or block it. It does not collect account information, location, payment details, or anything you type into a website.

## Why this data exists

Rules are stored so Chrome can keep applying them. Block counts are stored so the settings page can show a total and the toolbar popup can show how many times the current page was blocked.

## Sharing

Lane does not sell, rent, or transfer this data. It does not use it for advertising, credit, or lending decisions. It does not send it to analytics or crash-reporting services.

## How long it is kept

The data remains until you delete a rule, clear the extension’s storage, or uninstall Lane. Uninstalling Chrome’s copy of Lane removes its local storage.

## Contact

Questions about this policy can be opened as an issue on the project repository: [https://github.com/kpothula/lane](https://github.com/kpothula/lane).
