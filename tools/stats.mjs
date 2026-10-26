#!/usr/bin/env node
// Server-side visit counts for the studio Worker, read from Cloudflare's own
// analytics. Nothing runs in the visitor's browser, so the privacy page's
// "no analytics, no beacon, no pixel" stays true.
//
// Auth, first match wins: CLOUDFLARE_API_TOKEN, then wrangler's saved login.
// A custom token needs these read scopes:
//   Account > Account Analytics > Read   (requests per day, from Worker invocations)
//   Zone > Analytics > Read              (top paths, zone glasstablegames.com)
// Wrangler's login carries neither, so expect to need the token.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { workerName } from "./release-context.mjs";
import { SITE_URL } from "./site-url.mjs";

const API = "https://api.cloudflare.com/client/v4";
const GRAPHQL = `${API}/graphql`;
const DAYS = 7;
const TOP_PATHS = 15;
const TIMEOUT_MS = 20000;

function token() {
  if (process.env.CLOUDFLARE_API_TOKEN) return { value: process.env.CLOUDFLARE_API_TOKEN, source: "CLOUDFLARE_API_TOKEN" };
  for (const file of [join(homedir(), "Library/Preferences/.wrangler/config/default.toml"), join(homedir(), ".config/.wrangler/config/default.toml")]) {
    try {
      const found = readFileSync(file, "utf8").match(/^oauth_token\s*=\s*"([^"]+)"/m);
      if (found) return { value: found[1], source: "wrangler login" };
    } catch { /* try the next location */ }
  }
  throw new Error("stats: no Cloudflare credentials. Set CLOUDFLARE_API_TOKEN (scopes: Account Analytics Read, Zone Analytics Read) or run `wrangler login`.");
}

const auth = token();
const call = async (url, init = {}) => {
  const response = await fetch(url, { ...init, headers: { authorization: `Bearer ${auth.value}`, "content-type": "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false || body.errors?.length) {
    const reason = (body.errors ?? []).map((e) => e.message).join("; ") || `HTTP ${response.status}`;
    throw new Error(`${reason}`);
  }
  return body;
};
const query = async (text, variables) => {
  const body = await call(GRAPHQL, { method: "POST", body: JSON.stringify({ query: text, variables }) });
  return body.data;
};

const day = (offset) => new Date(Date.now() - offset * 864e5).toISOString().slice(0, 10);
const since = day(DAYS - 1), until = day(-1);
let failed = false;
const fail = (what, error) => { failed = true; console.error(`stats: ${what} failed: ${error.message}`); };

try {
  const accounts = (await call(`${API}/accounts`)).result;
  if (!accounts?.length) throw new Error("token sees no account");
  const accountTag = accounts[0].id;
  const data = await query(
    `query($a:String!,$s:Date!,$u:Date!,$w:String!){viewer{accounts(filter:{accountTag:$a}){workersInvocationsAdaptive(limit:100,filter:{date_geq:$s,date_lt:$u,scriptName:$w},orderBy:[date_ASC]){sum{requests errors} dimensions{date}}}}}`,
    { a: accountTag, s: since, u: until, w: workerName() });
  const rows = data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];
  const perDay = new Map();
  for (const r of rows) perDay.set(r.dimensions.date, (perDay.get(r.dimensions.date) ?? 0) + r.sum.requests);
  console.log(`Worker ${workerName()} requests per day (${since} to ${day(0)}, UTC):`);
  for (let i = DAYS - 1; i >= 0; i--) console.log(`  ${day(i)}  ${perDay.get(day(i)) ?? 0}`);
  console.log(`  total ${[...perDay.values()].reduce((a, b) => a + b, 0)}`);
} catch (error) { fail("daily request counts", error); }

try {
  const host = new URL(SITE_URL).hostname.replace(/^[^.]+\.goelhome\.workers\.dev$/, "glasstablegames.com");
  const zones = (await call(`${API}/zones?name=${encodeURIComponent(host)}`)).result;
  if (!zones?.length) throw new Error(`token sees no zone named ${host}`);
  const data = await query(
    `query($z:String!,$s:Time!,$u:Time!,$n:Int!){viewer{zones(filter:{zoneTag:$z}){httpRequestsAdaptiveGroups(limit:$n,filter:{datetime_geq:$s,datetime_lt:$u,requestSource:"eyeball"},orderBy:[count_DESC]){count dimensions{clientRequestPath}}}}}`,
    { z: zones[0].id, s: `${since}T00:00:00Z`, u: `${until}T00:00:00Z`, n: TOP_PATHS });
  const rows = data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
  console.log(`\nTop paths on ${host}, last ${DAYS} days (requests, includes assets):`);
  for (const r of rows) console.log(`  ${String(r.count).padStart(7)}  ${r.dimensions.clientRequestPath}`);
} catch (error) { fail("top paths", error); }

if (failed) {
  console.error(`stats: credentials used: ${auth.source}. Create an API token with Account > Account Analytics > Read and Zone > Analytics > Read, then export CLOUDFLARE_API_TOKEN.`);
  process.exit(1);
}
