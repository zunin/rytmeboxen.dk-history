export class CDParser {
  private artist: string;
  private albumTitle: string;
  private cdNumber: string;
  private price: string;
  private quality: string;

  constructor(text: string) {
    this.artist = "";
    const artistRemainder = this.setArtist(text);

    this.albumTitle = "";
    const albumTitleRemainder = this.setAlbumTitle(artistRemainder);

    this.cdNumber = "";
    const cdNumberRemainder = this.setCDNumber(albumTitleRemainder);

    this.price = "";
    const priceRemainder = this.setPrice(cdNumberRemainder);

    this.quality = "";
    const qualityRemainder = this.setQuality(priceRemainder);

  }
  private setQuality(priceRemainder: string): string {
    if (!priceRemainder) {
      return priceRemainder;
    }
    this.quality = priceRemainder.trim();;
    return "";  
  }

  private setPrice(cdNumberRemainder: string): string {
    if (!cdNumberRemainder) {
      return cdNumberRemainder;
    }
    const [price, remainder] = cdNumberRemainder?.split(" - ");
    this.price = price.replace("Kr. ", "").trim();;
    return remainder; 
   }

  private setCDNumber(albumTitleRemainder: string): string {
    if (!albumTitleRemainder) {
      return albumTitleRemainder;
    }
    const [cdNumber, ...remainder] = albumTitleRemainder.split(" - ");
    this.cdNumber = cdNumber.replace("Nr. ", "").trim();
    return remainder.join(" - ");  
  }
  
    private setAlbumTitle(artistRemainder: string): string {
    if (!artistRemainder) {
      return artistRemainder;
    }
    const [albumTitle, ...remainder] = artistRemainder.split(" - ");
    this.albumTitle = albumTitle.trim();;
    
    return remainder.join(" - ");
  }

  private setArtist(input: string): string {
    if (!input) {
      return input;
    }
    const [artist, ...remainder] = input.split("**");
    this.artist = artist.trim();
    return remainder.join("**");
  }

  public parse(): {
    artist: string;
    albumTitle: string;
    cdNumber: string;
    price: string;
    quality: string;
  } {
    return {
      artist: this.artist,
      albumTitle: this.albumTitle,
      cdNumber: this.cdNumber,
      price: this.price,
      quality: this.quality,
    };
  }
}
