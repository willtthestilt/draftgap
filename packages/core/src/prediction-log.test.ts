import { describe, expect, test } from "bun:test";
import {
    applyMatchHistory,
    PredictionLogEntry,
    summarizePredictionLog,
} from "./prediction-log";

const entry = (
    gameId: number,
    predictedWinrate: number,
    result?: PredictionLogEntry["result"],
): PredictionLogEntry => ({
    gameId,
    time: "2026-11-22T20:00:00.000Z",
    patch: "16.23.1",
    predictedWinrate,
    ally: [],
    enemy: [],
    result,
});

describe("applyMatchHistory", () => {
    test("uses the only participant of the current summoner's match history", () => {
        const entries = [entry(1, 0.55), entry(2, 0.45)];
        const updated = applyMatchHistory(
            entries,
            [
                {
                    gameId: 1,
                    gameDuration: 1800,
                    participants: [{ participantId: 3, stats: { win: true } }],
                },
                {
                    gameId: 2,
                    gameDuration: 1700,
                    participants: [{ participantId: 7, stats: { win: false } }],
                },
            ],
            { puuid: "me" },
        );
        expect(updated).toBe(2);
        expect(entries.map((e) => e.result)).toEqual(["win", "loss"]);
    });

    test("finds the player by identity in a full game", () => {
        const entries = [entry(1, 0.5)];
        applyMatchHistory(
            entries,
            [
                {
                    gameId: 1,
                    gameDuration: 1500,
                    participants: [
                        { participantId: 1, stats: { win: false } },
                        { participantId: 6, stats: { win: true } },
                    ],
                    participantIdentities: [
                        { participantId: 1, player: { puuid: "other" } },
                        { participantId: 6, player: { puuid: "me" } },
                    ],
                },
            ],
            { puuid: "me" },
        );
        expect(entries[0].result).toBe("win");
    });

    test("marks short games as remakes and leaves unknown games and known results alone", () => {
        const entries = [entry(1, 0.5), entry(2, 0.5), entry(3, 0.5, "loss")];
        const updated = applyMatchHistory(
            entries,
            [
                {
                    gameId: 1,
                    gameDuration: 200,
                    participants: [{ participantId: 1, stats: { win: true } }],
                },
                {
                    gameId: 3,
                    gameDuration: 1500,
                    participants: [{ participantId: 1, stats: { win: true } }],
                },
            ],
            { puuid: "me" },
        );
        expect(updated).toBe(1);
        expect(entries.map((e) => e.result)).toEqual([
            "remake",
            undefined,
            "loss",
        ]);
    });
});

describe("summarizePredictionLog", () => {
    test("counts games and scores the predictions", () => {
        const summary = summarizePredictionLog([
            entry(1, 0.6, "win"),
            entry(2, 0.4, "loss"),
            entry(3, 0.52, "loss"),
            entry(4, 0.5, "remake"),
            entry(5, 0.5),
        ]);
        expect(summary.games).toBe(3);
        expect(summary.pending).toBe(1);
        expect(summary.remakes).toBe(1);
        expect(summary.actualWinrate).toBeCloseTo(1 / 3);
        expect(summary.brierScore).toBeCloseTo((0.16 + 0.16 + 0.2704) / 3);
        const bucket = summary.buckets.find((b) => b.label === "50% to 54%")!;
        expect(bucket.games).toBe(1);
        expect(bucket.actual).toBe(0);
    });

    test("is empty without results", () => {
        const summary = summarizePredictionLog([entry(1, 0.5)]);
        expect(summary.games).toBe(0);
        expect(summary.brierScore).toBeUndefined();
    });
});
