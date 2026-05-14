export interface HistoryEntry {
  artist: string;
  albumTitle: string;
  price: string;
  origin: string;
  quality: string | "unknown";
  type: string;
  musicbrainz?: {
    releaseGroupId?: string;
    artist?: string;
    albumTitle?: string;
    type?: string;
  }
}
  