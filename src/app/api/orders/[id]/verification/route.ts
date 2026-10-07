import { NextResponse } from "next/server";
import { prisma } from "@/db/client";
import { requireRole } from "@/lib/auth";
import {
  Decision,
  ItemStatus,
  OrderStatus,
  Role,
} from "@/generated/prisma/enums";
import { z } from "zod";

const verificationSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    rejectionNote: z.string().trim().max(1000).optional(),
    items: z
      .array(
        z.object({
          componentId: z.number().int().positive(),
          actualQty: z.number().int().nonnegative().nullable(),
        }),
      )
      .min(1),
  })
  .strict();

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireRole([Role.cutting_verifier]);

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const orderId = Number(id);

  if (!Number.isInteger(orderId) || orderId < 1) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 422 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 422 });
  }

  const result = verificationSchema.safeParse(body);

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

  if (input.decision === "REJECTED" && !input.rejectionNote) {
    return NextResponse.json(
      {
        error: "Rejection note is required when rejecting an order",
      },
      { status: 422 },
    );
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
      verificationItems: {
        orderBy: {
          componentId: "asc",
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== OrderStatus.PENDING_VERIFICATION) {
    return NextResponse.json(
      {
        error: "Only pending verification orders can be verified",
      },
      { status: 409 },
    );
  }

  const expectedComponentIds = new Set(
    order.recipe.components.map((component) => component.id),
  );

  const submittedComponentIds = new Set(
    input.items.map((item) => item.componentId),
  );

  if (submittedComponentIds.size !== input.items.length) {
    return NextResponse.json(
      {
        error: "Duplicate component IDs are not allowed",
      },
      { status: 422 },
    );
  }

  if (
    submittedComponentIds.size !== expectedComponentIds.size ||
    [...expectedComponentIds].some(
      (componentId) => !submittedComponentIds.has(componentId),
    )
  ) {
    return NextResponse.json(
      {
        error: "Verification must include every recipe component",
      },
      { status: 422 },
    );
  }

  const verificationResults = order.recipe.components.map((component) => {
    const submitted = input.items.find(
      (item) => item.componentId === component.id,
    );

    const verificationItem = order.verificationItems.find(
      (item) => item.componentId === component.id,
    );

    const expectedQty =
      verificationItem?.expectedQty ??
      order.targetQty * component.piecesPerGarment;

    const actualQty = submitted?.actualQty ?? null;

    let status: ItemStatus;

    if (actualQty === null) {
      status = ItemStatus.RED;
    } else if (actualQty < expectedQty) {
      status = ItemStatus.RED;
    } else if (actualQty > expectedQty) {
      status = ItemStatus.YELLOW;
    } else {
      status = ItemStatus.GREEN;
    }

    return {
      componentId: component.id,
      componentName: component.componentName,
      expectedQty,
      actualQty,
      varianceQty: actualQty === null ? null : actualQty - expectedQty,
      status,
    };
  });

  const hasRedComponent = verificationResults.some(
    (item) => item.status === ItemStatus.RED,
  );

  const expectedFabricYds =
    Number(order.recipe.stdFabricYards) * order.targetQty;

  const wastagePct =
    expectedFabricYds > 0
      ? Math.max(
          0,
          Number(
            (
              ((Number(order.actualFabricYds) - expectedFabricYds) /
                expectedFabricYds) *
              100
            ).toFixed(2),
          ),
        )
      : 0;

  const wastageOverCap = wastagePct > Number(order.recipe.wastageCap);

  if (input.decision === "APPROVED" && (hasRedComponent || wastageOverCap)) {
    return NextResponse.json(
      {
        error: "Approval blocked",
        reason: hasRedComponent
          ? "One or more components are missing or below the expected quantity"
          : "Fabric wastage exceeds the recipe cap",
        verificationResults,
        wastagePct,
        wastageCap: Number(order.recipe.wastageCap),
      },
      { status: 422 },
    );
  }

  const nextStatus =
    input.decision === "APPROVED" ? OrderStatus.VERIFIED : OrderStatus.REJECTED;

  const decision = input.decision as Decision;

  const verificationLog = await prisma.$transaction(async (tx) => {
    for (const item of verificationResults) {
      await tx.verificationItem.update({
        where: {
          orderId_componentId: {
            orderId: order.id,
            componentId: item.componentId,
          },
        },
        data: {
          actualQty: item.actualQty,
          status: item.status,
        },
      });
    }

    await tx.cuttingOrder.update({
      where: {
        id: order.id,
      },
      data: {
        status: nextStatus,
      },
    });

    return tx.verificationLog.create({
      data: {
        orderId: order.id,
        verifierId: auth.user.id,
        decision,
        rejectionNote:
          input.decision === "REJECTED" ? input.rejectionNote : null,
        wastagePct,
        variances: verificationResults,
      },
    });
  });

  return NextResponse.json(
    {
      order: {
        id: order.id,
        orderNo: order.orderNo,
        status: nextStatus,
      },
      verificationLog: {
        id: verificationLog.id,
        decision: verificationLog.decision,
        wastagePct: Number(verificationLog.wastagePct),
        timestamp: verificationLog.timestamp,
      },
    },
    { status: 200 },
  );
}
