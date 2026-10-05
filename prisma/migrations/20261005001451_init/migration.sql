-- CreateEnum
CREATE TYPE "Role" AS ENUM ('cutting_supervisor', 'cutting_verifier', 'sewing_supervisor');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CUTTING_IN_PROGRESS', 'PENDING_VERIFICATION', 'REJECTED', 'VERIFIED', 'IN_SEWING');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "full_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" SERIAL NOT NULL,
    "recipe_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "std_fabric_yards" DECIMAL(6,2) NOT NULL,
    "wastage_cap" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_components" (
    "id" SERIAL NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "component_name" TEXT NOT NULL,
    "pieces_per_garment" INTEGER NOT NULL,
    "image_url" TEXT,

    CONSTRAINT "recipe_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cutting_orders" (
    "id" SERIAL NOT NULL,
    "order_no" TEXT NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "target_qty" INTEGER NOT NULL,
    "fabric_roll_id" TEXT NOT NULL,
    "actual_fabric_yds" DECIMAL(8,2) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'CUTTING_IN_PROGRESS',
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cutting_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "component_id" INTEGER NOT NULL,
    "expected_qty" INTEGER NOT NULL,
    "actual_qty" INTEGER,
    "status" "ItemStatus",

    CONSTRAINT "verification_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_logs" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "verifier_id" INTEGER NOT NULL,
    "decision" "Decision" NOT NULL,
    "rejection_note" TEXT,
    "wastage_pct" DECIMAL(6,2),
    "variances" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_recipe_code_key" ON "recipes"("recipe_code");

-- CreateIndex
CREATE UNIQUE INDEX "cutting_orders_order_no_key" ON "cutting_orders"("order_no");

-- CreateIndex
CREATE INDEX "cutting_orders_status_idx" ON "cutting_orders"("status");

-- CreateIndex
CREATE INDEX "cutting_orders_created_by_idx" ON "cutting_orders"("created_by");

-- CreateIndex
CREATE INDEX "verification_items_order_id_idx" ON "verification_items"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_items_order_id_component_id_key" ON "verification_items"("order_id", "component_id");

-- CreateIndex
CREATE INDEX "verification_logs_order_id_idx" ON "verification_logs"("order_id");

-- AddForeignKey
ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_items" ADD CONSTRAINT "verification_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "cutting_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_items" ADD CONSTRAINT "verification_items_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "recipe_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_logs" ADD CONSTRAINT "verification_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "cutting_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_logs" ADD CONSTRAINT "verification_logs_verifier_id_fkey" FOREIGN KEY ("verifier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Custom Check Constraints
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_target_qty_check" CHECK ("target_qty" > 0);
ALTER TABLE "cutting_orders" ADD CONSTRAINT "cutting_orders_actual_fabric_yds_check" CHECK ("actual_fabric_yds" > 0);
ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_pieces_per_garment_check" CHECK ("pieces_per_garment" > 0);
ALTER TABLE "verification_items" ADD CONSTRAINT "verification_items_expected_qty_check" CHECK ("expected_qty" > 0);
ALTER TABLE "verification_items" ADD CONSTRAINT "verification_items_actual_qty_check" CHECK ("actual_qty" IS NULL OR "actual_qty" >= 0);
ALTER TABLE "verification_logs" ADD CONSTRAINT "verification_logs_rejected_note_check" CHECK ("decision" != 'REJECTED' OR ("rejection_note" IS NOT NULL AND length(trim("rejection_note")) >= 5));
ALTER TABLE "verification_logs" ADD CONSTRAINT "verification_logs_approved_wastage_check" CHECK ("decision" != 'APPROVED' OR "wastage_pct" IS NOT NULL);

-- Trigger: Prevent UPDATE or DELETE on verification_logs
CREATE OR REPLACE FUNCTION prevent_verification_logs_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'verification_logs rows are append-only and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER verification_logs_no_update_or_delete
BEFORE UPDATE OR DELETE ON "verification_logs"
FOR EACH ROW
EXECUTE FUNCTION prevent_verification_logs_modification();

-- Enable Row Level Security (RLS) with no policies
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recipes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recipe_components" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cutting_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification_logs" ENABLE ROW LEVEL SECURITY;

