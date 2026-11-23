import { Dataset } from "../models/dataset/Dataset";
import { priorGamesByRiskLevel, RiskLevel } from "../risk/risk-level";

/*
The current patch winrate of a champion is combined with prior games at its full dataset (30-day) winrate.
How many prior games depends on whether the champion was changed recently. Measured on Master+ patches 16.20 to 16.22:
- A champion changed by a patch moved about 1 to 1.3 points from the patch before (ideal: 1,400 to 2,900 prior games).
- An unchanged champion moved at most about 0.4 points (ideal: 15,000 prior games or more). This is kept lower,
  as item and system changes also move champions that were not changed themselves.
A change in the previous patch counts too, as the full dataset then still holds games from before the change.
*/
const CHANGED_CHAMPION_PRIOR_GAMES = 2000;
const UNCHANGED_CHAMPION_PRIOR_GAMES = 10000;

const toPatch = (version: string) => version.split(".").slice(0, 2).join(".");
const patchOrder = (patch: string) => {
    const [major, minor] = patch.split(".").map(Number);
    return major * 1000 + minor;
};

const recentlyChangedByDataset = new WeakMap<Dataset, Set<string> | null>();

// The champions changed in the patch of the dataset or the one before, null when the dataset does not tell
export function getRecentlyChangedChampions(dataset: Dataset) {
    const cached = recentlyChangedByDataset.get(dataset);
    if (cached !== undefined) return cached;

    const patchChanges = Object.entries(dataset.patchChanges ?? {});
    const current = patchOrder(toPatch(dataset.version));
    const recentPatches = [
        ...new Set(
            patchChanges.flatMap(([, changes]) => changes.map((c) => c.patch)),
        ),
    ]
        .filter((patch) => patchOrder(patch) <= current)
        .sort((a, b) => patchOrder(b) - patchOrder(a))
        .slice(0, 2);

    // Without the changes of the current patch it is unknown which champions changed
    let changed: Set<string> | null = null;
    if (recentPatches.length > 0 && patchOrder(recentPatches[0]) === current) {
        changed = new Set(
            patchChanges
                .filter(([, changes]) =>
                    changes.some((c) => recentPatches.includes(c.patch)),
                )
                .map(([championKey]) => championKey),
        );
    }

    recentlyChangedByDataset.set(dataset, changed);
    return changed;
}

export function getChampionPriorGames(
    dataset: Dataset,
    championKey: string,
    riskLevel: RiskLevel,
) {
    const priorGames = priorGamesByRiskLevel[riskLevel];
    const changed = getRecentlyChangedChampions(dataset);
    if (!changed) return priorGames;

    // The risk level scales the prior games, medium uses the measured values
    const scale = priorGames / priorGamesByRiskLevel["medium"];
    return (
        (changed.has(championKey)
            ? CHANGED_CHAMPION_PRIOR_GAMES
            : UNCHANGED_CHAMPION_PRIOR_GAMES) * scale
    );
}

/*
Rare picks (ex. a champion outside its usual position) are weaker on average than popular ones:
in the Master+ 30-day data, picks with fewer than 500 games averaged about 45%, popular picks about 50%.
So the full dataset winrate of a pick is pulled toward the average of picks with a similar number of games,
which keeps a rare pick that got lucky from topping the suggestions. Tested out of sample (games before
patch 16.23 predicting 16.23): 250 to 500 prior games predicted best, a pull toward 50% predicted worse
than no pull at all.
*/
const SIMILAR_PICKS_PRIOR_GAMES = 500;
const GAMES_BUCKET_EDGES = [0, 500, 1000, 2000, 5000, 20000, Infinity];

const similarPicksWinrateByDataset = new WeakMap<
    Dataset,
    (games: number) => number
>();

// The average winrate of picks with a similar number of games in the dataset
function getSimilarPicksWinrate(fullDataset: Dataset) {
    const cached = similarPicksWinrateByDataset.get(fullDataset);
    if (cached) return cached;

    const buckets = GAMES_BUCKET_EDGES.slice(0, -1).map(() => ({
        wins: 0,
        games: 0,
        picks: 0,
        logGames: 0,
    }));
    for (const champion of Object.values(fullDataset.championData)) {
        for (const stats of Object.values(champion.statsByRole)) {
            if (stats.games < 1) continue;
            const bucket =
                buckets[
                    GAMES_BUCKET_EDGES.findIndex(
                        (edge, i) =>
                            stats.games >= edge &&
                            stats.games < GAMES_BUCKET_EDGES[i + 1],
                    )
                ];
            bucket.wins += stats.wins;
            bucket.games += stats.games;
            bucket.picks++;
            bucket.logGames += Math.log10(stats.games);
        }
    }

    // One point per bucket: its typical number of games and its average winrate, interpolated in between
    const points = buckets
        .filter((bucket) => bucket.picks > 0)
        .map((bucket) => ({
            x: bucket.logGames / bucket.picks,
            winrate: bucket.wins / bucket.games,
        }));

    const winrate = (games: number) => {
        if (points.length === 0) return 0.5;

        const x = Math.log10(Math.max(games, 1));
        if (x <= points[0].x) return points[0].winrate;
        for (let i = 0; i < points.length - 1; i++) {
            const [a, b] = [points[i], points[i + 1]];
            if (x <= b.x) {
                return (
                    a.winrate +
                    ((b.winrate - a.winrate) * (x - a.x)) / (b.x - a.x)
                );
            }
        }
        return points[points.length - 1].winrate;
    };

    similarPicksWinrateByDataset.set(fullDataset, winrate);
    return winrate;
}

// The full dataset winrate of a pick, pulled toward picks with a similar number of games
export function getPulledFullWinrate(
    fullDataset: Dataset,
    stats: { wins: number; games: number },
    riskLevel: RiskLevel,
) {
    // The risk level scales the prior games, medium uses the tested value
    const priorGames =
        SIMILAR_PICKS_PRIOR_GAMES *
        (priorGamesByRiskLevel[riskLevel] / priorGamesByRiskLevel["medium"]);
    const similarWinrate = getSimilarPicksWinrate(fullDataset)(stats.games);

    return (
        (stats.wins + priorGames * similarWinrate) / (stats.games + priorGames)
    );
}
