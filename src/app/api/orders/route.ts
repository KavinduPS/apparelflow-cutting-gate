import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { OrderStatus, Role, Decision } from "@/generated/prisma/enums";
import { createOrderSchema } from "@/lib/validation/order";
import { prisma } from "@/db/client";
import {
  expectedComponentCounts,
  expectedFabricYards,
} from "@/lib/domain/expected";

export async function GET() {
  const auth = await requireRole([Role.cutting_supervisor]);

  if (!auth.ok) {
    return auth.response;
  }

  const orders = await prisma.cuttingOrder.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      recipe: {
        select: {
          recipeCode: true,
          name: true,
        },
      },
      verificationLogs: {
        where: {
          decision: Decision.REJECTED,
        },
        orderBy: {
          timestamp: "desc",
        },
        take: 1,
        select: {
          rejectionNote: true,
          timestamp: true,
        },
      },
    },
  });

  return NextResponse.json({
    orders: orders.map((order) => ({
      id: order.id,
      orderNo: order.orderNo,
      status: order.status,
      recipeCode: order.recipe.recipeCode,
      recipeName: order.recipe.name,
      targetQty: order.targetQty,
      fabricRollId: order.fabricRollId,
      actualFabricYds: Number(order.actualFabricYds),
      createdAt: order.createdAt,
      rejectionNote: order.verificationLogs[0]?.rejectionNote ?? null,
      rejectedAt: order.verificationLogs[0]?.timestamp ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireRole([Role.cutting_supervisor]);

  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 422 });
  }

  const result = createOrderSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fields: result.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  const input = result.data;

  const recipe = await prisma.recipe.findUnique({
    where: {
      id: input.recipeId,
    },
    include: {
      components: {
        orderBy: {
          id: "asc",
        },
      },
    },
  });

  if (!recipe) {
    return NextResponse.json(
      {
        error: "Recipe not found",
        fields: {
          recipeId: ["Recipe does not exist"],
        },
      },
      { status: 422 },
    );
  }

  const expectedFabricYds = expectedFabricYards(
    Number(recipe.stdFabricYards),
    input.targetQty,
  );

  const expectedComponents = expectedComponentCounts(
    input.targetQty,
    recipe.components.map((component) => ({
      id: component.id,
      componentName: component.componentName,
      piecesPerGarment: component.piecesPerGarment,
    })),
  );

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.cuttingOrder.create({
      data: {
        orderNo: `TEMP-${crypto.randomUUID()}`,
        recipeId: input.recipeId,
        targetQty: input.targetQty,
        fabricRollId: input.fabricRollId,
        actualFabricYds: input.actualFabricYds,
        status: OrderStatus.CUTTING_IN_PROGRESS,
        createdBy: auth.user.id,
      },
    });

    const orderNo = `CUT-${String(created.id).padStart(4, "0")}`;

    return tx.cuttingOrder.update({
      where: {
        id: created.id,
      },
      data: {
        orderNo,
      },
    });
  });

  return NextResponse.json(
    {
      id: order.id,
      orderNo: order.orderNo,
      status: order.status,
      recipeId: order.recipeId,
      targetQty: order.targetQty,
      fabricRollId: order.fabricRollId,
      actualFabricYds: Number(order.actualFabricYds),
      expectedFabricYds,
      expectedComponents,
    },
    { status: 201 },
  );
}
