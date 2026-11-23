import { Dataset, DATASET_DAYS } from "../models/dataset/Dataset";
import { Role } from "../models/Role";
import { priorGamesByRiskLevel } from "../risk/risk-level";
import {
    AnalyzeDraftConfig,
    analyzeChampion,
    analyzeMatchup,
} from "./analysis";
import { LANE_OPPONENT_ROLES } from "./lane";
import { getStats } from "./utils";

export type CounterPick = {
    role: Role;
    championKey: string;
    // Lane matchup rating of the pick against this counter
    matchupRating: number;
};

export type CounterPickRisk = {
    // Rating the enemy gains by answering the pick in lane, compared to its best pick without knowing it.
    // Below zero when the pick also beats the enemy's best pick.
    risk: number;
    counters: CounterPick[];
};

/*
The enemy picks after an early pick, so it can answer it in lane. For each lane opponent position the enemy
has not picked yet, it is assumed to pick the champion with the highest champion rating plus lane matchup
against the pick, from the champions it can still pick that pass the minimum game count. The risk is what
that gains the enemy compared to the champion with the highest champion rating, which it would pick anyway.
*/
export function createCounterPickRisk(
    dataset: Dataset,
    fullDataset: Dataset,
    enemy: Map<Role, string>,
    unavailable: Set<string>,
    config: AnalyzeDraftConfig,
) {
    const priorGamesScale =
        priorGamesByRiskLevel[config.riskLevel] /
        priorGamesByRiskLevel["medium"];

    // The champions the enemy can still pick per position, with their champion rating
    const candidatesByRole = new Map<
        Role,
        { championKey: string; rating: number }[]
    >();
    const getCandidates = (role: Role) => {
        let candidates = candidatesByRole.get(role);
        if (!candidates) {
            candidates = Object.keys(dataset.championData)
                .filter(
                    (championKey) =>
                        !unavailable.has(championKey) &&
                        (getStats(fullDataset, championKey, role).games /
                            DATASET_DAYS) *
                            7 >=
                            config.minGames,
                )
                .map((championKey) => ({
                    championKey,
                    rating: config.ignoreChampionWinrates
                        ? 0
                        : analyzeChampion(
                              dataset,
                              fullDataset,
                              role,
                              championKey,
                              config.riskLevel,
                          ).rating,
                }));
            candidatesByRole.set(role, candidates);
        }
        return candidates;
    };

    const cache = new Map<string, CounterPickRisk | undefined>();

    return (role: Role, championKey: string) => {
        const cacheKey = `${role}-${championKey}`;
        if (cache.has(cacheKey)) return cache.get(cacheKey);

        let result: CounterPickRisk | undefined;
        const openRoles = LANE_OPPONENT_ROLES[role].filter(
            (enemyRole) => !enemy.has(enemyRole),
        );
        for (const enemyRole of openRoles) {
            let bestRating = -Infinity;
            let best: (CounterPick & { value: number }) | undefined;
            for (const candidate of getCandidates(enemyRole)) {
                if (candidate.championKey === championKey) continue;

                const matchupRating = analyzeMatchup(
                    fullDataset,
                    role,
                    championKey,
                    enemyRole,
                    candidate.championKey,
                    priorGamesScale,
                ).rating;
                bestRating = Math.max(bestRating, candidate.rating);
                const value = candidate.rating - matchupRating;
                if (!best || value > best.value) {
                    best = {
                        role: enemyRole,
                        championKey: candidate.championKey,
                        matchupRating,
                        value,
                    };
                }
            }
            if (!best) continue;

            result ??= { risk: 0, counters: [] };
            result.risk += best.value - bestRating;
            result.counters.push({
                role: best.role,
                championKey: best.championKey,
                matchupRating: best.matchupRating,
            });
        }

        cache.set(cacheKey, result);
        return result;
    };
}
