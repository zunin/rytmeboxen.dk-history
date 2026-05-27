import type { HistoryEntry } from "./HistoryEntry.ts";
import { Pages } from "./Pages.ts";
import { MusicBrainzClient } from "./musicbrainzclient.ts";

// Read cached data if it exists
let cachedCDs: Array<HistoryEntry> = [];
try {
    const cachedCDText = await Deno.readTextFile("./cds.json");
    cachedCDs = JSON.parse(cachedCDText);
} catch (_) {
    // File doesn't exist yet, start with empty cache
}

// Create lookup map by artist+album for efficient caching
const cachedCDMap = new Map<string, HistoryEntry>();
for (const cd of cachedCDs) {
    cachedCDMap.set(`${cd.artist}||${cd.albumTitle}`, cd);
}

const lookupList: Array<HistoryEntry> = [];
const mbClient = new MusicBrainzClient();

for await (const cd of new Pages().getPages()) {
    const entry = cd.getHistoryEntry();
    if (entry !== null) {
        // Check if we already have this CD cached with MusicBrainz data
        const cachedEntry = cachedCDMap.get(
            `${entry.artist}||${entry.albumTitle}`,
        );
        if (cachedEntry?.musicbrainz !== undefined) {
            // Use cached entry with MusicBrainz data
            lookupList.push(cachedEntry);
        } else {
            // Enrich with MusicBrainz data
            const enrichedEntry =
                await mbClient.ensureMusicBrainzMetaData(entry);
            lookupList.push(enrichedEntry);
        }
    }
}

console.log(lookupList);
Deno.writeTextFile("./cds.json", JSON.stringify(lookupList, null, "\t"));
