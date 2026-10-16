import { applyD1Migrations, reset } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach } from "vitest";
import { z } from "zod";

const migrationsSchema = z.array(z.object({ name: z.string(), queries: z.array(z.string()) }));

// TEST_MIGRATIONS exists only in tests, so it is read and checked here rather than added to the app's Env type
const migrations = migrationsSchema.parse(Reflect.get(env, "TEST_MIGRATIONS"));

// Every test starts from an empty, fully migrated database
beforeEach(async () => {
  await reset();
  await applyD1Migrations(env.DB, migrations);
});
