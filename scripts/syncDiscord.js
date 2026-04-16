import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DISCORD HTTP CONFIG
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
if (!WEBHOOK_URL) throw new Error("Missing DISCORD_WEBHOOK_URL in .env");

const STATE_FILE = path.join(__dirname, '../data/discordState.json');
const MANIFEST_FILE = path.join(__dirname, '../public/destinyData.json');

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Reconstructs a 5-column layout from a flat list of perks using manifest types.
 */
function reconstructPerkColumns(perkHashes, manifest) {
    const columns = [[], [], [], [], []];
    const seen = new Set();

    perkHashes.forEach(hash => {
        if (seen.has(hash)) return;
        seen.add(hash);

        const data = manifest[hash] || {};
        const type = (data.itemTypeDisplayName || "").toLowerCase();

        if (type.includes("barrel") || type.includes("sight") || type.includes("scope") || type.includes("frame") || type.includes("intrinsic") || type.includes("arrow") || type.includes("haft")) {
            columns[0].push(hash);
        } else if (type.includes("magazine") || type.includes("battery") || type.includes("guard") || type.includes("arrow shaft")) {
            columns[1].push(hash);
        } else if (type.includes("trait")) {
            if (columns[2].length === 0) {
                columns[2].push(hash);
            } else if (columns[3].length === 0) {
                columns[3].push(hash);
            } else {
                // Fallback for more than 2 traits
                columns[3].push(hash);
            }
        } else {
            // Origin Traits, Masterworks, etc.
            columns[4].push(hash);
        }
    });

    return columns;
}

/**
 * Extracts a numeric version score from Destiny 2 release trait IDs.
 * Format: releases.vXXX.Y -> XXX
 */
function getVersionScore(traitIds) {
    if (!traitIds) return 0;
    const releaseTrait = traitIds.find(t => t.startsWith('releases.v'));
    if (!releaseTrait) return 0;
    const match = releaseTrait.match(/v(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

async function runDiscordSync() {
    const targetSearch = process.argv[2];

    console.log("Loading Local Manifest...");
    if (!fs.existsSync(MANIFEST_FILE)) {
        console.error("No destinyData.json found! Run 'npm run sync' first.");
        return;
    }

    const manifestData = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
    let discordState = {};
    if (fs.existsSync(STATE_FILE)) {
        discordState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }

    console.log("Fetching God Rolls from Godroll Database...");
    const url = process.env.VITE_GODROLL_DATABASE_URL || process.env.GODROLL_DATABASE_URL;
    if (!url) throw new Error("Missing VITE_GODROLL_DATABASE_URL in .env");
    const rollsRes = await fetch(url);
    const rollsData = await rollsRes.json();

    if (!rollsData || !rollsData.entries) {
        console.error("Failed to fetch Godroll Database JSON (no entries found).");
        return;
    }

    // GROUPING LOGIC (Identical to Frontend)
    const groupedMap = new Map();
    rollsData.entries.forEach((roll) => {
        const rawHash = roll.itemHash || roll.hash;
        const rawName = manifestData.en[rawHash]?.name || roll.name || "Unknown";
        const baseName = rawName.replace(/\s*\(Adept\)|\s*\(Harrowed\)|\s*\(Timelost\)|\s*\(Baroque\)/g, '').trim();
        
        if (!groupedMap.has(baseName)) {
            groupedMap.set(baseName, {
                id: rawHash.toString(),
                baseName,
                hash: rawHash,
                hashes: new Set(),
                tags: new Set(),
                rolls: []
            });
        }
        
        const weaponGroup = groupedMap.get(baseName);
        weaponGroup.hashes.add(rawHash);
        
        // Pick the newest version as representative. If same version, pick Adept.
        const currentRef = manifestData.en[weaponGroup.hash] || {};
        const thisRef = manifestData.en[rawHash] || {};
        
        const currentScore = getVersionScore(currentRef.traitIds);
        const thisScore = getVersionScore(thisRef.traitIds);
        const currentIsAdept = (currentRef.name || "").includes("(Adept)");
        const thisIsAdept = (thisRef.name || "").includes("(Adept)");

        let shouldSwap = false;
        if (thisScore > currentScore) {
            shouldSwap = true;
        } else if (thisScore === currentScore) {
            if (thisIsAdept && !currentIsAdept) {
                shouldSwap = true;
            }
        }

        if (shouldSwap) {
            weaponGroup.hash = rawHash;
            weaponGroup.id = rawHash.toString();
        }

        roll.tags?.forEach(t => weaponGroup.tags.add(t));
        
        const normalizedRoll = {
            ...roll,
            hash: rawHash,
            plugs: roll.perkHashes || roll.plugs || []
        };

        if (!weaponGroup.rolls.some(r => 
            JSON.stringify(r.plugs) === JSON.stringify(normalizedRoll.plugs) && 
            r.notes === normalizedRoll.notes
        )) {
            weaponGroup.rolls.push(normalizedRoll);
        }
    });
    
    // Final Roll Sorting inside each weapon group (Newest version first)
    groupedMap.forEach(group => {
        group.rolls.sort((a, b) => {
            const dataA = manifestData.en[a.hash] || {};
            const dataB = manifestData.en[b.hash] || {};
            const scoreA = getVersionScore(dataA.traitIds);
            const scoreB = getVersionScore(dataB.traitIds);
            return scoreB - scoreA;
        });
    });

    let finalWeapons = Array.from(groupedMap.values());
    
    if (targetSearch) {
        finalWeapons = finalWeapons.filter(w => 
            w.baseName.toLowerCase().includes(targetSearch.toLowerCase()) || 
            w.hash.toString() === targetSearch
        );
        console.log(`Filtering for "${targetSearch}": Found ${finalWeapons.length} matching weapons.`);
    }

    console.log(`Checking ${finalWeapons.length} grouped weapons to sync to Discord...`);

    console.log("Starting Puppeteer engine for Image Generation...");
    const browser = await puppeteer.launch({ 
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    // Vastly increased width to avoid clipping the 5 columns, high deviceScaleFactor for crispness!
    await page.setViewport({ width: 1450, height: 3000, deviceScaleFactor: 2 }); 

    let postedCount = 0;
    let patchedCount = 0;

    for (const weapon of finalWeapons) {
        const enData = manifestData.en[weapon.hash] || {};
        const deData = manifestData.de[weapon.hash] || {};
        
        const enName = enData.name || weapon.baseName;
        const deName = deData.name || enName;
        
        const screenshot = enData.screenshot;
        const icon = enData.icon;
        let flavorText = deData.description || enData.description || "";
        
        // AGGREGATE SOURCES FROM ALL VARIANTS, SORTED BY NEWEST VERSION
        const sourcesWithMaxScoreDe = new Map(); // source -> maxVersionScore
        const sourcesWithMaxScoreEn = new Map(); // source -> maxVersionScore
        
        weapon.hashes.forEach(h => {
            const d = manifestData.de[h] || {};
            const e = manifestData.en[h] || {};
            const score = getVersionScore(d.traitIds || e.traitIds);

            if (d.source) d.source.split(/,| und | and /).forEach(s => {
                const trimmed = s.trim().replace(/^"|"$/g, '');
                if (trimmed) {
                    const existing = sourcesWithMaxScoreDe.get(trimmed) || 0;
                    if (score >= existing) sourcesWithMaxScoreDe.set(trimmed, score);
                }
            });
            if (e.source) e.source.split(/,| and | und /).forEach(s => {
                const trimmed = s.trim().replace(/^"|"$/g, '');
                if (trimmed) {
                    const existing = sourcesWithMaxScoreEn.get(trimmed) || 0;
                    if (score >= existing) sourcesWithMaxScoreEn.set(trimmed, score);
                }
            });
        });

        // Convert to sorted arrays (descending by version score)
        const sortedSourcesDe = Array.from(sourcesWithMaxScoreDe.entries())
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);
        const sortedSourcesEn = Array.from(sourcesWithMaxScoreEn.entries())
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);

        const sourceTagsDe = sortedSourcesDe.map(s => `<span class="source-tag">🎯 ${s}</span>`).join(' ');
        const sourceTagsEn = sortedSourcesEn.map(s => `<span class="source-tag">🎯 ${s}</span>`).join(' ');
        
        const threadTitle = deName !== enName ? `${deName} / ${enName}` : deName;

        // Hasher for detecting updates: We hash the unique rolls/perks. Add a layout version string to force updates!
        const hashPayloadStr = JSON.stringify(weapon.rolls) + deName + flavorText + "_v6";
        const currentHash = crypto.createHash('md5').update(hashPayloadStr).digest('hex');
        
        const cached = discordState[weapon.hash];
        
        // Skip updating entirely if the dataset hasn't chemically changed since the last known sync
        if (cached && cached.hash === currentHash) {
             continue; // No changes since last sync
        }

        // --- BUILD HTML FOR PUPPETEER ---
        let deRollsHtml = "";
        let enRollsHtml = "";
        
        weapon.rolls.forEach((r) => {
           let rNameDe = (r.tags && r.tags.includes("GodPVE")) ? "PVE God Roll" : (r.tags && r.tags.includes("GodPVP")) ? "PVP God Roll" : "God Roll";
           let rNameEn = (r.tags && r.tags.includes("GodPVE")) ? "PVE God Roll" : (r.tags && r.tags.includes("GodPVP")) ? "PVP God Roll" : "God Roll";
           
           if (r.notes) {
               rNameDe += ` (${r.notes})`;
               rNameEn += ` (${r.notes})`;
           }

           let titleColor = rNameDe.includes("PVE") ? "#06b6d4" : rNameDe.includes("PVP") ? "#ef4444" : "#fbbf24";

           deRollsHtml += `<h2 style="color: ${titleColor}; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; margin-top: 30px; margin-bottom: 15px; text-shadow: 0 0 12px ${titleColor}88;">${rNameDe}</h2>`;
           deRollsHtml += `<div style="display: flex; gap: 12px; margin-bottom: 20px;">`;
           
           enRollsHtml += `<h2 style="color: ${titleColor}; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; margin-top: 30px; margin-bottom: 15px; text-shadow: 0 0 12px ${titleColor}88;">${rNameEn}</h2>`;
           enRollsHtml += `<div style="display: flex; gap: 12px; margin-bottom: 20px;">`;
           
           // If plugs is flat (from perkHashes), reconstruct it to 2D
           const plugs2D = Array.isArray(r.plugs[0]) ? r.plugs : reconstructPerkColumns(r.plugs, manifestData.en);

           plugs2D.forEach((col, idx) => {
               const firstPlug = col[0];
                const perkDeData = manifestData.de[firstPlug] || {};
                const perkEnData = manifestData.en[firstPlug] || {};
                
                let slotTypeDe = perkDeData.itemTypeDisplayName;
                let slotTypeEn = perkEnData.itemTypeDisplayName;
                
                const lowerNameDe = (perkDeData.name || "").toLowerCase();
                const lowerNameEn = (perkEnData.name || "").toLowerCase();

                const isMwDe = lowerNameDe.includes("meisterwerk") || lowerNameDe.includes("masterwork");
                const isMwEn = lowerNameEn.includes("masterwork") || lowerNameEn.includes("meisterwerk");

                if (isMwDe || idx === 5) {
                    slotTypeDe = slotTypeDe || "Meisterwerk";
                }
                if (isMwEn || idx === 5) {
                    slotTypeEn = slotTypeEn || "Masterwork";
                }

                slotTypeDe = slotTypeDe || `Slot ${idx+1}`;
                slotTypeEn = slotTypeEn || `Slot ${idx+1}`;

               // DE Column
               deRollsHtml += `<div style="flex: 1; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 12px; box-shadow: inset 0 4px 20px rgba(0,0,0,0.2);">`;
               deRollsHtml += `<h3 style="margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: #cbd5e1; text-align: center; min-height: 38px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px;">${slotTypeDe}</h3>`;
               
               // EN Column
               enRollsHtml += `<div style="flex: 1; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 12px; box-shadow: inset 0 4px 20px rgba(0,0,0,0.2);">`;
               enRollsHtml += `<h3 style="margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: #cbd5e1; text-align: center; min-height: 38px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px;">${slotTypeEn}</h3>`;
               
               let seenPerks = new Set();
               let isFirst = true;
               col.forEach(plugHash => {
                   let nameDe = manifestData.de[plugHash]?.name;
                   let nameEn = manifestData.en[plugHash]?.name;
                   // Use en as fallback if de name is missing
                   if (!nameDe && nameEn) nameDe = nameEn;
                   if (!nameDe || seenPerks.has(nameDe)) return;
                   
                   seenPerks.add(nameDe);

                   let perkIconUrl = manifestData.en[plugHash]?.icon;
                   let isGodRoll = isFirst;
                   let iconBorder = isGodRoll ? '#fbbf24' : 'rgba(255,255,255,0.2)';
                   let iconTag = perkIconUrl ? `<img src="${perkIconUrl}" style="width: 44px; height: 44px; border-radius: 50%; background: rgba(0,0,0,0.5); border: 2px solid ${iconBorder}; object-fit: contain;">` 
                                             : `<div style="width:44px; height:44px; background:rgba(0,0,0,0.5); border-radius:50%; border: 2px solid ${iconBorder};"></div>`;

                   let borderColor = isGodRoll ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255,255,255,0.05)';
                   let boxBg = isGodRoll ? 'rgba(245,158,11,0.12)' : 'rgba(0,0,0,0.2)';
                   let glowBox = isGodRoll ? 'box-shadow: 0 0 16px rgba(245,158,11,0.2), inset 0 0 8px rgba(245,158,11,0.1);' : '';

                   // Glassmorphism Perk Box (Rounded 'Pill' Style)
                   deRollsHtml += `
                   <div style="display: flex; align-items: center; gap: 12px; background: ${boxBg}; padding: 6px 14px 6px 6px; border-radius: 50px; margin-bottom: 8px; border: 1px solid ${borderColor}; height: 64px; ${glowBox} backdrop-filter: blur(8px);">
                       ${iconTag}
                       <span style="display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; font-size: 12.5px; line-height: 1.25; font-weight: 600; color: #f8fafc; word-break: break-word; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">${nameDe}</span>
                   </div>`;
                   
                   enRollsHtml += `
                   <div style="display: flex; align-items: center; gap: 12px; background: ${boxBg}; padding: 6px 14px 6px 6px; border-radius: 50px; margin-bottom: 8px; border: 1px solid ${borderColor}; height: 64px; ${glowBox} backdrop-filter: blur(8px);">
                       ${iconTag}
                       <span style="display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; font-size: 12.5px; line-height: 1.25; font-weight: 600; color: #f8fafc; word-break: break-word; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">${nameEn}</span>
                   </div>`;
                   
                   isFirst = false;
               });

               deRollsHtml += `</div>`;
               enRollsHtml += `</div>`;
           });
           
           deRollsHtml += `</div>`;
           enRollsHtml += `</div>`;
        });

        if (!deRollsHtml) continue;

        const htmlStr = `
        <!DOCTYPE html>
        <html>
        <head>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
            <style>
                * { box-sizing: border-box; }
                body { font-family: 'Inter', sans-serif; margin: 0; padding: 20px; background: #000; }
                
                .container { background-color: #050a14; color: white; border-radius: 16px; overflow: hidden; width: 1400px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); margin-bottom: 40px; background-size: 100% auto; background-position: center -80px; background-repeat: no-repeat; position: relative; }
                .hero { height: 450px; position: relative; }
                .hero-overlay { position: absolute; bottom: 0; left: 0; width: 100%; background: linear-gradient(transparent, rgba(15,23,42,0.85) 100%); padding: 30px 24px 20px 24px; display: flex; align-items: flex-end; gap: 20px; }
                .hero-overlay img { width: 84px; height: 84px; border-radius: 12px; border: 3px solid rgba(255,255,255,0.8); box-shadow: 0 4px 12px rgba(0,0,0,0.8); }
                .hero-overlay h1 { margin: 0 0 5px 0; font-size: 42px; font-weight: 800; text-shadow: 2px 2px 6px rgba(0,0,0,1); }
                .hero-overlay p { margin: 0; font-size: 16px; color: #cbd5e1; font-style: italic; max-width: 800px; text-shadow: 1px 1px 3px rgba(0,0,0,1); }
                .source-tag { display: inline-block; margin-top: 8px; background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; color: #f8fafc; border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(4px); box-shadow: 0 2px 8px rgba(0,0,0,0.5); }
                .glass-wrapper { background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(34px); border-top: 1px solid rgba(255,255,255,0.15); padding: 10px 24px 30px 24px; }
            </style>
        </head>
        <body>
            <!-- DE VARIANT -->
            <div id="capture-de" class="container" style="background-image: url('${screenshot}');">
                <div class="hero">
                    <div class="hero-overlay">
                        <img src="${icon}" />
                        <div>
                            <h1>${deName}</h1>
                            <p>${flavorText}</p>
                            ${sourceTagsDe || '<span class="source-tag">🎯 Quelle unbekannt</span>'}
                        </div>
                    </div>
                </div>
                <div class="glass-wrapper">
                    ${deRollsHtml}
                </div>
            </div>
            
            <!-- EN VARIANT -->
            <div id="capture-en" class="container" style="background-image: url('${screenshot}');">
                <div class="hero">
                    <div class="hero-overlay">
                        <img src="${icon}" />
                        <div>
                            <h1>${enName}</h1>
                            <p>${enData.description || flavorText}</p>
                            ${sourceTagsEn || '<span class="source-tag">🎯 Source unknown</span>'}
                        </div>
                    </div>
                </div>
                <div class="glass-wrapper">
                    ${enRollsHtml}
                </div>
            </div>
        </body>
        </html>
        `;

        // Wait until there are no more than 2 network connections for at least 500 ms (so images load!)
        try {
            await page.setContent(htmlStr, { waitUntil: 'networkidle2', timeout: 15000 });
        } catch(e) {
            console.log("Puppeteer load timeout, continuing with screenshot anyway...");
        }
        await sleep(1000); // Buffer for rendering
        
        // Find exactly the size of the container and screenshot just that area!
        const elDe = await page.$('#capture-de');
        const bufferDe = await elDe.screenshot();
        
        const elEn = await page.$('#capture-en');
        const bufferEn = await elEn.screenshot();

        // CREATE FORMDATA PAYLOAD FOR FORUM WEBHOOK
        const isPatch = (cached && cached.thread_id);

        const deText = `${deName}`;
        const enText = `${enName}`;

        const formDe = new FormData();
        formDe.append('files[0]', new Blob([bufferDe], { type: 'image/png' }), 'de_godroll.png');
        const payloadDe = { content: deText, attachments: [{ id: 0, filename: 'de_godroll.png' }] };
        if (!isPatch) {
            payloadDe.thread_name = threadTitle;
            payloadDe.username = "Destiny 2 God Rolls";
            payloadDe.avatar_url = icon;
        }
        formDe.append('payload_json', JSON.stringify(payloadDe));

        const formEn = new FormData();
        formEn.append('files[0]', new Blob([bufferEn], { type: 'image/png' }), 'en_godroll.png');
        const payloadEn = { 
            content: enText, 
            attachments: [{ id: 0, filename: 'en_godroll.png' }],
            username: "Destiny 2 God Rolls",
            avatar_url: icon
        };
        formEn.append('payload_json', JSON.stringify(payloadEn));

        // Fire to Discord API
        try {
            if (isPatch) {
                // PATCH MAIN MESSAGE (DE)
                const patchUrlDe = `${WEBHOOK_URL}/messages/${cached.thread_id}?thread_id=${cached.thread_id}&wait=true`;
                let resDe = await fetch(patchUrlDe, { method: 'PATCH', body: formDe });
                
                // PATCH REPLY (EN)
                if (cached.en_message_id) {
                    const patchUrlEn = `${WEBHOOK_URL}/messages/${cached.en_message_id}?thread_id=${cached.thread_id}&wait=true`;
                    await fetch(patchUrlEn, { method: 'PATCH', body: formEn });
                } else {
                    // Fallback: If for some reason the en_message_id didn't save, post a new reply
                    const postReplyUrl = `${WEBHOOK_URL}?thread_id=${cached.thread_id}&wait=true`;
                    let resEn = await fetch(postReplyUrl, { method: 'POST', body: formEn });
                    let resEnJson = await resEn.json();
                    discordState[weapon.hash].en_message_id = resEnJson.id;
                }
                
                if (resDe.ok) {
                    discordState[weapon.hash].hash = currentHash;
                    console.log(`[PATCHED SEQUENTIAL] ${threadTitle}`);
                    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
                    await fs.promises.writeFile(STATE_FILE, JSON.stringify(discordState, null, 2));
                    patchedCount++;
                }

            } else {
                // POST MAIN MESSAGE (CREATES THREAD)
                const postUrlDe = `${WEBHOOK_URL}?wait=true`;
                let resDe = await fetch(postUrlDe, { method: 'POST', body: formDe });
                
                if (resDe.ok) {
                    const resDeJson = await resDe.json();
                    const createdThreadId = resDeJson.channel_id || resDeJson.id;
                    
                    // POST REPLY (EN)
                    const postReplyUrl = `${WEBHOOK_URL}?thread_id=${createdThreadId}&wait=true`;
                    let resEn = await fetch(postReplyUrl, { method: 'POST', body: formEn });
                    const resEnJson = await resEn.json();

                    discordState[weapon.hash] = {
                        thread_id: createdThreadId,
                        en_message_id: resEnJson.id,
                        hash: currentHash
                    };
                    
                    console.log(`[POSTED SEQUENTIAL NEW] ${threadTitle}`);
                    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
                    await fs.promises.writeFile(STATE_FILE, JSON.stringify(discordState, null, 2));
                    postedCount++;
                } else if (resDe.status === 429) {
                    console.log("Rate Limited by Discord! Sleeping for 10 seconds...");
                    await sleep(10000);
                } else {
                    console.error(`Error posting ${threadTitle}:`, resDe.status, await resDe.text());
                }
            }
            await sleep(1500); 
        } catch (err) {
            console.error("Fetch Network Error:", err);
        }
        
// No limit for production sync! All weapons will be processed.
    }

    await browser.close();
    console.log(`\nDiscord Sync Complete! Posted ${postedCount} new weapon threads. Updated ${patchedCount} threads.`);
}

runDiscordSync();
