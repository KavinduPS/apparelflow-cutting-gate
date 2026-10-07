import { NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { Decision, OrderStatus, Role } from "@/generated/prisma/enums";
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
      verificationItems: {
        include: {
          component: {
            select: {
              componentName: true,
            },
          },
        },
        orderBy: {
          componentId: "asc",
        },
      },
      verificationLogs: {
        where: {
          decision: Decision.APPROVED,
        },
        orderBy: {
          timestamp: "desc",
        },
        take: 1,
        include: {
          verifier: {
            select: {
              id: true,
              fullName: true,
            },
          },
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

      verificationItems: order.verificationItems.map((item) => ({
        componentId: item.componentId,
        componentName: item.component.componentName,
        expectedQty: item.expectedQty,
        actualQty: item.actualQty,
        status: item.status,
      })),

      verification: order.verificationLogs[0]
        ? {
            verifierId: order.verificationLogs[0].verifier.id,
            verifierName: order.verificationLogs[0].verifier.fullName,
            verifiedAt: order.verificationLogs[0].timestamp,
            wastagePct: Number(order.verificationLogs[0].wastagePct ?? 0),
          }
        : null,

      verifiedAt: order.verificationLogs[0]?.timestamp ?? order.updatedAt,
    })),
  });
}
