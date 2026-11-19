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
