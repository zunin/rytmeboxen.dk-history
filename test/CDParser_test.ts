import { assertEquals } from "@std/assert";
import { CDParser } from "../CDParser.ts";

Deno.test("can parse artist", () => {
  const cdParser = new CDParser(
    " B-Boys ** Vores Verden - Nr. 12411014 - Kr. 10 - K-3 ",
  );
  assertEquals("B-Boys", cdParser.parse().artist);
});

Deno.test("can parse album title", () => {
  const cdParser = new CDParser(
    " B-Boys ** Vores Verden - Nr. 12411014 - Kr. 10 - K-3 ",
  );
  assertEquals("Vores Verden", cdParser.parse().albumTitle);
});
Deno.test("can parse cd number", () => {
  const cdParser = new CDParser(
    " B-Boys ** Vores Verden - Nr. 12411014 - Kr. 10 - K-3 ",
  );
  assertEquals("12411014", cdParser.parse().cdNumber);
});
Deno.test("can parse price", () => {
  const cdParser = new CDParser(
    " B-Boys ** Vores Verden - Nr. 12411014 - Kr. 10 - K-3 ",
  );
  assertEquals("10", cdParser.parse().price);
});
Deno.test("can parse quality", () => {
  const cdParser = new CDParser(
    " B-Boys ** Vores Verden - Nr. 12411014 - Kr. 10 - K-3 ",
  );
  assertEquals("K-3", cdParser.parse().quality);
});
