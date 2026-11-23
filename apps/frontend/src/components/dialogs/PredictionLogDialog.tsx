import { createResource, For, Show } from "solid-js";
import {
    PredictionLogEntry,
    summarizePredictionLog,
} from "@draftgap/core/src/prediction-log";
import { DialogContent, DialogHeader, DialogTitle } from "../common/Dialog";
import { getPredictionLog } from "../../utils/prediction-log";

const percentage = (value: number | undefined) =>
    value === undefined ? "-" : `${(100 * value).toFixed(1)}%`;

export function PredictionLogDialog(props: { open: boolean }) {
    const [log] = createResource(
        () => props.open,
        async (open) => (open ? await getPredictionLog() : []),
    );
    const summary = () => summarizePredictionLog(log() ?? []);
    const recent = () =>
        [...(log() ?? [])]
            .sort((a, b) => b.time.localeCompare(a.time))
            .slice(0, 10);
    const resultText = (entry: PredictionLogEntry) =>
        entry.result === "win"
            ? "Win"
            : entry.result === "loss"
              ? "Loss"
              : entry.result === "remake"
                ? "Remake"
                : "Waiting";

    return (
        <DialogContent class="max-w-xl">
            <DialogHeader>
                <DialogTitle>Prediction log</DialogTitle>
            </DialogHeader>
            <p class="font-body">
                The winrate the app predicted for your team at the end of each
                champ select, next to the result of the game. Games are logged
                automatically while the app is synced with the League client.
            </p>

            <Show
                when={summary().games > 0}
                fallback={
                    <p class="font-body text-neutral-400">
                        No games with a result yet
                        {summary().pending > 0
                            ? ` (${summary().pending} waiting for a result).`
                            : "."}
                    </p>
                }
            >
                <p class="font-body">
                    {summary().games} games: the app predicted{" "}
                    {percentage(summary().averagePredicted)} on average, you won{" "}
                    {percentage(summary().actualWinrate)}.
                    {summary().pending > 0
                        ? ` ${summary().pending} waiting for a result.`
                        : ""}
                </p>
                <Show when={summary().games < 100}>
                    <p class="font-body text-yellow-500">
                        With fewer than 100 games, the differences below are
                        mostly chance.
                    </p>
                </Show>

                <table class="font-body w-full">
                    <thead>
                        <tr class="text-left text-neutral-400">
                            <th class="font-normal">Predicted</th>
                            <th class="font-normal text-right">Games</th>
                            <th class="font-normal text-right">
                                Predicted on average
                            </th>
                            <th class="font-normal text-right">You won</th>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={summary().buckets}>
                            {(bucket) => (
                                <tr>
                                    <td>{bucket.label}</td>
                                    <td class="text-right">{bucket.games}</td>
                                    <td class="text-right">
                                        {percentage(bucket.predicted)}
                                    </td>
                                    <td class="text-right">
                                        {percentage(bucket.actual)}
                                    </td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>

                <p class="font-body">
                    Accuracy score (Brier): the app{" "}
                    {summary().brierScore?.toFixed(3)}, always guessing 50%
                    0.250. Lower is better.
                </p>
            </Show>

            <Show when={recent().length > 0}>
                <h2 class="text-xl uppercase">Last games</h2>
                <table class="font-body w-full">
                    <tbody>
                        <For each={recent()}>
                            {(entry) => (
                                <tr>
                                    <td>
                                        {new Date(entry.time).toLocaleString()}
                                    </td>
                                    <td class="text-right">
                                        {percentage(entry.predictedWinrate)}
                                    </td>
                                    <td class="text-right">
                                        {resultText(entry)}
                                    </td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </Show>
        </DialogContent>
    );
}
