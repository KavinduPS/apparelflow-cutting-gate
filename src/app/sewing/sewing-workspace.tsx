"use client";

import { useEffect, useState, Fragment } from "react";

type SewingOrder = {
  id: number;
  orderNo: string;
  status: "VERIFIED";
  targetQty: number;
  fabricRollId: string;
  actualFabricYds: number;

  recipe: {
    recipeCode: string;
    name: string;
  };

  verificationItems: {
    componentId: number;
    componentName: string;
    expectedQty: number;
    actualQty: number | null;
    status: "GREEN" | "YELLOW" | "RED" | null;
  }[];

  verification: {
    verifierId: number;
    verifierName: string;
    verifiedAt: string;
    wastagePct: number;
  } | null;

  verifiedAt: string;
};

export function SewingWorkspace() {
  const [orders, setOrders] = useState<SewingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startingOrderId, setStartingOrderId] = useState<number | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  useEffect(() => {
    async function loadQueue() {
      try {
        const response = await fetch("/api/orders/sewing-queue");

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load sewing queue");
        }

        setOrders(data.orders);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load sewing queue",
        );
      } finally {
        setLoading(false);
      }
    }
    loadQueue();
  }, []);

  async function handleStartSewing(orderId: number) {
    try {
      setStartingOrderId(orderId);
      setError("");

      const response = await fetch(`/api/orders/${orderId}/start-sewing`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to start sewing");
      }

      setOrders((currentOrders) =>
        currentOrders.filter((order) => order.id !== orderId),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start sewing");
    } finally {
      setStartingOrderId(null);
    }
  }

  return (
    <section className="w-full max-w-6xl">
      <div className="mb-6 rounded-lg border border-gray-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-10 w-1 rounded-full bg-blue-700" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Sewing Queue</h2>
            <p className="mt-1 text-sm text-gray-600">
              Verified cutting orders ready to enter sewing.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
          Loading sewing queue...
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <h3 className="font-semibold text-gray-900">
            No orders ready for sewing
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Verified orders will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Order
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Recipe
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Quantity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Fabric Roll
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Fabric Used
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {orders.map((order) => (
                  <Fragment key={order.id}>
                    <tr
                      key={order.id}
                      onClick={() =>
                        setExpandedOrderId(
                          expandedOrderId === order.id ? null : order.id,
                        )
                      }
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <td className="whitespace-nowrap px-4 py-4">
                        <div className="font-semibold text-gray-900">
                          {order.orderNo}
                        </div>
                        <div className="text-xs text-gray-500">
                          {order.status}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-900">
                          {order.recipe.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {order.recipe.recipeCode}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700">
                        {order.targetQty}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700">
                        {order.fabricRollId}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700">
                        {order.actualFabricYds} yds
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleStartSewing(order.id);
                          }}
                          disabled={startingOrderId === order.id}
                          className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-400 cursor-pointer"
                        >
                          {startingOrderId === order.id
                            ? "Starting..."
                            : "Start Sewing"}
                        </button>
                      </td>
                    </tr>
                    {expandedOrderId === order.id && (
                      <tr>
                        <td colSpan={6} className="bg-gray-50 px-6 py-5">
                          <div className="space-y-5">
                            <div>
                              <h3 className="text-sm font-bold text-gray-900">
                                Verification Details
                              </h3>

                              <div className="mt-3 grid gap-4 md:grid-cols-3">
                                <div>
                                  <p className="text-xs font-semibold uppercase text-gray-500">
                                    Verified By
                                  </p>
                                  <p className="mt-1 text-sm font-medium text-gray-900">
                                    {order.verification?.verifierName ??
                                      "Unavailable"}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-xs font-semibold uppercase text-gray-500">
                                    Verified At
                                  </p>
                                  <p className="mt-1 text-sm text-gray-900">
                                    {order.verification
                                      ? new Date(
                                          order.verification.verifiedAt,
                                        ).toLocaleString()
                                      : "Unavailable"}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-xs font-semibold uppercase text-gray-500">
                                    Fabric Wastage
                                  </p>
                                  <p className="mt-1 text-sm font-medium text-gray-900">
                                    {order.verification?.wastagePct.toFixed(
                                      2,
                                    ) ?? "0.00"}
                                    %
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div>
                              <h3 className="text-sm font-bold text-gray-900">
                                Component Piece Counts
                              </h3>

                              <div className="mt-3 overflow-hidden rounded-md border border-gray-200 bg-white">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                                        Component
                                      </th>
                                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                                        Expected
                                      </th>
                                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                                        Actual
                                      </th>
                                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">
                                        Status
                                      </th>
                                    </tr>
                                  </thead>

                                  <tbody className="divide-y divide-gray-200">
                                    {order.verificationItems.map((item) => (
                                      <tr key={item.componentId}>
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                          {item.componentName}
                                        </td>

                                        <td className="px-4 py-3 text-right text-sm text-gray-700">
                                          {item.expectedQty}
                                        </td>

                                        <td className="px-4 py-3 text-right text-sm text-gray-700">
                                          {item.actualQty ?? "Not counted"}
                                        </td>

                                        <td className="px-4 py-3 text-center">
                                          <span
                                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                              item.status === "GREEN"
                                                ? "bg-green-100 text-green-800"
                                                : item.status === "YELLOW"
                                                  ? "bg-yellow-100 text-yellow-800"
                                                  : "bg-red-100 text-red-800"
                                            }`}
                                          >
                                            {item.status ?? "UNKNOWN"}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
