# Frontier Agents Leaderboard

A cybernetic GitHub Pages dashboard for tracking weekly reaction wins across a fixed roster.

## What it does

- Seeds the leaderboard with the requested people and custom profile titles.
- Accepts a CSV or JSON upload, or pasted raw rows.
- Awards `+5` points for every uploaded row that contains:
  - one known person name
  - at least one reaction
- Publishes scores and import history from `data/leaderboard-state.json` for the public board.
- Keeps local admin imports in browser local storage for manual weekly updates and corrections.
- Lets you undo the last import, reset everything, or export the current leaderboard.
- Keeps the published dashboard presentation-only.

## Public board

- The public page shows the leaderboard and weekly board rules only.
- The displayed rule is `+5` points per valid uploaded completion.
- The new dashboard ratings are updated every week on Monday.

## Local admin use

Use the local-only `admin.local.html` file for manual uploads and score updates. It is not intended to be part of the published dashboard.

Update cadence:

- Upload names and reactions manually.
- Publish the new dashboard ratings every week on Monday.

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