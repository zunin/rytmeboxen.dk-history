import { IArtistMatch, MusicBrainzApi } from "musicbrainz-api";
import { HistoryEntry } from "./HistoryEntry.ts";
import { compareSimilarity } from "jsr:@std/text";
import { delay } from "@std/async/delay";

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Check if an error is a transient network error that should be retried.
 */
function isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        return (
            message.includes("connection error") ||
            message.includes("peer closed connection") ||
            message.includes("unexpected-eof") ||
            message.includes("network") ||
            message.includes("timeout") ||
            message.includes("econnreset") ||
            message.includes("econnrefused")
        );
    }
    return false;
}

/**
 * Retry a function with exponential backoff for transient errors.
 */
async function withRetry<T>(fn: () => Promise<T>, context: string): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (!isRetryableError(error)) {
                throw error;
            }
            if (attempt < MAX_RETRIES) {
                const delayMs =
                    INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                console.warn(
                    `[${context}] Transient error on attempt ${attempt}/${MAX_RETRIES}, retrying in ${delayMs}ms:`,
                    error instanceof Error ? error.message : String(error),
                );
                await delay(delayMs);
            }
        }
    }
    throw lastError;
}

export class MusicBrainzClient {
    private mbApi: MusicBrainzApi;

    constructor() {
        this.mbApi = new MusicBrainzApi({
            appName: "rytmeboxen.dk-history",
            appVersion: "0.0.1",
            appContactInfo: "https://github.com/zunin/rytmeboxen.dk-history",
        });
    }

    async ensureMusicBrainzMetaData(
        entry: HistoryEntry,
    ): Promise<HistoryEntry> {
        if (entry.musicbrainz !== undefined) {
            return entry;
        }

        const key = `${entry.artist} - ${entry.albumTitle}`;

        try {
            const artists = await withRetry(
                () => this.getArtists(entry.artist),
                `ensureMusicBrainzMetaData("${key}")`,
            );

            for (const artist of artists) {
                const hit = await this.queryArtistForReleaseGroup(
                    entry,
                    artist,
                );
                if (hit !== null) {
                    console.table([entry, hit["musicbrainz"]], [
                        "albumTitle",
                        "artist",
                        "type",
                    ] as Array<keyof HistoryEntry>);
                    return hit;
                }
            }

            return {
                ...entry,
                musicbrainz: {},
            };
        } catch (error) {
            console.error(
                `[ensureMusicBrainzMetaData("${key}")] Failed to fetch MusicBrainz data after retries, continuing with empty metadata:`,
                error instanceof Error ? error.message : String(error),
            );
            return {
                ...entry,
                musicbrainz: {},
            };
        }
    }

    private async queryArtistForReleaseGroup(
        entry: HistoryEntry,
        artist: IArtistMatch,
    ): Promise<HistoryEntry | null> {
        const artistQuery = [`artist:"${artist.name}"`].join(" OR ");

        const aliasArtistQuery = [
            ...new Set(
                artist.aliases?.map(
                    (alias) =>
                        `title:"${entry.albumTitle
                            .toUpperCase()
                            .replaceAll(
                                alias.name.toUpperCase(),
                                artist.name.toUpperCase(),
                            )}"`,
                ) ?? [],
            ),
        ];

        const titleQuery = [
            ...new Set(
                [`title:"${entry.albumTitle}"`].concat(aliasArtistQuery),
            ),
        ].join(" OR ");

        let query = `(${titleQuery}) AND (${artistQuery})`;
        if (
            !entry.albumTitle.toLowerCase().includes("(single)") &&
            !entry.albumTitle.toLowerCase().includes("(single cd)")
        ) {
            query += ` AND type:Album`;
        }

        try {
            const releaseGroupSearchResult = await this.mbApi.search(
                "release-group",
                { query },
            );
            const sortedReleaseGroupSearchResult = releaseGroupSearchResult[
                "release-groups"
            ].sort((a, b) => {
                return (
                    b.score - a.score ||
                    compareSimilarity(entry.albumTitle)(a.title, b.title)
                );
            });

            const [searchResult] = sortedReleaseGroupSearchResult;
            searchResult["primary-type"];
            if (searchResult && searchResult.score >= 70) {
                const matchedArtist = searchResult["artist-credit"]
                    .map((x) => x.artist.name)
                    .join(", ");
                
                if (matchedArtist === "Various Artists" || matchedArtist === "[unknown]") {
                    console.warn(
                        `[queryArtistForReleaseGroup] Skipping generic artist "${matchedArtist}" for "${entry.artist}"`,
                    );
                    return null;
                }
                
                const isArtistMatch = this.isArtistMatch(entry.artist, artist);
                if (!isArtistMatch) {
                    console.warn(
                        `[queryArtistForReleaseGroup] Artist mismatch: "${entry.artist}" vs "${matchedArtist}", skipping`,
                    );
                    return null;
                }
                await delay(200);
                const hit = {
                    ...entry,
                    musicbrainz: {
                        releaseGroupId: searchResult.id,
                        albumTitle: [
                            "No Title",
                            "(No Title)",
                            "unknown",
                            "[unknown]",
                        ].some(
                            (ignoredTitle) =>
                                ignoredTitle === searchResult.title,
                        )
                            ? entry.albumTitle
                            : searchResult.title,
                        artist: searchResult["artist-credit"]
                            .map((x) => x.artist.name)
                            .join(", "),
                        type: searchResult["primary-type"],
                    },
                } as HistoryEntry;
                return hit;
            } else {
                const titleCleaningStrategies: Array<TitleCleaningStrategy> = [
                    new CDParenthesisCleaningStrategy(),
                    new ParanthesisEndCleaningStrategy(),
                ];
                const cleanedTitle = titleCleaningStrategies.reduce(
                    (text, strategy) => {
                        if (strategy.canClean(text)) {
                            return strategy.clean(text);
                        }
                        return text;
                    },
                    entry.albumTitle,
                );

                if (cleanedTitle !== entry.albumTitle) {
                    return await this.queryArtistForReleaseGroup(
                        {
                            ...entry,
                            albumTitle: cleanedTitle,
                        },
                        artist,
                    );
                }
            }
        } catch (_) {
            /* Empty */
        }
        return null;
    }

    private async getArtists(cdArtist: string): Promise<IArtistMatch[]> {
        const mbArtistSearchResult = await this.mbApi.search("artist", {
            query: cdArtist,
            limit: 20,
        });
        const artists = mbArtistSearchResult["artists"] ?? [];

        return artists
            .map((a) => a.name)
            .sort(compareSimilarity(cdArtist))
            .map((name) => artists.filter((a) => a.name === name)[0]);
    }

    private isArtistMatch(entryArtist: string, artist: IArtistMatch): boolean {
        const normalize = (str: string) =>
            str
                .toUpperCase()
                .trim()
                .replace(/[-‐‑−–—]/g, "-")
                .replace(/\s+/g, " ")
                .replace(/\b&\b/g, " AND ")
                .replace(/'/g, "");
        
        const normalizedEntry = normalize(entryArtist);
        const normalizedArtistName = normalize(artist.name);
        
        if (normalizedEntry === normalizedArtistName) {
            return true;
        }
        
        if (normalizedEntry.includes(normalizedArtistName) || normalizedArtistName.includes(normalizedEntry)) {
            return true;
        }
        
        const aliases = artist.aliases ?? [];
        for (const alias of aliases) {
            const normalizedAlias = normalize(alias.name);
            if (normalizedEntry === normalizedAlias) {
                return true;
            }
            if (normalizedEntry.includes(normalizedAlias) || normalizedAlias.includes(normalizedEntry)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Check if the scrape should stop entirely due to a fatal error.
     * Non-retryable errors (e.g., API authentication failures) should stop the scrape.
     */
    private isFatalError(error: unknown): boolean {
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            // Authentication or rate-limit errors that won't resolve with retry
            if (message.includes("401") || message.includes("403")) {
                return true;
            }
        }
        return false;
    }
}

interface TitleCleaningStrategy {
    canClean(title: string): boolean;
    clean(title: string): string;
}

class ParanthesisEndCleaningStrategy implements TitleCleaningStrategy {
    private regex = /\(.*\)$/g;

    canClean(title: string): boolean {
        const match = title.match(this.regex);

        return match !== null && match.length > 0;
    }
    clean(title: string): string {
        return title.replaceAll(this.regex, "");
    }
}

class CDParenthesisCleaningStrategy implements TitleCleaningStrategy {
    private regex = /\(\d?CD.*\)/gi;

    canClean(title: string): boolean {
        const match = title.match(this.regex);

        return match !== null && match.length > 0;
    }
    clean(title: string): string {
        return title.replaceAll(this.regex, "");
    }
}
