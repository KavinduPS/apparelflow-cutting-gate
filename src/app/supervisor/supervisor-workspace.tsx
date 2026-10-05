"use client";

import { useEffect, useState } from "react";

type RecipeComponent = {
  id: number;
  componentName: string;
  piecesPerGarment: number;
};

type Recipe = {
  id: number;
  recipeCode: string;
  name: string;
  category: string;
  stdFabricYards: number;
  wastageCap: number;
  components: RecipeComponent[];
};

type CuttingOrder = {
  id: number;
  orderNo: string;
  status: string;
  recipeCode: string;
  recipeName: string;
  targetQty: number;
  fabricRollId: string;
  actualFabricYds: number;
  createdAt: string;
};

export function SupervisorWorkspace() {
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipesError, setRecipesError] = useState("");

  const [recipeId, setRecipeId] = useState("");
  const [targetQty, setTargetQty] = useState("");
  const [fabricRollId, setFabricRollId] = useState("");
  const [actualFabricYds, setActualFabricYds] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [orders, setOrders] = useState<CuttingOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");

  useEffect(() => {
    async function loadOrders() {
      setOrdersLoading(true);
      setOrdersError("");

      try {
        const response = await fetch("/api/orders");

        if (!response.ok) {
          throw new Error("Failed to load orders");
        }

        const data = await response.json();

        setOrders(data.orders);
      } catch {
        setOrdersError("Unable to load cutting orders.");
      } finally {
        setOrdersLoading(false);
      }
    }

    loadOrders();
  }, []);

  useEffect(() => {
    async function loadRecipes() {
      setRecipesLoading(true);
      setRecipesError("");

      try {
        const response = await fetch("/api/recipes");

        if (!response.ok) {
          throw new Error("Failed to load recipes");
        }

        const data = await response.json();

        setRecipes(data.recipes);
      } catch {
        setRecipesError("Unable to load recipes.");
      } finally {
        setRecipesLoading(false);
      }
    }

    loadRecipes();
  }, []);

  const selectedRecipe = recipes.find(
    (recipe) => recipe.id === Number(recipeId),
  );

  const quantity = Number(targetQty);

  const expectedFabricYds =
    selectedRecipe && quantity > 0
      ? Number((selectedRecipe.stdFabricYards * quantity).toFixed(2))
      : 0;

  const expectedComponents =
    selectedRecipe && quantity > 0
      ? selectedRecipe.components.map((component) => ({
          ...component,
          expectedQty: quantity * component.piecesPerGarment,
        }))
      : [];

  function resetForm() {
    setRecipeId("");
    setTargetQty("");
    setFabricRollId("");
    setActualFabricYds("");
  }

  function closeModal() {
    resetForm();
    setIsCreateOrderOpen(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipeId: Number(recipeId),
          targetQty: Number(targetQty),
          fabricRollId: fabricRollId.trim(),
          actualFabricYds: Number(actualFabricYds),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSubmitError(data.error ?? "Unable to create the cutting order.");
        return;
      }

      console.log("Order created:", data);

      setOrders((currentOrders) => [
        {
          ...data,
          recipeCode: selectedRecipe?.recipeCode ?? "",
          recipeName: selectedRecipe?.name ?? "",
          createdAt: new Date().toISOString(),
        },
        ...currentOrders,
      ]);

      closeModal();
    } catch {
      setSubmitError("Unable to create the cutting order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="w-full max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Cutting Orders</h2>

          <p className="mt-1 text-sm text-gray-600">
            Create and manage cutting orders.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOrderOpen(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
        >
          Create Order
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-bold text-gray-900">Cutting Orders</h3>
        </div>

        {ordersLoading && (
          <p className="p-6 text-sm text-gray-600">Loading orders...</p>
        )}

        {ordersError && (
          <p className="p-6 text-sm font-medium text-red-700">{ordersError}</p>
        )}

        {!ordersLoading && !ordersError && orders.length === 0 && (
          <p className="p-6 text-sm text-gray-600">
            No cutting orders have been created yet.
          </p>
        )}

        {!ordersLoading && !ordersError && orders.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 font-semibold text-gray-900">
                    Order
                  </th>
                  <th className="px-6 py-3 font-semibold text-gray-900">
                    Recipe
                  </th>
                  <th className="px-6 py-3 font-semibold text-gray-900">
                    Quantity
                  </th>
                  <th className="px-6 py-3 font-semibold text-gray-900">
                    Fabric Roll
                  </th>
                  <th className="px-6 py-3 font-semibold text-gray-900">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-t border-gray-200">
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      {order.orderNo}
                    </td>

                    <td className="px-6 py-4 text-gray-700">
                      {order.recipeCode} — {order.recipeName}
                    </td>

                    <td className="px-6 py-4 text-gray-700">
                      {order.targetQty}
                    </td>

                    <td className="px-6 py-4 text-gray-700">
                      {order.fabricRollId}
                    </td>

                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-900">
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isCreateOrderOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-order-title"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2
                  id="create-order-title"
                  className="text-lg font-bold text-gray-900"
                >
                  Create Cutting Order
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  Enter the production order details.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-md px-2 py-1 text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                aria-label="Close create order dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {recipesLoading && (
                <p className="text-sm text-gray-600">Loading recipes...</p>
              )}

              {recipesError && (
                <p className="text-sm font-medium text-red-700">
                  {recipesError}
                </p>
              )}

              <div>
                <label
                  htmlFor="recipe"
                  className="block text-sm font-semibold text-gray-900"
                >
                  Recipe
                </label>

                <select
                  id="recipe"
                  value={recipeId}
                  onChange={(event) => setRecipeId(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  required
                >
                  <option value="">Select a recipe</option>

                  {recipes.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>
                      {recipe.recipeCode} — {recipe.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedRecipe && (
                <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedRecipe.name}
                  </p>

                  <p className="mt-1 text-xs text-gray-600">
                    Standard fabric: {selectedRecipe.stdFabricYards} yards per
                    garment
                  </p>

                  <p className="text-xs text-gray-600">
                    Wastage cap: {selectedRecipe.wastageCap}%
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="targetQty"
                  className="block text-sm font-semibold text-gray-900"
                >
                  Target Quantity
                </label>

                <input
                  id="targetQty"
                  type="number"
                  min="1"
                  step="1"
                  value={targetQty}
                  onChange={(event) => setTargetQty(event.target.value)}
                  placeholder="e.g. 50"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="fabricRollId"
                  className="block text-sm font-semibold text-gray-900"
                >
                  Fabric Roll ID
                </label>

                <input
                  id="fabricRollId"
                  type="text"
                  value={fabricRollId}
                  onChange={(event) => setFabricRollId(event.target.value)}
                  placeholder="e.g. ROLL-001"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="actualFabricYds"
                  className="block text-sm font-semibold text-gray-900"
                >
                  Actual Fabric Used (yards)
                </label>

                <input
                  id="actualFabricYds"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={actualFabricYds}
                  onChange={(event) => setActualFabricYds(event.target.value)}
                  placeholder="e.g. 92.5"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  required
                />
              </div>

              {selectedRecipe && quantity > 0 && (
                <div className="rounded-md border border-gray-300 bg-white p-4">
                  <h3 className="text-sm font-bold text-gray-900">
                    Production Requirements
                  </h3>

                  <div className="mt-4">
                    <p className="text-sm text-gray-700">
                      Expected fabric:
                      <span className="ml-2 font-bold text-gray-900">
                        {expectedFabricYds} yards
                      </span>
                    </p>
                  </div>

                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-900">
                      Components
                    </h4>

                    <div className="mt-2 overflow-hidden rounded-md border border-gray-200">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-3 py-2 font-semibold text-gray-900">
                              Component
                            </th>

                            <th className="px-3 py-2 text-right font-semibold text-gray-900">
                              Pieces / Garment
                            </th>

                            <th className="px-3 py-2 text-right font-semibold text-gray-900">
                              Required
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {expectedComponents.map((component) => (
                            <tr
                              key={component.id}
                              className="border-t border-gray-200"
                            >
                              <td className="px-3 py-2 text-gray-900">
                                {component.componentName}
                              </td>

                              <td className="px-3 py-2 text-right text-gray-700">
                                {component.piecesPerGarment}
                              </td>

                              <td className="px-3 py-2 text-right font-bold text-gray-900">
                                {component.expectedQty}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              {submitError && (
                <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                  {submitError}
                </p>
              )}
              <div className="flex justify-end gap-3 border-t border-gray-200 pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
