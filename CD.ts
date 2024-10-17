import type { HistoryEntry } from "./HistoryEntry.ts";

export class CD {
    private readonly lineRegex =
        /(?<artist>.*)\s\*\*\s(?<albumTitle>.*).*\s-\s(?<cdNumber>\d*) -.*(?<price>Kr\. \d*).*(?<quality>K-[1-4])/g;
    formatter: Intl.NumberFormat;

    historyEntry: HistoryEntry | null = null;

    constructor(private text: string, private uri: string) {
        this.formatter = new Intl.NumberFormat("da-DK", {
            style: "currency",
            currency: "DKK",
        });

        const match = this.lineRegex.exec(text);
        if (match) {
            const { artist, albumTitle, cdNumber, price, quality } = match
                ?.groups!;
            const isSingle = artist.startsWith("Single / Maxi  ");

            this.historyEntry = {
                albumTitle,
                artist,
                origin: this.uri,
                price: this.formatter.format(parseFloat(
                    price.replace("Kr. ", "")
                )),
                quality: quality,
                type: isSingle ? "Single" : "Album",
            } as HistoryEntry;
        }
    }

    getHistoryEntry(): HistoryEntry | null {
        return this.historyEntry;
    }
}
