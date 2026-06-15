import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_TEMPLATES } from "../src/lib/tna/template-data";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@abode.com";
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: "Admin", email, role: "ADMIN", passwordHash },
  });
  console.log(`Seeded admin: ${email} / ChangeMe123!`);

  // Default size scales (idempotent by unique name; sizes created only on insert).
  const scales: Record<string, string[]> = {
    "Adult XS-6XL": ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL"],
    "Adult XS-2XL": ["XS", "S", "M", "L", "XL", "2XL"],
    "Kids": ["3-4", "5-6", "7-8", "9-11", "12-13"],
  };
  for (const [name, sizes] of Object.entries(scales)) {
    await prisma.sizeScale.upsert({
      where: { name },
      update: {},
      create: { name, sizes: { create: sizes.map((label, position) => ({ label, position })) } },
    });
  }

  // Default colours.
  for (const name of ["Black", "White", "Navy", "Royal", "Red", "Bottle Green"]) {
    await prisma.colour.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log("Seeded default size scales + colours");

  // Default T&A milestone templates (pure data import — single Prisma client).
  for (const t of DEFAULT_TEMPLATES) {
    await prisma.taMilestoneTemplate.upsert({ where: { key: t.key }, update: {}, create: t });
  }
  console.log("Seeded T&A milestone templates");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
