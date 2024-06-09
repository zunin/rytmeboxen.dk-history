import { DOMParser, HTMLDocument, Element } from 'https://deno.land/x/deno_dom/deno-dom-wasm.ts';
import { sleep } from "./sleep.ts"

const settings = {
    BASE_URL: "http://rytmeboxen.dk"
}

async function fetchDOM(url: string): Promise<HTMLDocument> {
    const response = await fetch(url);
    await sleep(1000);
    console.log(url)
    const arrayBuffer = await response.arrayBuffer();
    const html = new TextDecoder("iso-8859-10").decode(new Uint8Array(arrayBuffer))
    return new DOMParser().parseFromString(html, 'text/html');
}

function cleanText(text: string): string {
    return text
        .replaceAll("\u00a0", " ")
        .replaceAll("\n", " ")
        .replaceAll("\t", " ")
        .replaceAll(/ +(?= )/g,'')
        .trim()
 }

const pages = [
    `${settings.BASE_URL}/privat-salg.htm`,
    `${settings.BASE_URL}/privat-salg-2.htm`,
    `${settings.BASE_URL}/privat-salg-Tilbuds-CDer.htm`
]
let cds: string[] = [];

for(const uri of pages) {
    const document = await fetchDOM(uri);
    cds = cds.concat([...document.getElementsByTagName('*')]
        .map(node => cleanText(node.textContent))
        .filter(text => text.split("**").length == 2))
    
}


const lineRegex = /(?<artist>.*)\s\*\*\s(?<albumTitle>.*).*\s-\s(?<cdNumber>\d*) -.*(?<price>Kr\. \d*).*(?<quality>K-[1-4])/g

const lookupList = cds.map(text => {return {
        match: lineRegex.exec(text)?.groups,
        input: text
    }})
    .filter(({input, match}) => match && input.startsWith(match["artist"]))
    .map(({match}) => match!)
    .map(({artist, albumTitle, cdNumber, price, quality}) => {
        const isSingle = artist.startsWith("Single / Maxi  ");
        return {
            artist: artist.replace("Single / Maxi  ", ""),
            albumTitle: albumTitle,
            type: isSingle ? "Single" : "Album",
            price: parseInt(`${price}`.replace("Kr. ", "")),
            quality: quality
        } as HistoryEntry
    })
 
 interface HistoryEntry {
    artist: string;
    albumTitle: string;
    price: number;
    quality: string
}


Deno.writeTextFile("./cds.json", JSON.stringify(lookupList, null, '\t'));