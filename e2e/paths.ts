// Where the end-to-end run keeps its own state, apart from the dev database. Emptied by serve.ts at every start.
export const persistTo = ".cloudflare/e2e-state";

// What seed.ts made, for the steps to read
export const fixturesFile = `${persistTo}/fixtures.json`;

// How many setup links and stale sessions the run has used, so a retried scenario never gets a spent one
export const setupLinksUsedFile = `${persistTo}/setup-links-used`;
export const staleSessionsUsedFile = `${persistTo}/stale-sessions-used`;
export const hoaStaleSessionsUsedFile = `${persistTo}/hoa-stale-sessions-used`;

export const seedMigrations = `${persistTo}/seed`;

// The database's own SQLite file is in here, under a name miniflare picks
export const databaseFolder = `${persistTo}/v3/d1/miniflare-D1DatabaseObject`;
