import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUNGIE_API_KEY = process.env.VITE_BUNGIE_API_KEY || process.env.BUNGIE_API_KEY;
if (!BUNGIE_API_KEY) throw new Error("Missing VITE_BUNGIE_API_KEY in .env");

const GODROLL_DATABASE_URL = process.env.VITE_GODROLL_DATABASE_URL || process.env.GODROLL_DATABASE_URL;
if (!GODROLL_DATABASE_URL) throw new Error("Missing VITE_GODROLL_DATABASE_URL in .env");

const MANIFEST_URL = 'https://www.bungie.net/Platform/Destiny2/Manifest/';
const BUNGIE_BASE = 'https://www.bungie.net';

async function fetchLanguageSubset(langCode, hashes, manifestMeta) {
    const itemDefPath = manifestMeta.Response.jsonWorldComponentContentPaths[langCode].DestinyInventoryItemDefinition;
    const collDefPath = manifestMeta.Response.jsonWorldComponentContentPaths[langCode].DestinyCollectibleDefinition;
    console.log(`Downloading ${langCode} Definitions...`);
    
    const [resItems, resColls] = await Promise.all([
      fetch(`${BUNGIE_BASE}${itemDefPath}`),
      fetch(`${BUNGIE_BASE}${collDefPath}`)
    ]);
    
    const itemDefs = await resItems.json();
    const collDefs = await resColls.json();
    
    const subset = {};
    for (const hash of hashes) {
        const item = itemDefs[hash];
        if (item) {
            let sourceStr = null;
            if (item.collectibleHash && collDefs[item.collectibleHash]) {
                sourceStr = collDefs[item.collectibleHash].sourceString || null;
                if (sourceStr && sourceStr.startsWith("Source: ")) sourceStr = sourceStr.substring(8);
                if (sourceStr && sourceStr.startsWith("Quelle: ")) sourceStr = sourceStr.substring(8);
            }
            
            subset[hash] = {
                name: item.displayProperties?.name || "Unknown",
                description: item.flavorText || item.displayProperties?.description || "",
                icon: item.displayProperties?.icon ? `${BUNGIE_BASE}${item.displayProperties.icon}` : null,
                screenshot: item.screenshot ? `${BUNGIE_BASE}${item.screenshot}` : null,
                itemTypeDisplayName: item.itemTypeDisplayName,
                equippingBlock: item.equippingBlock ? { ammoType: item.equippingBlock.ammoType } : null,
                source: sourceStr,
                traitIds: item.traitIds || []
            };
        }
    }
    return subset;
}

async function updateManifest() {
    console.log("Fetching God Rolls from Godroll Database...");
    const url = GODROLL_DATABASE_URL;
    if (!url) throw new Error("Missing GODROLL_DATABASE_URL in .env");
    const rollsRes = await fetch(url);
    const rollsData = await rollsRes.json();
    
    // Collect all hashes into a Set
    const hashes = new Set();
    const entries = rollsData.entries || rollsData.data || [];
    
    for (const roll of entries) {
        const itemHash = roll.itemHash || roll.hash;
        if (itemHash) hashes.add(itemHash.toString());
        
        const perks = roll.perkHashes || roll.plugs || [];
        if (Array.isArray(perks)) {
            perks.flat().forEach(p => {
                if (p) hashes.add(p.toString());
            });
        }
    }
    
    console.log(`Found ${hashes.size} unique hashes in the Godroll Database.`);

    console.log("Fetching Destiny 2 Manifest...");
    const manifestRes = await fetch(MANIFEST_URL);
    const manifestMeta = await manifestRes.json();
    
    const dataEN = await fetchLanguageSubset('en', hashes, manifestMeta);
    const dataDE = await fetchLanguageSubset('de', hashes, manifestMeta);

    const finalData = {
        en: dataEN,
        de: dataDE
    };

    const outputPath = path.join(__dirname, '../public/destinyData.json');
    fs.writeFileSync(outputPath, JSON.stringify(finalData, null, 2));
    console.log(`Successfully wrote grouped EN/DE data to public/destinyData.json`);
}

updateManifest().catch(console.error);
