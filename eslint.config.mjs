import next from "eslint-config-next/core-web-vitals";

const config = [
  {
    // Build output, all of it. `.open-next` is the Cloudflare adapter's, and it
    // contains a copy of the whole app plus the adapter's own templates, so
    // linting it reports dozens of problems in code nobody here wrote and none
    // of which can be fixed from this repository.
    ignores: [
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      "node_modules/**",
      "next-env.d.ts",
    ],
  },
  ...next,
];

export default config;
