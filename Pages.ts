import { CD } from "./CD.ts";
import { DomClient } from "./DomClient.ts";
import { Settings } from "./Settings.ts";

export class Pages {
  private readonly pages = [
    `${Settings.BASE_URL}/privat-salg.htm`,
    `${Settings.BASE_URL}/privat-salg-2.htm`,
    `${Settings.BASE_URL}/privat-salg-Tilbuds-CDer.htm`,
  ] as const;

  constructor() {}

  private cleanText(text: string): string {
    return text
      .replaceAll("\u00a0", " ")
      .replaceAll("\n", " ")
      .replaceAll("\t", " ")
      .replaceAll(/ +(?= )/g, "")
      .trim();
  }

  async *getPages(): AsyncGenerator<CD> {
    for (const uri of this.pages) {
      const document = await new DomClient(uri).fetchDOM();

      const cds = [...document.getElementsByTagName("*")]
        .map((node) => this.cleanText(node.textContent))
        .filter((text) => text.split("**").length == 2);

      for (const cd of cds) {
        yield new CD(cd, uri);
      }
    }
  }
}
