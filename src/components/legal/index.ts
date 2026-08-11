// Slug to prose.
//
// The Record is keyed on LegalSlug rather than string, so a document listed in
// LEGAL_DOCS with nothing written for it fails the build. That matters more
// than it sounds: every legal document is linked from the footer of every page
// on the site, so a missing one is a 404 advertised site-wide.

import type { ComponentType } from "react";
import type { LegalSlug } from "@/lib/legal";
import { Accessibility } from "./Accessibility";
import { Content } from "./Content";
import { Cookies } from "./Cookies";
import { IntellectualProperty } from "./IntellectualProperty";
import { Privacy } from "./Privacy";
import { RulesOfPlay } from "./RulesOfPlay";
import { Terms } from "./Terms";

export const LEGAL_BODIES: Record<LegalSlug, ComponentType> = {
  terms: Terms,
  privacy: Privacy,
  cookies: Cookies,
  "rules-of-play": RulesOfPlay,
  content: Content,
  accessibility: Accessibility,
  "intellectual-property": IntellectualProperty,
};
