import { NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { requireRole } from "@/lib/auth";
import { OrderStatus, Role } from "@/generated/prisma/enums";
import { expectedComponentCounts } from "@/lib/domain/expected";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireRole([Role.cutting_supervisor]);

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const orderId = Number(id);

  if (!Number.isInteger(orderId) || orderId < 1) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 422 });
  }

  const order = await prisma.cuttingOrder.findUnique({
    where: {
      id: orderId,
    },
    include: {
      recipe: {
        include: {
          components: {
            orderBy: {
              id: "asc",
            },
          },
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== OrderStatus.CUTTING_IN_PROGRESS) {
    return NextResponse.json(
      {
        error:
          "Only orders in cutting progress can be submitted for verification",
      },
      { status: 409 },
    );
  }

  const expectedComponents = expectedComponentCounts(
    order.targetQty,
    order.recipe.components.map((component) => ({
      id: component.id,
      componentName: component.componentName,
      piecesPerGarment: component.piecesPerGarment,
    })),
  );

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const updateResult = await tx.cuttingOrder.updateMany({
      where: {
        id: order.id,
        status: OrderStatus.CUTTING_IN_PROGRESS,
      },
      data: {
        status: OrderStatus.PENDING_VERIFICATION,
      },
    });

    if (updateResult.count !== 1) {
      throw new Error("ORDER_STATUS_CHANGED");
    }

    for (const component of expectedComponents) {
      await tx.verificationItem.upsert({
        where: {
          orderId_componentId: {
            orderId: order.id,
            componentId: component.id,
          },
        },
        update: {
          expectedQty: component.expectedQty,
          actualQty: null,
          status: null,
        },
        create: {
          orderId: order.id,
          componentId: component.id,
          expectedQty: component.expectedQty,
          actualQty: null,
          status: null,
        },
      });
    }

    return tx.cuttingOrder.findUniqueOrThrow({
      where: {
        id: order.id,
      },
      select: {
        id: true,
        orderNo: true,
        status: true,
      },
    });
  });

  return NextResponse.json({
    order: updatedOrder,
  });
}
