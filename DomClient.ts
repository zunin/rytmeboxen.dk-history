import { DOMParser, HTMLDocument } from 'https://deno.land/x/deno_dom/deno-dom-wasm.ts';
import { delay } from "@std/async/delay";

export class DomClient {
    constructor(private url: string) {}

    async fetchDOM(): Promise<HTMLDocument> {
        const response = await fetch(this.url);
        await delay(1000);
        console.log(this.url)
        const arrayBuffer = await response.arrayBuffer();
        const html = new TextDecoder("iso-8859-10").decode(new Uint8Array(arrayBuffer))
        return new DOMParser().parseFromString(html, 'text/html');
    }
}
