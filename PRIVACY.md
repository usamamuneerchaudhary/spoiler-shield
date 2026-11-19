# Privacy

Spoiler Shield does not collect personal data. The only time anything leaves your browser is when you choose to send a report.

## The extension

- **What it reads:** the text of pages on the sites you protect (YouTube, Reddit and X; plus Twitch, TikTok and Google if you turn them on), so it can decide what to blur. This happens entirely inside your browser and nothing is sent anywhere.
- **What it stores:** your settings (on/off, the games and shows you picked, how far you've got, which sites) and the latest spoiler lists, in your browser's extension storage on your own device.
- **Network requests:** the extension downloads the public spoiler lists from `raw.githubusercontent.com`. That request carries no cookies and no information about you or the pages you visit.
- **No accounts, analytics, ads or tracking.**

## Reports (only when you send one)

Reporting is always your choice. The report form opens filled in, you can edit or remove anything, and nothing is sent until you press **Send report**.

- **Sent as a GitHub issue** (the default): Send opens a pre-filled issue on GitHub that you check and submit yourself, under your GitHub account. GitHub's privacy policy applies.
- **Sent to the Spoiler Shield API** (when the project runs one): the report contains:
  - what you reported: the kind, the game or show, the chapter and the text;
  - the page link, only if you leave "Include the page link" ticked;
  - your optional note, the site name and the extension and list versions.

  The server also keeps a keyed hash of your IP address so it can stop abuse, but never the address itself. Reviewed reports are deleted after 180 days. Moderators see reports in order to fix the lists, and reports are not shared with anyone else or used for anything else.

Questions: open an issue at https://github.com/usamamuneerchaudhary/spoiler-shield/issues.
