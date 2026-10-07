import { NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { OrderStatus, Role } from "@/generated/prisma/enums";
import { requireRole } from "@/lib/auth";

export async function GET() {
  const auth = await requireRole([Role.sewing_supervisor]);

  if (!auth.ok) {
    return auth.response;
  }

  const orders = await prisma.cuttingOrder.findMany({
    where: {
      status: OrderStatus.VERIFIED,
    },
    orderBy: {
      updatedAt: "desc",
    },
    include: {
      recipe: {
        select: {
          recipeCode: true,
          name: true,
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
      recipe: {
        recipeCode: order.recipe.recipeCode,
        name: order.recipe.name,
      },
      verifiedAt: order.updatedAt,
    })),
  });
}
