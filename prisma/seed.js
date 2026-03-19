const { PrismaClient } = require("@prisma/client");
const { hash } = require("bcryptjs");

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient(
  databaseUrl
    ? {
        datasources: {
          db: {
            url: databaseUrl,
          },
        },
      }
    : undefined,
);

async function main() {
  const email = (process.env.TEST_USER_EMAIL || "teste@taskmanager.local").toLowerCase();
  const password = process.env.TEST_USER_PASSWORD || "Teste@123456";
  const name = process.env.TEST_USER_NAME || "Usuário de Teste";

  const passwordHash = await hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
    },
    create: {
      email,
      name,
      passwordHash,
    },
  });

  console.log("Test user seeded successfully.");
  console.log(`Email: ${user.email}`);
  console.log(`Password: ${password}`);
}

main()
  .catch((error) => {
    console.error("Failed to seed test user.");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
