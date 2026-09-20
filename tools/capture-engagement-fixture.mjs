import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

assert(process.argv[2], "Pass the games source checkout path");
const root = resolve(process.argv[2]);
const directory = new URL("./fixtures/player-history/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", directory), "utf8"));
const head = () => execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", timeout: 10_000 }).trim();
const { workspaceFingerprint } = await import(pathToFileURL(resolve(root, "scripts/build-state.mjs")).href);
const initialHead = head();
const initialFingerprint = workspaceFingerprint(root, { head: initialHead });
const checkOnly = process.argv.includes("--check");
if (!checkOnly) assert.equal(initialFingerprint, manifest.sourceFingerprint, "Games tree differs from markup fixture");
if (!checkOnly) assert.equal(head(), manifest.sourceHead, "Regenerate markup from the final games commit first");
const script = `
import { EMPTY_RECORD, layOut, newGame, play, variantOf, VARIANT_IDS } from '@play/solitaire';
import { patienceAdapters } from './src/lib/cards/patience-progress';
import { SAVE_VERSION } from './src/lib/cards/patience-save';
import { StorageKey } from '@play/studio/storage';
import { soloStorageKey } from '@play/studio/solo-progress';
import { SOLO_COPY } from '@play/studio/solo-progress';
import { GAMES } from '@play/brand';
import { SOLO_PLAYER_HEADER, SOLO_PROGRESS_PATH, SOLO_SLOTS } from '@play/protocol/solo-progress';
const owners = [1,2].map(n => '00000000-0000-4000-8000-' + String(n).padStart(12,'0'));
const saves = {};
for (const id of VARIANT_IDS) {
 const variant = variantOf(id), deal = {source:'numbered',number:617};
 let match = newGame(variant, layOut(variant, deal));
 saves[id] = [];
 for(let n=1;n<=3;n++) {
  match = play(variant,match,variant.moves(match.state)[0]);
  const value = { save:{version:SAVE_VERSION,variant:id,deal,steps:match.steps,undone:[],elapsed:12000,attemptId:'00000000-0000-4000-8001-' + String(n).padStart(12,'0')},record:EMPTY_RECORD };
  const data=patienceAdapters[id].encode(value);
  if(!data || !patienceAdapters[id].decode(data)) throw new Error('invalid canonical fixture');
  saves[id].push(data);
 }
}
console.log(JSON.stringify({owners,saves,roomsKey:StorageKey.Rooms,soloKeys:Object.fromEntries(owners.map(owner=>[owner,Object.fromEntries(SOLO_SLOTS.map(slot=>[slot,soloStorageKey(owner,slot)]))])),soloPath:SOLO_PROGRESS_PATH,soloHeader:SOLO_PLAYER_HEADER,copy:SOLO_COPY,soloUrls:Object.fromEntries(VARIANT_IDS.map(id=>[id,GAMES[id].url]))}));
`;
const data = JSON.parse(execFileSync("pnpm", ["--filter", "judgement", "exec", "tsx", "-e", script], { cwd: root, encoding: "utf8", timeout: 20_000 }));
const dailyScript = `
import { boardFor, houseMove, playRun } from '@play/daily';
import { applyMove, applyRoll, getLegalMovesForState } from '@play/engine';
import { EMPTY_RECORD } from './src/lib/daily/record';
import { dailyAdapter } from './src/lib/daily/store';
(async () => {
 const day=new Date().toISOString().slice(0,10), board=await boardFor(day);
 let engine=board.start;
 while(engine.rollCount<8 && engine.winner===null) {
  engine=applyRoll(engine,board.rolls[engine.rollCount]);
  const moves=getLegalMovesForState(engine);
  if(engine.pendingRoll!==null && moves.length) engine=applyMove(engine,houseMove(engine,moves));
 }
 const record={...EMPTY_RECORD,progress:{day,engine,marks:playRun(board.rolls.slice(0,8),houseMove).marks}};
 const data=dailyAdapter.encode(record); if(!data || !dailyAdapter.decode(data)) throw new Error('invalid daily fixture');
 console.log(JSON.stringify({day,data}));
})();`;
data.daily = JSON.parse(execFileSync("pnpm", ["--filter", "web", "exec", "tsx", "-e", dailyScript], { cwd: root, encoding: "utf8", timeout: 20_000 }));
const bundled = await build({
  stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
    import {AccountProvider} from ${JSON.stringify(resolve(root, "packages/studio/src/account/AccountProvider.tsx"))};
    import {GameArchive} from ${JSON.stringify(resolve(root, "apps/web/src/components/player/GameArchive.tsx"))};
    const games=[{gameId:'00000000-0000-4000-8001-000000000001',game:'rummy',mode:'duel',timeControl:'blitz',rated:true,
      endedAt:new Date('2026-09-20T10:00:00Z'),endReason:'finished',seat:'red',result:'win',placement:1,
      ratingBefore:1200,ratingAfter:1216,verifiable:true,seatCount:4,replayable:true}];
    createRoot(document.getElementById('fixture')).render(<AccountProvider><GameArchive games={games}/></AccountProvider>);`,
    loader: "tsx", resolveDir: resolve(root, "apps/web"), sourcefile: "synthetic-engagement-entry.tsx" },
  tsconfig: resolve(root, "apps/web/tsconfig.json"), bundle: true, minify: true, write: false,
  platform: "browser", format: "iife", jsx: "automatic", sourcemap: false,
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
});
const component = bundled.outputFiles[0].contents;
assert.equal(head(), initialHead, "Source HEAD changed during generation");
assert.equal(workspaceFingerprint(root, { head: initialHead }), initialFingerprint, "Source tree changed during generation");
assert.equal(bundled.warnings.length, 0, "Generated component bundle emitted warnings");
if (checkOnly) { console.log("Canonical saves and actual component bundle validated without writing bound artifacts"); process.exit(0); }
writeFileSync(new URL("engagement-component.js", directory), component);
assert.equal(head(), manifest.sourceHead, "Source changed while generating canonical saves");
writeFileSync(new URL("engagement.json", directory), JSON.stringify({ schema: 1, synthetic: true,
  sourceHead: manifest.sourceHead, sourceFingerprint: manifest.sourceFingerprint, componentSha256: createHash("sha256").update(component).digest("hex"), ...data,
  provenance: "Canonical solitaire engine, save version, adapters and storage keys imported from the bound games checkout; synthetic numbered deal617 only",
}, null, 2));
console.log(`Generated canonical engagement fixture for ${manifest.sourceHead}`);
