-- Add txn_id field to Transaction table for deduplication
ALTER TABLE "Transaction" ADD COLUMN "txn_id" TEXT;

-- Create unique constraint on (customer_id, txn_id) for deduplication
-- Note: This will fail if there are existing duplicates
CREATE UNIQUE INDEX "Transaction_customer_id_txn_id_key" ON "Transaction"("customer_id", "txn_id");

