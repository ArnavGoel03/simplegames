import mark from "./studio-mark.json";

/** One silhouette for the wordmark, favicon and installed studio app. */
export const STUDIO_MARK = mark;

export function studioIconPath(name: string): string {
  return `/${name}?v=${STUDIO_MARK.revision}`;
}
