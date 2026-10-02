import dns from "node:dns";
import net from "node:net";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamilyAttemptTimeout(10000);

const globalForPrisma = globalThis;

export function getPrisma() {
  if (!globalForPrisma.prisma) {
    const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Add your Neon connection string to .env.local."
      );
    }

    const pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 20000,
      max: 5,
    });
    const adapter = new PrismaPg(pool);
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }

  return globalForPrisma.prisma;
}

export function databaseErrorMessage(error) {
  if (error?.code === "ETIMEDOUT" || error?.code === "ECONNREFUSED" || error?.code === "ENETUNREACH") {
    return "Could not reach the database. Check your connection and try again.";
  }

  const message = typeof error?.message === "string" ? error.message.trim() : "";
  if (message && !message.startsWith("Invalid `prisma.")) return message;
  return "Could not reach the database. Check your connection and try again.";
}
