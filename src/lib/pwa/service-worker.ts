import { workerVersion } from "./version";
import { WORKER_RUNTIME } from "./worker-runtime";
import { ASSET_RECOVERY_STARTED, ASSET_RECOVERY_CANCELLED, ASSET_RECOVERY_QUERY } from "./asset-recovery";

// One shared service worker, not four apps writing the same file by hand.
//
// This used to be four copies of `app/sw.js/route.ts`, about 78% identical:
// the same install, activate and message handlers, the same cache-then-network
// fetch logic, the same two guards against handing a precached document to an
// RSC request, the same offline fallback chain. A service worker is the one
// file where that matters more than anywhere else in this studio: a bug fixed
// in one copy and missed in the other three stays broken silently, because
// nothing compares four generated strings against each other, and a worker
// that installs wrong keeps serving from a visitor's device after the fix
// ships. So the logic lives here once, and an app's own `app/sw.js/route.ts`
// supplies only what is genuinely its own: which routes and assets are worth
// having with no connection, which routes beyond the shared floor must never
// be answered from a cache, this site's own foreground color for the one page
// this file draws itself, and, for the one site that needs it, a second
// runtime-cacheable prefix.
//
// It lived in `public/sw.js` before that, opening with a version string
// somebody had to remember to bump by hand. Nobody remembers. A worker whose
// version did not change does not replace the caches it wrote last time, so
// the fix you just deployed sits on the CDN while the browser keeps answering
// from a copy of the site that predates it. That is the whole anatomy of a
// site that "cannot load" for one person and works for everybody else, and it
// cannot be tested for, because the machine that would test it has no stale
// cache.
//
// So the version is the commit, via `workerVersion()` below. The release
// number was the first answer and it is the same bug with an extra step,
// because nobody bumps `package.json` either. A deploy that changed nothing is
// not a deploy, so the commit is the one thing guaranteed to move.

/**
 * Paths that must never be served from a cache, on every site in the studio.
 *
 * `/api/` is live data. `/r/` is a room, which is a live socket, and a stale
 * copy of one is a game nobody else is in. `/account` and `/leaderboard` are
 * records that change without this device doing anything, and a cache that
 * outlived a sign-out, or a ranking that outlived the match that changed it,
 * would show one to whoever picks the device up next.
 *
 * This is the floor, not the ceiling: a site with a route only it has, a
 * player profile or a lobby of its own, adds it with `privatePrefixes` rather
 * than editing this list, which every other site also relies on.
 */
export const BASE_PRIVATE_PREFIXES: readonly string[] = ["/api/", "/r/", "/account", "/leaderboard"];

/**
 * A second prefix worth caching at runtime alongside `/_next/static/` and
 * whatever is in `precache`, for a site with an asset too large or too
 * changeable to preload on install.
 *
 * `comment` is spliced into the generated worker as a real comment, not
 * dropped: this file ships as readable JavaScript, and the reason a path is
 * cached the way it is belongs next to the constant that names it, for
 * whoever opens DevTools on a stale cache next.
 */
export interface ExtraCachePrefix {
  readonly constName: string;
  readonly prefix: string;
  readonly comment: string;
}

/** What only one app's own worker knows about itself. */
export interface ServiceWorkerRoute {
  /**
   * The cache key's namespace, stable per app so two workers on one origin
   * during a subdomain migration cannot delete each other's caches.
   */
  readonly app: string;
  /** This app's own `package.json` version, the fallback for a build with no commit behind it. */
  readonly appVersion: string;
  /** This app's build commit, or null for a build with none behind it. */
  readonly appCommit: string | null;
  /** Every route and asset this app can serve with no network at all. */
  readonly precache: readonly string[];
  /** The page that unregisters this worker and deletes its caches. */
  readonly escape: string;
  /** What a home screen launch actually requests. */
  readonly startUrl: string;
  /** The best saved answer for a navigation with nothing else cached. */
  readonly offline: string;
  /** Routes private to this app, beyond the shared floor in `BASE_PRIVATE_PREFIXES`. */
  readonly privatePrefixes?: readonly string[];
  /** A second runtime-cacheable prefix, for the one site that needs it. */
  readonly extraCache?: ExtraCachePrefix;
  /** Explicit namespaces owned by a previous worker, migrated once on activation. */
  readonly legacyCachePrefixes?: readonly string[];
  /** Optional standalone reporter source; never requires an application bundle. */
  readonly faultSource?: string;
  /** This site's own foreground color, for the one page this file draws itself. */
  readonly offlineForeground: string;
  /**
   * Why offline matters for this particular app, as pre-formatted comment
   * lines (each already starting with `//`). Spliced verbatim under the
   * "Generated by" line, because it is genuinely this app's own case for the
   * file and not a fact about service workers in general.
   */
  readonly runtimeNote: string;
}

/**
 * The worker source, as a string.
 *
 * Plain string concatenation rather than nested template literals, because the
 * text below is itself JavaScript and a backtick in it would end this one.
 */
export function serviceWorkerSource(config: ServiceWorkerRoute): string {
  const privatePrefixes = [...BASE_PRIVATE_PREFIXES, ...(config.privatePrefixes ?? [])];
  const extra = config.extraCache;
  const extraDeclaration = extra
    ? `\n${extra.comment}\nconst ${extra.constName} = ${JSON.stringify(extra.prefix)};\n`
    : "";

  return `// Generated by app/sw.js/route.ts. Do not edit a copy of this.
//
${config.runtimeNote}

const VERSION = ${JSON.stringify(workerVersion(config.app, config.appVersion, config.appCommit))};
const STATIC_CACHE = VERSION + "-static";
const CACHE_PREFIX = ${JSON.stringify(config.app + "-")};
const OFFLINE = ${JSON.stringify(config.offline)};
const ASSET_RECOVERY_STARTED = ${JSON.stringify(ASSET_RECOVERY_STARTED)};
const ASSET_RECOVERY_CANCELLED = ${JSON.stringify(ASSET_RECOVERY_CANCELLED)};
const ASSET_RECOVERY_QUERY = ${JSON.stringify(ASSET_RECOVERY_QUERY)};
const LEGACY_CACHE_PREFIXES = ${JSON.stringify((config.legacyCachePrefixes ?? []).filter(Boolean).slice(0, 4))};

// Derived at build time from the route registry and the icon list, so a page
// added to the site cannot be missing from here and a URL here that nothing
// serves cannot happen.
const PRECACHE = ${JSON.stringify(config.precache)};
${extraDeclaration}
const EXTRA_CACHE_PREFIX = ${extra ? extra.constName : "null"};
// The one page this worker must never touch, whatever state it is in. It is the
// page that unregisters this worker and deletes these caches, so a worker that
// is itself the problem must not be standing between a player and it.
const ESCAPE = ${JSON.stringify(config.escape)};

// What a home screen launch actually requests. It is the same document as "/",
// but a cache is keyed on the whole URL, so without this an installed copy
// opened with no connection misses and falls through to the offline page.
const START_URL = ${JSON.stringify(config.startUrl)};

/**
 * Pages that must never be served from a cache, as a source fragment.
 *
 * A room is a live socket and a stale one is a game nobody else is in. An
 * account page and a leaderboard are records that change without this device
 * doing anything, and a cache that outlived a sign-out would show one to
 * whoever picks the phone up next.
 */
const PRIVATE_PREFIXES = ${JSON.stringify(privatePrefixes)};

${config.faultSource ?? ""}
${WORKER_RUNTIME}

/** A page of last resort, built here because by definition nothing is cached. */
function lastResort() {
  return new Response(
    '<!doctype html><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      "<title>Nothing to show yet</title>" +
      "<style>body{margin:0;min-height:100vh;display:grid;place-items:center;" +
      "background:#171009;color:${config.offlineForeground};font:16px/1.6 system-ui,sans-serif;" +
      "text-align:center;padding:24px}a{color:${config.offlineForeground}}</style>" +
      "<div><h1>Nothing to show yet</h1>" +
      "<p>This page is not saved on your device and the network did not answer.</p>" +
      '<p><a href="' + ESCAPE + '">Clear this site&rsquo;s saved copy</a></p></div>',
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
`;
}

/** The route handler itself: the source above, with the headers a worker script needs. */
export function serviceWorkerResponse(config: ServiceWorkerRoute): Response {
  return new Response(serviceWorkerSource(config), {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      // A worker script must not be answered from an HTTP cache, or a deploy
      // takes as long to reach a device as whatever max-age the last one set.
      // Modern browsers bypass the cache for this request anyway; this is for
      // the ones that do not, and for any proxy in between.
      "Cache-Control": "public, max-age=0, must-revalidate",
      // The default scope of a worker is the directory it was served from,
      // which here is the root already. Stated anyway, so that moving this file
      // cannot silently narrow what it controls.
      "Service-Worker-Allowed": "/",
    },
  });
}
