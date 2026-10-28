import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

// Backs up EVERY collection in DATABASE_URL to db-backup/, then deletes them all.
// Use it to clear data saved in an old schema layout, then run: npm run db:push && npm run db:seed
// The database is shared with the admin backend, so tell that team before running it.
// Usage: npx tsx scripts/reset-db.ts --yes

const prisma = new PrismaClient();

async function main() {
  if (process.argv[2] !== "--yes") {
    console.log("This deletes ALL data in the database (after a backup). Run again with --yes to continue.");
    return;
  }

  const cols: any = await prisma.$runCommandRaw({ listCollections: 1, nameOnly: true });
  const names: string[] = cols.cursor.firstBatch.map((c: { name: string }) => c.name);

  const backup: Record<string, unknown[]> = {};
  for (const name of names) {
    const r: any = await prisma.$runCommandRaw({ find: name, limit: 1_000_000, batchSize: 1_000_000 });
    backup[name] = r.cursor.firstBatch;
  }
  mkdirSync("db-backup", { recursive: true });
  const file = `db-backup/backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(file, JSON.stringify(backup, null, 2));
  console.log(`Backup saved to ${file}`);

  for (const name of names) {
    await prisma.$runCommandRaw({ drop: name });
    console.log(`Deleted ${name} (${backup[name].length} records)`);
  }
  console.log("Done. Now run: npm run db:push && npm run db:seed");
}

main().finally(() => prisma.$disconnect());
