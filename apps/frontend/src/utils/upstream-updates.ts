import { invoke, isTauri } from "@tauri-apps/api/core";
import { createUpstreamUpdatesToast } from "./toast";

type UpstreamCommit = {
    hash: string;
    date: string;
    subject: string;
};

// The day of the last check, the original repository is checked once a day
const CHECKED_KEY = "draftgap-upstream-checked";
// The newest change of the original that the user marked as seen
const SEEN_KEY = "draftgap-upstream-seen";

// The desktop app tells when the original DraftGap has changes this copy does not have yet.
// Bringing them in is done by hand, as they can touch the same files as the changes of this copy.
export async function checkUpstreamUpdatesDaily() {
    if (!isTauri()) return;

    const today = new Date().toDateString();
    if (localStorage.getItem(CHECKED_KEY) === today) return;
    localStorage.setItem(CHECKED_KEY, today);

    try {
        const commits = await invoke<UpstreamCommit[]>(
            "check_upstream_updates",
        );
        if (commits.length === 0) return;
        if (localStorage.getItem(SEEN_KEY) === commits[0].hash) return;

        createUpstreamUpdatesToast(commits, () =>
            localStorage.setItem(SEEN_KEY, commits[0].hash),
        );
    } catch (err) {
        console.warn("Could not check the original DraftGap for changes:", err);
    }
}
