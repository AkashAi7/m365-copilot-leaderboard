# M365 Copilot Leaderboard

A playful GitHub Pages dashboard for tracking daily reaction wins across a fixed roster.

## What it does

- Seeds the leaderboard with the requested people and custom profile titles.
- Accepts a daily CSV or JSON upload, or pasted raw rows.
- Awards `+5` points for every uploaded row that contains:
  - one known person name
  - at least one reaction
- Stores scores and import history in browser local storage.
- Lets you undo the last import, reset everything, or export the current leaderboard.

## Expected upload shape

The import flow is flexible. It looks for a name column such as `name`, `author`, `user`, or `sender`, and a reaction column such as `reactions`, `reactionCount`, `likes`, or `emojiCount`.

Example CSV:

```csv
name,reactions
Akash Dwivedi,3
Sapna Giddegowda,1
```

Example JSON:

```json
[
  { "name": "Akash Dwivedi", "reactions": 3 },
  { "author": "Sapna Giddegowda", "reactionCount": 1 }
]
```

## Local use

Open `index.html` directly in a browser, or serve the folder with any static file server.

## GitHub Pages

This project is a plain static site, so it can be published from the repository root without a build step.