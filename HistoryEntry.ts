export interface HistoryEntry {
    artist: string;
    albumTitle: string;
    price: string;
    origin: string;
    quality: string | unknown;
    type: "Album" | "Single"
  }
  