// No @types/node in this repo: the few Node globals the TypeScript files use are declared here.
declare const process: { env: Record<string, string | undefined> };
