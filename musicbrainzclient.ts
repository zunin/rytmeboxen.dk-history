import { IArtistMatch, MusicBrainzApi } from "musicbrainz-api";
import { HistoryEntry } from "./HistoryEntry.ts";
import { compareSimilarity } from "jsr:@std/text";
import { delay } from "@std/async/delay";

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

    const artists = await this.getArtists(entry.artist);

    for (const artist of artists) {
      const hit = await this.queryArtistForReleaseGroup(entry, artist);
      if (hit !== null) {
        console.table(
          [entry, hit["musicbrainz"]],
          ["albumTitle", "artist", "type"] as Array<
            keyof HistoryEntry
          >,
        );
        return hit;
      }
    }

    return {
      ...entry,
      musicbrainz: {}
    };
  }

  private async queryArtistForReleaseGroup(
    entry: HistoryEntry,
    artist: IArtistMatch,
  ): Promise<HistoryEntry | null> {
    const artistQuery = [`artist:"${artist.name}"`]
      .join(" OR ");

    const aliasArtistQuery = [
      ...new Set(
        artist.aliases?.map((alias) =>
          `title:"${
            entry.albumTitle.toUpperCase().replaceAll(
              alias.name.toUpperCase(),
              artist.name.toUpperCase(),
            )
          }"`
        ) ?? [],
      ),
    ];

    const titleQuery = [
      ...new Set([`title:"${entry.albumTitle}"`]
        .concat(aliasArtistQuery)),
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
      const sortedReleaseGroupSearchResult =
        releaseGroupSearchResult["release-groups"].sort((a, b) => {
          return b.score - a.score ||
            compareSimilarity(entry.albumTitle)(a.title, b.title);
        });

      const [searchResult] = sortedReleaseGroupSearchResult;
      searchResult["primary-type"];
      if (searchResult) {
        await delay(200);
        const hit = {
          ...entry,
          musicbrainz: {
            releaseGroupId: searchResult.id,
            albumTitle: ["No Title", "(No Title)", "unknown", "[unknown]"]
                .some((ignoredTitle) => ignoredTitle === searchResult.title)
              ? entry.albumTitle
              : searchResult.title,
            artist: searchResult["artist-credit"].map((x) => x.artist.name)
              .join(
                ", ",
              ),
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
          return await this.queryArtistForReleaseGroup({
            ...entry,
            albumTitle: cleanedTitle,
          }, artist);
        }
      }
    } catch (_) { /* Empty */ }
    return null;
  }

  private async getArtists(cdArtist: string): Promise<IArtistMatch[]> {
    const mbArtistSearchResult = await this.mbApi.search("artist", {
      query: cdArtist,
      limit: 20,
    });
    const artists = mbArtistSearchResult["artists"] ?? [];

    return artists.map((a) => a.name).sort(
      compareSimilarity(cdArtist),
    ).map((name) => artists.filter((a) => a.name === name)[0]);
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
