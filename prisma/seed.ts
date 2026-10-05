import "dotenv/config";
// @ts-expect-error bcrypt has no bundled types
import bcrypt from "bcrypt";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing DIRECT_URL or DATABASE_URL in environment.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD = "Demo@1234";

const recipes = [
  {
    recipeCode: "REC-BL01",
    name: "Casual Blouse",
    category: "Blouse",
    stdFabricYards: 1.8,
    wastageCap: 5.0,
    components: [
      { componentName: "Front Body Panel", piecesPerGarment: 1 },
      { componentName: "Back Body Panel", piecesPerGarment: 1 },
      { componentName: "Sleeves (Left & Right)", piecesPerGarment: 2 },
      { componentName: "Collar & Stand", piecesPerGarment: 1 },
      { componentName: "Sleeve Cuffs", piecesPerGarment: 2 },
    ],
  },
  {
    recipeCode: "REC-CT02",
    name: "Crop Top",
    category: "Crop Top",
    stdFabricYards: 1.1,
    wastageCap: 8.0,
    components: [
      { componentName: "Front Chest Panel", piecesPerGarment: 1 },
      { componentName: "Back Support Panel", piecesPerGarment: 1 },
      { componentName: "Neck Binding Strip", piecesPerGarment: 1 },
      { componentName: "Hem Elastic Casing", piecesPerGarment: 1 },
      { componentName: "Side Strap Accents", piecesPerGarment: 2 },
    ],
  },
];

const users = [
  {
    role: "cutting_supervisor" as const,
    email: "supervisor@apparelflow.test",
    fullName: "Cutting Supervisor",
  },
  {
    role: "cutting_verifier" as const,
    email: "verifier@apparelflow.test",
    fullName: "Cutting Verifier",
  },
  {
    role: "sewing_supervisor" as const,
    email: "sewing@apparelflow.test",
    fullName: "Sewing Supervisor",
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // Seed Recipes and Components
  for (const recipeData of recipes) {
    const recipe = await prisma.recipe.upsert({
      where: { recipeCode: recipeData.recipeCode },
      update: {
        name: recipeData.name,
        category: recipeData.category,
        stdFabricYards: recipeData.stdFabricYards,
        wastageCap: recipeData.wastageCap,
      },
      create: {
        recipeCode: recipeData.recipeCode,
        name: recipeData.name,
        category: recipeData.category,
        stdFabricYards: recipeData.stdFabricYards,
        wastageCap: recipeData.wastageCap,
      },
    });

    for (const comp of recipeData.components) {
      const existing = await prisma.recipeComponent.findFirst({
        where: {
          recipeId: recipe.id,
          componentName: comp.componentName,
        },
      });

      if (existing) {
        await prisma.recipeComponent.update({
          where: { id: existing.id },
          data: {
            piecesPerGarment: comp.piecesPerGarment,
          },
        });
      } else {
        await prisma.recipeComponent.create({
          data: {
            recipeId: recipe.id,
            componentName: comp.componentName,
            piecesPerGarment: comp.piecesPerGarment,
          },
        });
      }
    }
  }

  // Seed Demo Users
  for (const userData of users) {
    await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        fullName: userData.fullName,
        role: userData.role,
        passwordHash,
      },
      create: {
        email: userData.email,
        fullName: userData.fullName,
        role: userData.role,
        passwordHash,
      },
    });
  }

  const recipeCount = await prisma.recipe.count();
  const componentCount = await prisma.recipeComponent.count();
  const userCount = await prisma.user.count();

  console.log("Database seeded successfully.");
  console.log(
    `Summary: ${recipeCount} recipes, ${componentCount} components, ${userCount} users.`
  );
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
