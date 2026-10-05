import { prisma } from "@/db/client";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const recipes = await prisma.recipe.findMany({
    orderBy: {
      id: "asc",
    },
    include: {
      components: {
        orderBy: {
          id: "asc",
        },
      },
    },
  });

  return NextResponse.json({
    recipes: recipes.map((recipe) => ({
      id: recipe.id,
      recipeCode: recipe.recipeCode,
      name: recipe.name,
      category: recipe.category,
      stdFabricYards: Number(recipe.stdFabricYards),
      wastageCap: Number(recipe.wastageCap),

      components: recipe.components.map((component) => ({
        id: component.id,
        componentName: component.componentName,
        piecesPerGarment: component.piecesPerGarment,
      })),
    })),
  });
}
