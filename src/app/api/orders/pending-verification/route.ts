import { NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { requireRole } from "@/lib/auth";
import { OrderStatus, Role } from "@/generated/prisma/enums";

export async function GET() {
  const auth = await requireRole([Role.cutting_verifier]);

  if (!auth.ok) {
    return auth.response;
  }

  const orders = await prisma.cuttingOrder.findMany({
    where: {
      status: OrderStatus.PENDING_VERIFICATION,
    },
    orderBy: {
      createdAt: "asc",
    },
    include: {
      recipe: {
        select: {
          recipeCode: true,
          name: true,
          stdFabricYards: true,
          wastageCap: true,
          components: {
            orderBy: {
              id: "asc",
            },
            select: {
              id: true,
              componentName: true,
              piecesPerGarment: true,
            },
          },
        },
      },
      verificationItems: {
        orderBy: {
          componentId: "asc",
        },
        select: {
          id: true,
          componentId: true,
          expectedQty: true,
          actualQty: true,
          status: true,
        },
      },
    },
  });

  return NextResponse.json({
    orders: orders.map((order) => ({
      id: order.id,
      orderNo: order.orderNo,
      status: order.status,
      targetQty: order.targetQty,
      fabricRollId: order.fabricRollId,
      actualFabricYds: Number(order.actualFabricYds),
      createdAt: order.createdAt,

      recipe: {
        recipeCode: order.recipe.recipeCode,
        name: order.recipe.name,
        stdFabricYards: Number(order.recipe.stdFabricYards),
        wastageCap: Number(order.recipe.wastageCap),
        components: order.recipe.components,
      },

      verificationItems: order.verificationItems,
    })),
  });
}
