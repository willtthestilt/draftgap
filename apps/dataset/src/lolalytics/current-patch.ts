import { DATASET_TIER } from "@draftgap/core/src/models/dataset/Dataset";
import { retry } from "../utils";
import { extractQwikData } from "./qwik";

const toPatch = (version: string) => version.split(".").slice(0, 2).join(".");

// Riot releases a patch before lolalytics has data for it (lolalytics answers 404 until then),
// so the newest patch that lolalytics itself reports as current is used.
export async function getLolalyticsVersion(versions: string[]) {
    try {
        const res = await retry(() =>
            fetch(`https://lolalytics.com/?tier=${DATASET_TIER}`),
        );
        const state = extractQwikData<{ currentPatch?: string } | undefined>(
            await res.text(),
            (obj) =>
                obj["currentPatch"] !== undefined && obj["page"] !== undefined,
        );

        const version = versions.find(
            (v) => toPatch(v) === state?.currentPatch,
        );
        if (version) {
            return version;
        }

        console.log(
            `Lolalytics patch ${state?.currentPatch} not found, using the newest patch`,
        );
    } catch (e) {
        console.log("Could not get the lolalytics patch, using the newest patch", e);
    }

    return versions[0];
}
