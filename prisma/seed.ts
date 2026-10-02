import dns from "node:dns";
import net from "node:net";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client.ts";

dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamilyAttemptTimeout(10000);

config({ path: ".env" });
config({ path: ".env.local", override: true });

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const latitude = process.env.OFFICE_LATITUDE;
const longitude = process.env.OFFICE_LONGITUDE;
const radius = Number(process.env.OFFICE_RADIUS_METERS || 150);

if (!connectionString) {
  console.error("Set DATABASE_URL to your Neon pooled connection string.");
  process.exit(1);
}

if (!latitude || !longitude) {
  console.error("Set OFFICE_LATITUDE and OFFICE_LONGITUDE before seeding the office location.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const existing = await prisma.officeLocation.findFirst();

if (!existing) {
  await prisma.officeLocation.create({
    data: {
      latitude,
      longitude,
      radiusMeters: Number.isFinite(radius) ? radius : 150,
    },
  });
  console.log("Office location saved.");
} else {
  console.log("Office location already exists.");
}

await prisma.$disconnect();
