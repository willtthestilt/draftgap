import { createEffect, onCleanup, untrack } from "solid-js";
import { ClientState, useLolClient } from "../contexts/LolClientContext";
import { useDraft } from "../contexts/DraftContext";
import { useDraftAnalysis } from "../contexts/DraftAnalysisContext";
import { useDataset } from "../contexts/DatasetContext";
import {
    fillPredictionResults,
    recordPrediction,
} from "../utils/prediction-log";

// How often results are looked up while there are games without a result
const RESULT_CHECK_MS = 2 * 60 * 1000;

// Logs the app's prediction at the end of each champ select, and the result of the game afterwards
export function createPredictionLogger() {
    const { clientState, champSelectSession } = useLolClient();
    const { draftFinished, allyTeam, opponentTeam } = useDraft();
    const { allyDraftAnalysis } = useDraftAnalysis();
    const { dataset } = useDataset();

    // Kept up to date until champ select ends, so trades and swaps are included
    createEffect(() => {
        if (clientState() !== ClientState.InChampSelect || !draftFinished()) {
            return;
        }
        const gameId = champSelectSession.gameId;
        const winrate = allyDraftAnalysis()?.winrate;
        const patch = dataset()?.version;
        if (!gameId || winrate === undefined || !patch) return;

        const entry = {
            gameId,
            time: new Date().toISOString(),
            patch,
            predictedWinrate: winrate,
            ally: allyTeam.map((pick) => pick.championKey!),
            enemy: opponentTeam.map((pick) => pick.championKey!),
        };
        untrack(() => void recordPrediction(entry));
    });

    // Results appear in the match history after the game, so it is checked from the main menu
    const checkResults = () => {
        if (clientState() === ClientState.MainMenu) {
            void fillPredictionResults();
        }
    };
    createEffect(() => {
        if (clientState() === ClientState.MainMenu) untrack(checkResults);
    });
    const interval = setInterval(checkResults, RESULT_CHECK_MS);
    onCleanup(() => clearInterval(interval));
}
