import { NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { requireRole } from "@/lib/auth";
import { OrderStatus, Role } from "@/generated/prisma/enums";

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
    select: {
      id: true,
      orderNo: true,
      status: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== OrderStatus.REJECTED) {
    return NextResponse.json(
      {
        error: "Only rejected orders can be resubmitted",
      },
      { status: 409 },
    );
  }

  const updatedOrder = await prisma.cuttingOrder.update({
    where: {
      id: order.id,
    },
    data: {
      status: OrderStatus.CUTTING_IN_PROGRESS,
    },
    select: {
      id: true,
      orderNo: true,
      status: true,
    },
  });

  return NextResponse.json({
    order: updatedOrder,
  });
}
