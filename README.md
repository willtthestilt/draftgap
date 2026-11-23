# DraftGap
DraftGap.com is a site and desktop application which helps you pick and draft your League of Legends team. It suggests champions based on the meta, their matchups with every opponent champion and every ally duo. Its a unopinionated tool using only statistics to make suggestions.

If you ever wondered what champion to pick, which is the best champion you could have picked, or if the game was truly lost in draft, DraftGap is for you.

Find it at [draftgap.com](https://draftgap.com), or download the app, which integrates with the League client to automatically synchronize with the current draft in champ select.

## This version

This copy uses Master+ data instead of Emerald+ data (of the last 30 days, like the original), and marks champions that were buffed, nerfed or adjusted by a patch released in that period.

The data is not downloaded from draftgap.com, it is generated on your own machine:

1. `bun install`
2. `bun run dataset` fetches the data from Lolalytics into `apps/frontend/public/datasets` (takes about a minute, run it again to refresh the data)
3. `bun run dev` starts the app on http://localhost:3000

The rank and period are set by `DATASET_TIER` and `DATASET_DAYS` in `packages/core/src/models/dataset/Dataset.ts`.

Riot releases a new patch before Lolalytics has data for it. The current patch is therefore the one Lolalytics itself shows as current, and a champion without games in the current patch yet uses its 30-day data.

Four things differ from the original in the analysis:

- The draft table has a Lane column (with the advanced winrates), the matchup against the lane opponents: the same position, or the bottom and support together.
- The draft table has a Counter column (with the advanced winrates): what the enemy gains by answering the pick in lane with its best counter, compared to the champion it would pick anyway, for the lane opponent positions it has not picked yet (`packages/core/src/draft/counter-risk.ts`). Hovering the value shows the counter.
- The amount of games a duo or matchup needs before it is trusted (the prior games) is no longer the same for every pair. It is measured from the data per combination of positions (`packages/core/src/draft/pair-prior.ts`), the risk level scales it.
- The current patch winrate of a champion is trusted sooner when the champion was changed in the current or previous patch. Other champions lean on their 30-day winrate, as it barely moves between patches when a champion is not changed (`packages/core/src/draft/champion-prior.ts`, measured on patches 16.20 to 16.22).
- The 30-day winrate of a rare pick (ex. a champion outside its usual position) is pulled toward the average of picks with a similar number of games, as rare picks are weaker on average and a lucky small sample would otherwise top the suggestions. This makes a lower minimum game count (100 or 250) safe to use. Tested on games the calculation had not seen: it predicted the next patch better than no pull, while a pull toward 50% predicted worse.

### Prediction log

The desktop app logs the winrate it predicted for your team at the end of each champ select, and fills in the result from the League client match history afterwards (remakes are left out). The ⋮ menu shows the log with a calibration table and an accuracy score against always guessing 50%. The log is the file `prediction-log.json` in the app data folder (`%APPDATA%\com.draftgap.master` on Windows).

### Desktop app

The desktop app is built as "DraftGap Master", separate from the original DraftGap app, and does not update itself.

1. Install Rust and the Microsoft C++ Build Tools
2. Run `bunx tauri build --no-bundle` in `apps/frontend`
3. Start `apps/frontend/src-tauri/target/release/DraftGapMaster.exe`

The desktop app reads the datasets from `apps/frontend/public/datasets` of this folder when it starts. When that folder is missing it uses the data from the moment it was built.

On the first opening of the day (when the data is not from today) the desktop app runs `bun run dataset` itself, in the background. The header shows "Updating data..." meanwhile, and the new data is used as soon as it is ready. The output is written to `dataset-refresh.log`. When the refresh fails or the fetched data is incomplete, the existing datasets are kept and the app tries again the next time it is opened, at most once an hour. This needs `bun` and this folder on the machine.

Once a day the desktop app also checks the original DraftGap repository (with `git`) for changes this version does not have yet, and shows a message listing them. "Got it" hides the message until there are newer changes, "Later" shows it again the next day. The changes are not brought in automatically, as they can touch the same files as the changes of this version.

