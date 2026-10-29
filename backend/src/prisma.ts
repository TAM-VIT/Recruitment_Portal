import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// password hashes are never returned unless a query asks for them with omit: { passwordHash: false }
export const prisma = new PrismaClient({
  omit: { user: { passwordHash: true } },
});
