export function buildInfo(root?: string, env?: NodeJS.ProcessEnv, now?: Date): {
  NEXT_PUBLIC_APP_VERSION: string;
  NEXT_PUBLIC_APP_COMMIT: string;
  NEXT_PUBLIC_APP_BUILT_AT: string;
};
