import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { accessibilitySites, between, digest } from "./accessibility-fixture.mjs";

const [gamesPath, receiptsPath, configsPath] = process.argv.slice(2);
assert(gamesPath && receiptsPath && configsPath, "Usage: node tools/generate-accessibility-fixture.mjs GAMES_ROOT RECEIPTS_JSON PUBLIC_BUILD_CONFIGS_JSON");
const root = resolve(gamesPath);
const receipts = JSON.parse(await readFile(receiptsPath, "utf8"));
const configs = JSON.parse(await readFile(configsPath, "utf8"));
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, timeout: 5000, encoding: "utf8" }).trim();
const { sourceFingerprint, verifyBuild } = await import(pathToFileURL(join(root, "scripts/build-state.mjs")));
const studio = join(root, "packages/studio/src");
const cards = join(root, "apps/judgement/src");
const requireGame = createRequire(join(root, "apps/judgement/package.json"));
const sources = new Map();
async function source(path) {
  const text = await readFile(path, "utf8");
  sources.set(relative(root, path), digest(text));
  return text;
}
const cardTable = await source(join(cards, "components/cards/CardTable.tsx"));
const score = "<Modal" + between(cardTable, "{padOpen && (\n        <Modal", "\n      )}");
const pachisa = await source(join(cards, "components/cards/PachisaTable.tsx"));
const showdown = between(pachisa, "/* The showdown ------------------------------------------------------------ */", "/* The pad ----------------------------------------------------------------- */");
const imports = path => JSON.stringify(path);
const fixture = `import React, {useId,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Modal} from ${imports(join(studio, "modal/Modal.tsx"))};
import {ReadAloud} from ${imports(join(studio, "site/ReadAloud.tsx"))};
import {BlankPicker} from ${imports(join(root, "apps/lattice/src/components/room/BlankPicker.tsx"))};
import {RoundBreak} from ${imports(join(cards, "components/cards/RoundBreak.tsx"))};
import {DealBreak} from ${imports(join(cards, "components/cards/DealBreak.tsx"))};
import {ScorePad} from ${imports(join(cards, "components/cards/ScorePad.tsx"))};
import {DrawCanvas} from ${imports(join(root, "apps/draw/src/components/room/DrawCanvas.tsx"))};
import {useCallback,useEffect} from 'react';
import {useSeatName} from ${imports(join(studio, "room/SeatNames.tsx"))};
import {PlayingCard} from ${imports(join(studio, "cards/PlayingCard.tsx"))};
import {knock} from ${imports(join(studio, "table/haptics.ts"))};
import {ALL_FOUR_BONUS,SET_LABELS,SET_SIZE} from '@play/pachisa';
import {SEAT_PLAIN,SEAT_QUIET,YOU} from ${imports(join(studio, "labels.ts"))};
import {rankName} from ${imports(join(cards, "lib/cards/faces.ts"))};
${showdown}
const tally={red:1,green:0,yellow:0};
const line={round:1,trump:'hearts',bids:tally,tricksWon:tally,scores:tally};
const deal={deal:1,biddingTeam:0,bidder:'red',bid:18,trump:'hearts',made:true,points:[20,9],scores:[1,0],swing:1,forced:false,doubled:false,marriages:[]};
const result={hand:1,rounds:[{round:1,winner:'red',shown:['red','green','yellow'].map(seat=>({seat,set:null}))}],won:tally,bonuses:{},discards:{},scores:tally};
function ScoreSheet({close}) {const padTitleId=useId();const padCloseRef=useRef(null);const setPadOpen=()=>close();const view={pad:[line],scores:tally,rulesId:'judgement'};const ring=['red','green','yellow'];return (${score});}
function Fixture(){
 const [active,setActive]=useState(''); const [brush,setBrush]=useState('pen'); const [mode,setMode]=useState('artist');
 const log=useRef({strokes:[],epoch:0});const [revision,setRevision]=useState(0);
 const stroke=React.useCallback(value=>{log.current.strokes.push(value);window.fixture.strokes.push(value);setRevision(n=>n+1)},[]);
 const mark=React.useCallback(value=>window.fixture.marks.push(value),[]);
 window.fixture={...(window.fixture||{strokes:[],marks:[]}),setBrush,setMode,unmount:()=>root.unmount()};
 const close=()=>setActive('');
 return <main><div id="fixture-background"><button id="fixture-trigger" onClick={()=>setActive(new URLSearchParams(location.search).get('surface')||'blank')}>Open</button><button id="fixture-background-action">Background</button></div>
 {active==='blank'&&<BlankPicker onPick={letter=>{window.fixture.picked=letter;close()}} onCancel={close}/>}
 {active==='round'&&<RoundBreak pad={[line]} seats={['red','green','yellow']} you="red" rulesId="judgement" onContinue={close}/>}
 {active==='deal'&&<DealBreak pad={[deal]} us={0} onContinue={close}/>}
 {active==='score'&&<ScoreSheet close={close}/>}
 {active==='showdown'&&<Showdown result={result} you="red" target={25} winner={null} onNext={close}/>}
 <div id="fixture-paper" style={{width:'100%',height:360}}><DrawCanvas log={log} revision={revision} brush={brush} color="black" width={4} onStroke={mode==='artist'?stroke:null} onTap={mode==='mark'?mark:null}/></div>
 <ReadAloud target="fixture-reading"/><article id="fixture-reading"><p>First <em>visible</em> sentence. Second sentence.</p><p style={{display:'none'}}>Hidden sentence.</p><p>Final passage.</p><button>Excluded control</button></article>
 <a id="fixture-navigation" href="/fixture-next" onClick={event=>event.preventDefault()}>Next</a></main>;
}
const root=createRoot(document.getElementById('fixture-root'));root.render(<Fixture/>);`;
const output = new URL("./fixtures/accessibility/", import.meta.url);
await mkdir(output, { recursive: true });
const bundled = await build({ absWorkingDir: root, stdin: { contents: fixture, resolveDir: root, loader: "tsx" }, bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", minify: true, metafile: true,
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{name:"canonical-fixture-adapters",setup(api){
    api.onResolve({filter:/^(react(?:\/.*)?|react-dom(?:\/.*)?)$/},args=>({path:requireGame.resolve(args.path)}));
    api.onResolve({filter:/^@play\/pachisa$/},()=>({path:join(root,"packages/pachisa/src/index.ts")}));
    api.onResolve({filter:/^next\/navigation$/},()=>({path:"navigation",namespace:"fixture"}));
    api.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:"export function usePathname(){return location.pathname}",loader:"js"}));
    api.onResolve({filter:/^@play\/studio\/(table|room|hooks)$/},args=>({path:args.path,namespace:"bridge"}));
    api.onLoad({filter:/.*/,namespace:"bridge"},args=>({contents:args.path.endsWith('/table')?`export {Modal} from ${imports(join(studio,'modal/Modal.tsx'))};`:args.path.endsWith('/room')?`export {useSeatName} from ${imports(join(studio,'room/SeatNames.tsx'))};`:`export {useLayoutReset} from ${imports(join(studio,'hooks/useLayoutReset.ts'))};`,loader:"ts",resolveDir:root}));
    api.onResolve({filter:/^@\//},args=>{const base=join(root,args.importer.includes('/draw/')?'apps/draw/src':'apps/judgement/src',args.path.slice(2));const path=['.ts','.tsx','/index.ts'].map(suffix=>base+suffix).find(existsSync);assert(path,`Missing alias: ${base}`);return {path};});
  }}] });
const bytes=bundled.outputFiles[0].contents;
for(const path of Object.keys(bundled.metafile.inputs)){if(path.startsWith('fixture:')||path.startsWith('bridge:')||path==='<stdin>'||path.includes('node_modules'))continue;await source(resolve(root,path));}
assert.equal(execFileSync('git',['diff','HEAD','--',...sources.keys()],{cwd:root,timeout:5000,encoding:'utf8'}).trim(),'', 'Canonical imported components must be committed at candidate HEAD');
await writeFile(new URL('bundle.js',output),bytes);
const manifests=[];
for(const candidate of receipts.filter(item=>accessibilitySites[item.site])){
 const config=configs[candidate.site];assert(config&&config.site===candidate.site&&config.head===head);assert.equal(head,candidate.sourceHead);
 assert(Object.keys(config.publicEnv).every(key=>key.startsWith('NEXT_PUBLIC_')), 'Only public build configuration is accepted');
 const app=join(root,'apps',accessibilitySites[candidate.site]);
 const fingerprint=sourceFingerprint(root,app,config);assert.equal(fingerprint,candidate.sourceFingerprint,'Source changed since certified build');
 const stamp=verifyBuild(app,fingerprint);assert.equal(stamp.output,candidate.buildOutput);
 manifests.push({schema:1,synthetic:true,site:candidate.site,sourceHead:head,sourceFingerprint:fingerprint,buildOutput:stamp.output,sha256:digest(bytes),sources:[...sources].map(([path,sha256])=>({path,sha256})),adapters:['Fixed synthetic pathname, no Next router','Synthetic game state and callbacks','Original CardTable score modal JSX and Pachisa showdown functions extracted without edits']});
}
assert(manifests.length,'No supported accessibility candidates supplied');
await writeFile(new URL('manifest.json',output),JSON.stringify(manifests,null,2));
console.log('Generated candidate-bound canonical accessibility fixture');
