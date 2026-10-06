"use client";

import { useEffect, useState } from "react";

type VerificationItem = {
  id: number;
  componentId: number;
  expectedQty: number;
  actualQty: number | null;
  status: "GREEN" | "YELLOW" | "RED" | null;
};

type ActualQuantities = Record<number, number | null>;

type RecipeComponent = {
  id: number;
  componentName: string;
  piecesPerGarment: number;
};

type PendingOrder = {
  id: number;
  orderNo: string;
  status: string;
  targetQty: number;
  fabricRollId: string;
  actualFabricYds: number;
  createdAt: string;
  recipe: {
    recipeCode: string;
    name: string;
    stdFabricYards: number;
    wastageCap: number;
    components: RecipeComponent[];
  };
  verificationItems: VerificationItem[];
};

export function VerifierWorkspace() {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const [actualQuantities, setActualQuantities] = useState<ActualQuantities>(
    {},
  );

  const [loading, setLoading] = useState(true);
  const [queueError, setQueueError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [decision, setDecision] = useState<"APPROVED" | "REJECTED" | null>(
    null,
  );

  const [rejectionNote, setRejectionNote] = useState("");

  useEffect(() => {
    async function loadPendingOrders() {
      setLoading(true);
      setQueueError("");
      try {
        const response = await fetch("/api/orders/pending-verification");

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load verification queue");
        }

        setOrders(data.orders);
      } catch (error) {
        setQueueError(
          error instanceof Error
            ? error.message
            : "Unable to load verification queue.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadPendingOrders();
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);

    return () => clearTimeout(timer);
  }, [toast]);

  const selectedOrder =
    orders.find((order) => order.id === selectedOrderId) ?? null;

  if (loading) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-600">Loading verification queue...</p>
      </section>
    );
  }

  if (queueError) {
    return (
      <section className="rounded-lg border border-red-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-red-700">
          Unable to load verification queue
        </h2>

        <p className="mt-2 text-sm text-gray-700">{queueError}</p>
      </section>
    );
  }

  function getComponentStatus(item: VerificationItem): {
    status: "GREEN" | "YELLOW" | "RED";
    label: string;
  } {
    const actualQty = actualQuantities[item.componentId];

    if (actualQty === null || actualQty === undefined) {
      return {
        status: "RED",
        label: "UNCOUNTED",
      };
    }

    if (actualQty < item.expectedQty) {
      return {
        status: "RED",
        label: "SHORTAGE",
      };
    }

    return {
      status: "GREEN",
      label: "OK",
    };
  }

  function getWastagePercentage(order: PendingOrder): number {
    const expectedFabric = order.recipe.stdFabricYards * order.targetQty;

    if (expectedFabric <= 0) {
      return 0;
    }

    const wastage =
      ((order.actualFabricYds - expectedFabric) / expectedFabric) * 100;

    return Math.max(0, Number(wastage.toFixed(2)));
  }

  function getWastageStatus(order: PendingOrder): {
    status: "GREEN" | "YELLOW" | "RED";
    label: string;
  } {
    const wastage = getWastagePercentage(order);
    const cap = order.recipe.wastageCap;

    if (wastage > cap) {
      return {
        status: "RED",
        label: "OVER CAP",
      };
    }

    if (wastage >= cap * 0.8) {
      return {
        status: "YELLOW",
        label: "NEAR CAP",
      };
    }

    return {
      status: "GREEN",
      label: "WITHIN CAP",
    };
  }

  function getVerificationSummary(order: PendingOrder) {
    const statuses = order.verificationItems.map((item) =>
      getComponentStatus(item),
    );

    const greenCount = statuses.filter(
      (result) => result.status === "GREEN",
    ).length;

    const redCount = statuses.filter(
      (result) => result.status === "RED",
    ).length;

    const yellowCount = statuses.filter(
      (result) => result.status === "YELLOW",
    ).length;

    const wastageStatus = getWastageStatus(order);

    const canApprove = redCount === 0 && wastageStatus.status !== "RED";

    return {
      total: statuses.length,
      greenCount,
      yellowCount,
      redCount,
      wastageStatus,
      canApprove,
    };
  }

  async function handleVerificationSubmit() {
    if (!selectedOrder) {
      return;
    }

    if (!decision) {
      setToast({
        type: "error",
        message: "Please select Approve or Reject.",
      });
      return;
    }

    if (decision === "REJECTED" && !rejectionNote.trim()) {
      setToast({
        type: "error",
        message: "A rejection reason is required.",
      });
      return;
    }

    const items = selectedOrder.verificationItems.map((item) => ({
      componentId: item.componentId,
      actualQty: actualQuantities[item.componentId] ?? null,
    }));

    setSubmitting(true);

    try {
      const response = await fetch(
        `/api/orders/${selectedOrder.id}/verification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            decision,
            rejectionNote:
              decision === "REJECTED" ? rejectionNote.trim() : undefined,
            items,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification failed.");
      }

      setToast({
        type: "success",
        message: `Order ${data.order.orderNo} ${
          decision === "APPROVED" ? "approved" : "rejected"
        } successfully.`,
      });

      setOrders((currentOrders) =>
        currentOrders.filter((order) => order.id !== selectedOrder.id),
      );

      setSelectedOrderId(null);
      setActualQuantities({});
      setDecision(null);
      setRejectionNote("");
    } catch (error) {
      setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to submit verification.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {toast && (
        <div
          role={toast.type === "error" ? "alert" : "status"}
          className={`fixed right-6 top-6 z-50 rounded-lg border px-5 py-4 shadow-lg ${
            toast.type === "success"
              ? "border-green-300 bg-green-50 text-green-800"
              : "border-red-300 bg-red-50 text-red-800"
          }`}
        >
          <p className="text-sm font-semibold">{toast.message}</p>
        </div>
      )}
      <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Pending Orders
            </h2>

            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
              {orders.length}
            </span>
          </div>

          {orders.length === 0 ? (
            <p className="mt-6 text-sm text-gray-600">
              No orders are waiting for verification.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => {
                    setSelectedOrderId(order.id);
                    setActualQuantities({});
                    setDecision(null);
                    setRejectionNote("");
                  }}
                  className={`w-full rounded-md border p-4 text-left transition ${
                    selectedOrderId === order.id
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-400"
                  }`}
                >
                  <p className="font-semibold text-gray-900">{order.orderNo}</p>

                  <p className="mt-1 text-sm text-gray-600">
                    {order.recipe.recipeCode} — {order.recipe.name}
                  </p>

                  <p className="mt-2 text-xs text-gray-500">
                    Target: {order.targetQty}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          {!selectedOrder ? (
            <div className="flex min-h-64 items-center justify-center">
              <p className="text-sm text-gray-500">
                Select an order to begin verification.
              </p>
            </div>
          ) : (
            <>
              <div className="border-b border-gray-200 pb-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-blue-700">
                      {selectedOrder.orderNo}
                    </p>

                    <h2 className="mt-1 text-xl font-bold text-gray-900">
                      {selectedOrder.recipe.name}
                    </h2>

                    <p className="mt-1 text-sm text-gray-600">
                      {selectedOrder.recipe.recipeCode}
                    </p>
                  </div>

                  <span className="rounded-md bg-yellow-100 px-3 py-1.5 text-xs font-bold text-yellow-900">
                    PENDING VERIFICATION
                  </span>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500">
                      Target Quantity
                    </p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {selectedOrder.targetQty}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500">
                      Fabric Roll
                    </p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {selectedOrder.fabricRollId}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500">
                      Actual Fabric
                    </p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {selectedOrder.actualFabricYds.toFixed(2)} yds
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500">
                      Wastage
                    </p>

                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {getWastagePercentage(selectedOrder).toFixed(2)}%
                    </p>

                    <p className="mt-0.5 text-xs text-gray-500">
                      Cap: {selectedOrder.recipe.wastageCap}%
                    </p>

                    {(() => {
                      const result = getWastageStatus(selectedOrder);

                      const statusClasses = {
                        GREEN: "bg-green-100 text-green-800",
                        YELLOW: "bg-yellow-100 text-yellow-800",
                        RED: "bg-red-100 text-red-800",
                      };

                      return (
                        <span
                          className={`mt-2 inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${statusClasses[result.status]}`}
                        >
                          {result.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-base font-semibold text-gray-900">
                  Component Verification
                </h3>

                <p className="mt-1 text-sm text-gray-600">
                  Enter the physically counted quantity for each component.
                </p>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-gray-900">
                          Component
                        </th>
                        <th className="px-4 py-3 font-semibold text-gray-900">
                          Expected
                        </th>
                        <th className="px-4 py-3 font-semibold text-gray-900">
                          Actual
                        </th>
                        <th className="px-4 py-3 font-semibold text-gray-900">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedOrder.verificationItems.map((item) => {
                        const component = selectedOrder.recipe.components.find(
                          (component) => component.id === item.componentId,
                        );

                        return (
                          <tr
                            key={item.id}
                            className="border-t border-gray-200"
                          >
                            <td className="px-4 py-4 font-medium text-gray-900">
                              {component?.componentName ?? "Unknown component"}
                            </td>

                            <td className="px-4 py-4 text-gray-700">
                              {item.expectedQty}
                            </td>

                            <td className="px-4 py-4">
                              <input
                                type="number"
                                min="0"
                                value={actualQuantities[item.componentId] ?? ""}
                                onChange={(event) => {
                                  const value = event.target.value;

                                  setActualQuantities((current) => ({
                                    ...current,
                                    [item.componentId]:
                                      value === "" ? null : Number(value),
                                  }));
                                }}
                                className="w-28 rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Count"
                              />
                            </td>

                            <td className="px-4 py-4">
                              {(() => {
                                const result = getComponentStatus(item);

                                const statusClasses = {
                                  GREEN: "bg-green-100 text-green-800",
                                  YELLOW: "bg-yellow-100 text-yellow-800",
                                  RED: "bg-red-100 text-red-800",
                                };

                                return (
                                  <span
                                    className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${statusClasses[result.status]}`}
                                  >
                                    {result.label}
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {(() => {
                    const summary = getVerificationSummary(selectedOrder);

                    return (
                      <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-5">
                        <h3 className="text-base font-semibold text-gray-900">
                          Verification Summary
                        </h3>

                        <div className="mt-4 grid gap-3 sm:grid-cols-4">
                          <div className="rounded-md border border-gray-200 bg-white p-4">
                            <p className="text-xs font-medium uppercase text-gray-500">
                              Components
                            </p>
                            <p className="mt-1 text-xl font-bold text-gray-900">
                              {summary.total}
                            </p>
                          </div>

                          <div className="rounded-md border border-green-200 bg-white p-4">
                            <p className="text-xs font-medium uppercase text-gray-500">
                              Green
                            </p>
                            <p className="mt-1 text-xl font-bold text-green-700">
                              {summary.greenCount}
                            </p>
                          </div>

                          <div className="rounded-md border border-yellow-200 bg-white p-4">
                            <p className="text-xs font-medium uppercase text-gray-500">
                              Yellow
                            </p>
                            <p className="mt-1 text-xl font-bold text-yellow-700">
                              {summary.yellowCount}
                            </p>
                          </div>

                          <div className="rounded-md border border-red-200 bg-white p-4">
                            <p className="text-xs font-medium uppercase text-gray-500">
                              Red
                            </p>
                            <p className="mt-1 text-xl font-bold text-red-700">
                              {summary.redCount}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-md border border-gray-200 bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                Fabric Wastage
                              </p>

                              <p className="mt-1 text-sm text-gray-600">
                                {getWastagePercentage(selectedOrder).toFixed(2)}
                                %{" / "}
                                {selectedOrder.recipe.wastageCap}% allowed
                              </p>
                            </div>

                            <span
                              className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                                summary.wastageStatus.status === "GREEN"
                                  ? "bg-green-100 text-green-800"
                                  : summary.wastageStatus.status === "YELLOW"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                              }`}
                            >
                              {summary.wastageStatus.label}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 rounded-md border border-gray-200 bg-white p-4">
                          <p className="text-sm font-semibold text-gray-900">
                            Approval Status
                          </p>

                          <p
                            className={`mt-1 text-sm font-semibold ${
                              summary.canApprove
                                ? "text-green-700"
                                : "text-red-700"
                            }`}
                          >
                            {summary.canApprove
                              ? "Ready for approval"
                              : "Approval blocked"}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="mt-6 border-t border-gray-200 pt-6">
                    <h3 className="text-base font-semibold text-gray-900">
                      Verification Decision
                    </h3>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setDecision("APPROVED")}
                        className={`rounded-md px-4 py-2 text-sm font-semibold ${
                          decision === "APPROVED"
                            ? "bg-green-700 text-white"
                            : "border border-green-700 bg-white text-green-700 hover:bg-green-50"
                        }`}
                      >
                        Approve Order
                      </button>

                      <button
                        type="button"
                        onClick={() => setDecision("REJECTED")}
                        className={`rounded-md px-4 py-2 text-sm font-semibold ${
                          decision === "REJECTED"
                            ? "bg-red-700 text-white"
                            : "border border-red-700 bg-white text-red-700 hover:bg-red-50"
                        }`}
                      >
                        Reject Order
                      </button>
                    </div>

                    {decision === "REJECTED" && (
                      <div className="mt-4">
                        <label
                          htmlFor="rejection-note"
                          className="block text-sm font-semibold text-gray-900"
                        >
                          Rejection Reason
                        </label>

                        <textarea
                          id="rejection-note"
                          value={rejectionNote}
                          onChange={(event) =>
                            setRejectionNote(event.target.value)
                          }
                          rows={4}
                          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Explain why this order is being rejected..."
                        />

                        <p className="mt-1 text-xs text-gray-500">
                          A rejection reason is required before the order can be
                          rejected.
                        </p>
                      </div>
                    )}
                    <div className="mt-6 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleVerificationSubmit}
                        disabled={!decision || submitting}
                        className="rounded-md bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                      >
                        {submitting ? "Submitting..." : "Submit Verification"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
