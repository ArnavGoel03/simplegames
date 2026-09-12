import type { Metadata } from "next";
import { STUDIO_NAME, studio } from "./brand";

/** Keep each page's canonical and share identity together. */
export function pageMetadata(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: STUDIO_NAME,
      locale: studio.locale,
      url: new URL(path, studio.url).toString(),
      title: `${title}, ${STUDIO_NAME}`,
      description,
    },
  };
}
