import { CDParser } from "./CDParser.ts";
import type { HistoryEntry } from "./HistoryEntry.ts";

export class CD {
  formatter: Intl.NumberFormat;

  historyEntry: HistoryEntry | null = null;

  getArtistName(text: string): { artist: string; artistNameRemainder: string } {
    const [artist, artistNameRemainder] = text.split("**");
    return { artist, artistNameRemainder };
  }
  constructor(private text: string, private uri: string) {
    this.formatter = new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
    });

    const { artist, albumTitle, cdNumber, price, quality } = new CDParser(text)
      .parse();

    const isSingle = artist.startsWith("Single / Maxi");
    const isCompliation = cdNumber.startsWith("2");
    const isDiscountCD = cdNumber.startsWith("3");

    this.historyEntry = {
      albumTitle,
      artist,
      origin: `${this.uri}#${cdNumber}`,
      price: this.formatter.format(parseFloat(
        price.replace("Kr. ", ""),
      )),
      quality: quality,
      type: isSingle ? "Single" : "Album",
    } as HistoryEntry;
  }

  getHistoryEntry(): HistoryEntry | null {
    if (!!this.historyEntry && this.historyEntry.price.startsWith("NaN")) {
      return null;
    }
    return this.historyEntry;
  }
}
