// A log of the winrate the app predicted for your team in champ select, and the result of the game,
// to check whether the predictions hold up for you.

export type PredictionResult = "win" | "loss" | "remake";

export type PredictionLogEntry = {
    gameId: number;
    // When the prediction was made, ISO time
    time: string;
    patch: string;
    // The winrate the app predicted for your team, from 0 to 1
    predictedWinrate: number;
    ally: string[];
    enemy: string[];
    result?: PredictionResult;
};

// The parts of a game in the League client match history that are used
export type MatchHistoryGame = {
    gameId: number;
    // In seconds
    gameDuration?: number;
    participants?: {
        participantId: number;
        stats?: { win?: boolean };
    }[];
    participantIdentities?: {
        participantId: number;
        player?: { puuid?: string; summonerId?: number };
    }[];
};

// Games shorter than this are remakes, which say nothing about the draft
const REMAKE_SECONDS = 5 * 60;

// Fills in the results of logged games that are in the match history, returns how many were filled in
export function applyMatchHistory(
    entries: PredictionLogEntry[],
    games: MatchHistoryGame[],
    player: { puuid?: string; summonerId?: number },
) {
    let updated = 0;
    for (const entry of entries) {
        if (entry.result) continue;

        const game = games.find((g) => g.gameId === entry.gameId);
        if (!game) continue;

        if (
            game.gameDuration !== undefined &&
            game.gameDuration < REMAKE_SECONDS
        ) {
            entry.result = "remake";
            updated++;
            continue;
        }

        // The match history of the current summoner usually only holds that player,
        // otherwise the player is found by its identity
        const participants = game.participants ?? [];
        const identity = game.participantIdentities?.find(
            (i) =>
                (player.puuid !== undefined &&
                    i.player?.puuid === player.puuid) ||
                (player.summonerId !== undefined &&
                    i.player?.summonerId === player.summonerId),
        );
        const participant =
            participants.length === 1
                ? participants[0]
                : participants.find(
                      (p) => p.participantId === identity?.participantId,
                  );
        const win = participant?.stats?.win;
        if (win === undefined) continue;

        entry.result = win ? "win" : "loss";
        updated++;
    }

    return updated;
}

const BUCKETS = [
    { label: "Below 46%", min: 0, max: 0.46 },
    { label: "46% to 50%", min: 0.46, max: 0.5 },
    { label: "50% to 54%", min: 0.5, max: 0.54 },
    { label: "54% and above", min: 0.54, max: 1.01 },
];

export function summarizePredictionLog(entries: PredictionLogEntry[]) {
    const decided = entries.filter(
        (e) => e.result === "win" || e.result === "loss",
    );
    const outcome = (e: PredictionLogEntry) => (e.result === "win" ? 1 : 0);
    const average = (values: number[]) =>
        values.length === 0
            ? undefined
            : values.reduce((a, b) => a + b, 0) / values.length;

    return {
        games: decided.length,
        pending: entries.filter((e) => !e.result).length,
        remakes: entries.filter((e) => e.result === "remake").length,
        averagePredicted: average(decided.map((e) => e.predictedWinrate)),
        actualWinrate: average(decided.map(outcome)),
        // Mean squared error of the prediction, a coin flip (always 50%) scores 0.25, lower is better
        brierScore: average(
            decided.map((e) => (e.predictedWinrate - outcome(e)) ** 2),
        ),
        buckets: BUCKETS.map((bucket) => {
            const inBucket = decided.filter(
                (e) =>
                    e.predictedWinrate >= bucket.min &&
                    e.predictedWinrate < bucket.max,
            );
            return {
                label: bucket.label,
                games: inBucket.length,
                predicted: average(inBucket.map((e) => e.predictedWinrate)),
                actual: average(inBucket.map(outcome)),
            };
        }),
    };
}
