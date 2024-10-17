import type { HistoryEntry } from "./HistoryEntry.ts";
import { Pages } from "./Pages.ts";

const lookupList: Array<HistoryEntry> = [];
for await (const cd of new Pages().getPages()) {
    const entry = cd.getHistoryEntry();
    if (entry !== null) {
        lookupList.push(entry);

    }
}

Deno.writeTextFile("./cds.json", JSON.stringify(lookupList, null, "\t"));
