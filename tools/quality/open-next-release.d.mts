import type { NextConfig } from "next";

export const OPEN_NEXT_EXPERIMENTAL_CONFIG: Readonly<Pick<NonNullable<NextConfig["experimental"]>, "prefetchInlining">>;
