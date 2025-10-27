-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email_masked" TEXT NOT NULL,
    "kyc_level" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "last4" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "balance_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "card_id" INTEGER,
    "mcc" TEXT NOT NULL,
    "merchant" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "device_id" TEXT,
    "country" TEXT,
    "city" TEXT,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "suspect_txn_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "risk" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "txn_id" INTEGER,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseEvent" (
    "id" SERIAL NOT NULL,
    "case_id" INTEGER NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,

    CONSTRAINT "CaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TriageRun" (
    "id" SERIAL NOT NULL,
    "alert_id" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "risk" TEXT,
    "reasons" JSONB,
    "fallback_used" BOOLEAN NOT NULL,
    "latency_ms" INTEGER NOT NULL,

    CONSTRAINT "TriageRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTrace" (
    "run_id" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "step" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "detail_json" JSONB NOT NULL,

    CONSTRAINT "AgentTrace_pkey" PRIMARY KEY ("run_id","seq")
);

-- CreateTable
CREATE TABLE "KbDoc" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "anchor" TEXT NOT NULL,
    "content_text" TEXT NOT NULL,

    CONSTRAINT "KbDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content_text" TEXT NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transaction_customer_id_ts_idx" ON "Transaction"("customer_id", "ts" DESC);

-- CreateIndex
CREATE INDEX "Transaction_merchant_idx" ON "Transaction"("merchant");

-- CreateIndex
CREATE INDEX "Transaction_mcc_idx" ON "Transaction"("mcc");

-- CreateIndex
CREATE INDEX "Transaction_customer_id_merchant_idx" ON "Transaction"("customer_id", "merchant");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_suspect_txn_id_fkey" FOREIGN KEY ("suspect_txn_id") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_txn_id_fkey" FOREIGN KEY ("txn_id") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvent" ADD CONSTRAINT "CaseEvent_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriageRun" ADD CONSTRAINT "TriageRun_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "Alert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTrace" ADD CONSTRAINT "AgentTrace_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "TriageRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
