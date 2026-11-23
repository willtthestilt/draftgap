import { invoke, isTauri } from "@tauri-apps/api/core";
import {
    applyMatchHistory,
    PredictionLogEntry,
} from "@draftgap/core/src/prediction-log";
import { getCurrentSummoner, getMatchHistory } from "../api/lcu-api";

// The log is kept in memory and saved to a file by the desktop app, see main.rs
let entries: PredictionLogEntry[] | undefined;
// Changes run one at a time, so a load or save never interleaves with another change
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(change: (entries: PredictionLogEntry[]) => Promise<T>) {
    const result = queue.then(async () => {
        if (!entries) {
            const content = isTauri()
                ? await invoke<string>("read_prediction_log")
                : "[]";
            const parsed = JSON.parse(content);
            entries = Array.isArray(parsed) ? parsed : [];
        }
        return change(entries!);
    });
    queue = result.catch((err) => console.error("Prediction log error:", err));
    return result;
}

const save = (log: PredictionLogEntry[]) =>
    isTauri()
        ? invoke("write_prediction_log", { content: JSON.stringify(log) })
        : Promise.resolve();

export function getPredictionLog() {
    return enqueue(async (log) => [...log]);
}

// Records the prediction of a finished draft, a later prediction for the same game replaces it
export function recordPrediction(entry: PredictionLogEntry) {
    return enqueue(async (log) => {
        const index = log.findIndex((e) => e.gameId === entry.gameId);
        const existing = log[index];
        if (
            existing &&
            existing.predictedWinrate === entry.predictedWinrate &&
            existing.ally.join() === entry.ally.join() &&
            existing.enemy.join() === entry.enemy.join()
        ) {
            return;
        }

        if (index >= 0) {
            log[index] = { ...entry, result: existing?.result };
        } else {
            log.push(entry);
        }
        await save(log);
    });
}

// Fills in the results of logged games from the League client match history
export function fillPredictionResults() {
    return enqueue(async (log) => {
        if (!log.some((e) => !e.result)) return 0;

        const [history, summoner] = await Promise.all([
            getMatchHistory(),
            getCurrentSummoner(),
        ]);
        const updated = applyMatchHistory(log, history?.games?.games ?? [], {
            puuid: summoner?.puuid,
            summonerId: summoner?.summonerId,
        });
        if (updated > 0) await save(log);
        return updated;
    });
}
