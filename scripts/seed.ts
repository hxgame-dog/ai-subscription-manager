import { ensureProviders } from "../lib/providers";
import { prisma } from "../lib/db";

async function main() {
  await ensureProviders();
  console.log("Providers seeded.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
