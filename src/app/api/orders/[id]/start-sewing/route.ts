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
  const auth = await requireRole([Role.sewing_supervisor]);

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const orderId = Number(id);

  if (!Number.isInteger(orderId) || orderId < 1) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 422 });
  }

  const order = await prisma.cuttingOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNo: true,
      status: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== OrderStatus.VERIFIED) {
    return NextResponse.json(
      { error: "Only verified orders can be started for sewing" },
      { status: 409 },
    );
  }

  const result = await prisma.cuttingOrder.updateMany({
    where: {
      id: order.id,
      status: OrderStatus.VERIFIED,
    },
    data: {
      status: OrderStatus.IN_SEWING,
    },
  });

  if (result.count !== 1) {
    return NextResponse.json(
      { error: "Order status changed before sewing could be started" },
      { status: 409 },
    );
  }

  return NextResponse.json({
    order: {
      id: order.id,
      orderNo: order.orderNo,
      status: OrderStatus.IN_SEWING,
    },
  });
}
