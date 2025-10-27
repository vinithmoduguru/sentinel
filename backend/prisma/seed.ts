import { PrismaClient } from "@prisma/client"
import { faker } from "@faker-js/faker"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Starting database seed...")

  // Clean up existing data
  console.log("🧹 Cleaning up existing data...")
  await prisma.agentTrace.deleteMany({})
  await prisma.triageRun.deleteMany({})
  await prisma.caseEvent.deleteMany({})
  await prisma.case.deleteMany({})
  await prisma.alert.deleteMany({})
  await prisma.transaction.deleteMany({})
  await prisma.account.deleteMany({})
  await prisma.card.deleteMany({})
  await prisma.policy.deleteMany({})
  await prisma.kbDoc.deleteMany({})
  await prisma.customer.deleteMany({})

  // 1️⃣ Create Customers
  console.log("📝 Creating 10000 customers...")
  const customers = []
  for (let i = 0; i < 10000; i++) {
    const customer = await prisma.customer.create({
      data: {
        name: faker.person.fullName(),
        email_masked: faker.internet.email().replace(/@.*/, "@****"),
        kyc_level: faker.helpers.arrayElement(["FULL", "LIMITED", "PENDING"]),
        created_at: faker.date.past(),
      },
    })
    customers.push(customer)
  }

  // 2️⃣ Create Cards for each customer
  console.log("💳 Creating cards for each customer...")
  const cards = []
  for (const customer of customers) {
    const card = await prisma.card.create({
      data: {
        customer_id: customer.id,
        last4: faker.finance.creditCardNumber().slice(-4),
        network: faker.helpers.arrayElement(["Visa", "Mastercard", "RuPay"]),
        status: faker.helpers.arrayElement(["ACTIVE", "BLOCKED"]),
        created_at: faker.date.past(),
      },
    })
    cards.push(card)
  }

  // 3️⃣ Create Accounts for each customer
  console.log("🏦 Creating accounts for each customer...")
  for (const customer of customers) {
    await prisma.account.create({
      data: {
        customer_id: customer.id,
        balance_cents: faker.number.int({ min: 10000, max: 10000000 }),
        currency: "INR",
      },
    })
  }

  // 4️⃣ Create Transactions
  console.log("💰 Creating ~1M transactions...")
  const merchants = [
    "Amazon",
    "Uber",
    "Zomato",
    "QuickCab",
    "Swiggy",
    "Netflix",
    "ABC Mart",
    "Flipkart",
    "Paytm",
    "PhonePe",
  ]
  const mccCodes = ["5411", "4111", "5732", "4899", "5812", "5999"]
  const cities = [
    "Mumbai",
    "Delhi",
    "Bangalore",
    "Hyderabad",
    "Pune",
    "Chennai",
    "Kolkata",
    "Ahmedabad",
  ]

  // Generate transactions in batches using createMany (much faster than individual creates)
  const transactionsBatchSize = 5000
  const totalTransactions = 1_000_000
  // use id arrays to avoid carrying full objects in selection
  const customerIds = customers.map((c) => c.id)
  const cardIds = cards.map((c) => c.id)

  console.log(
    `💰 Creating ${totalTransactions.toLocaleString()} transactions in batches of ${transactionsBatchSize}...`
  )

  for (
    let created = 0;
    created < totalTransactions;
    created += transactionsBatchSize
  ) {
    const batch: Array<any> = []
    const batchSize = Math.min(
      transactionsBatchSize,
      totalTransactions - created
    )

    for (let i = 0; i < batchSize; i++) {
      batch.push({
        customer_id: faker.helpers.arrayElement(customerIds),
        card_id: faker.helpers.arrayElement(cardIds),
        mcc: faker.helpers.arrayElement(mccCodes),
        merchant: faker.helpers.arrayElement(merchants),
        amount_cents: faker.number.int({ min: 100, max: 500000 }),
        currency: "INR",
        ts: faker.date.recent({ days: 90 }),
        device_id: faker.string.uuid(),
        country: "IN",
        city: faker.helpers.arrayElement(cities),
      })
    }

    const res = await prisma.transaction.createMany({
      data: batch,
      skipDuplicates: false, // adjust if you expect duplicates
    })

    // res.count is number of rows created in this batch
    console.log(
      `  ✓ Created ${Math.min(created + batchSize, totalTransactions).toLocaleString()} / ${totalTransactions.toLocaleString()} transactions...`
    )
  }

  // createMany doesn't return created rows/ids. Fetch a sample pool of transactions to use for alerts/cases.
  // We only need a reasonably large sample (e.g. 10k) for subsequent randomized selection.
  const sampleSize = 10000
  const transactions = await prisma.transaction.findMany({
    take: sampleSize,
    orderBy: { id: "desc" }, // fetch recent rows (or remove if you prefer first rows)
  })

  // 5️⃣ Create Alerts for suspicious transactions
  console.log("⚠️  Creating alerts for suspicious transactions...")
  const riskLevels = ["LOW", "MEDIUM", "HIGH"]
  const alertStatuses = ["OPEN", "ACKNOWLEDGED", "CLOSED"]
  const alerts = []

  for (let i = 0; i < 500; i++) {
    const randomTxn = faker.helpers.arrayElement(transactions)
    const alert = await prisma.alert.create({
      data: {
        customer_id: randomTxn.customer_id,
        suspect_txn_id: randomTxn.id,
        risk: faker.helpers.arrayElement(riskLevels),
        status: faker.helpers.arrayElement(alertStatuses),
        created_at: faker.date.recent({ days: 30 }),
      },
    })
    alerts.push(alert)
  }

  // 6️⃣ Create TriageRuns for each alert
  console.log("🔍 Creating triage runs...")
  const triageRuns = []
  for (const alert of alerts) {
    const startedAt = faker.date.recent({ days: 30 })
    const endedAt =
      Math.random() > 0.2 ? faker.date.soon({ refDate: startedAt }) : null

    const triageRun = await prisma.triageRun.create({
      data: {
        alert_id: alert.id,
        started_at: startedAt,
        ended_at: endedAt,
        risk: faker.helpers.arrayElement(riskLevels),
        reasons: {
          rules_triggered: faker.datatype.boolean()
            ? ["RULE_1", "RULE_2"]
            : ["RULE_3"],
          confidence: faker.number.float({ min: 0, max: 1 }),
        },
        fallback_used: faker.datatype.boolean(),
        latency_ms: faker.number.int({ min: 50, max: 5000 }),
      },
    })
    triageRuns.push(triageRun)
  }

  // 7️⃣ Create AgentTraces for each triage run
  console.log("📊 Creating agent traces...")
  const steps = ["validate", "analyze", "compare", "decide"]

  for (const run of triageRuns) {
    for (let seq = 0; seq < faker.number.int({ min: 2, max: 5 }); seq++) {
      await prisma.agentTrace.create({
        data: {
          run_id: run.id,
          seq,
          step: faker.helpers.arrayElement(steps),
          ok: faker.datatype.boolean(),
          duration_ms: faker.number.int({ min: 10, max: 500 }),
          detail_json: {
            input: "sample_input",
            output: "sample_output",
            timestamp: new Date().toISOString(),
          },
        },
      })
    }
  }

  // 8️⃣ Create Cases for some transactions
  console.log("📋 Creating cases...")
  const caseTypes = ["FRAUD_SUSPECTED", "DISPUTE", "COMPLIANCE_CHECK"]
  const caseStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]
  const cases = []

  for (let i = 0; i < 200; i++) {
    const randomTxn = faker.helpers.arrayElement(transactions)
    const caseItem = await prisma.case.create({
      data: {
        customer_id: randomTxn.customer_id,
        txn_id: randomTxn.id,
        type: faker.helpers.arrayElement(caseTypes),
        status: faker.helpers.arrayElement(caseStatuses),
        reason_code: faker.datatype.boolean()
          ? `REASON_${faker.number.int({ min: 100, max: 999 })}`
          : null,
        created_at: faker.date.recent({ days: 60 }),
      },
    })
    cases.push(caseItem)
  }

  // 9️⃣ Create CaseEvents for each case
  console.log("📝 Creating case events...")
  const actions = ["CREATED", "REVIEWED", "ESCALATED", "RESOLVED", "COMMENTED"]
  const actors = ["SYSTEM", "ANALYST", "MANAGER", "COMPLIANCE_TEAM"]

  for (const caseItem of cases) {
    for (let i = 0; i < faker.number.int({ min: 1, max: 3 }); i++) {
      await prisma.caseEvent.create({
        data: {
          case_id: caseItem.id,
          ts: faker.date.recent({ days: 60 }),
          actor: faker.helpers.arrayElement(actors),
          action: faker.helpers.arrayElement(actions),
          payload_json: {
            change: "field_changed",
            old_value: "old",
            new_value: "new",
          },
        },
      })
    }
  }

  // 🔟 Create KbDoc entries
  console.log("📚 Creating knowledge base documents...")
  const kbTopics = [
    "Card Fraud Prevention",
    "Identity Verification",
    "Transaction Monitoring",
    "AML Compliance",
    "KYC Guidelines",
  ]

  for (let i = 0; i < 10; i++) {
    await prisma.kbDoc.create({
      data: {
        title: `${faker.helpers.arrayElement(kbTopics)} - Document ${i + 1}`,
        anchor: `doc_${i + 1}`,
        content_text: faker.lorem.paragraphs(3),
      },
    })
  }

  // 1️⃣1️⃣ Create Policy entries
  console.log("📜 Creating policy documents...")
  const policyTopics = [
    "Data Protection",
    "User Privacy",
    "Fraud Detection",
    "Risk Management",
    "Incident Response",
  ]

  for (let i = 0; i < 10; i++) {
    await prisma.policy.create({
      data: {
        code: `POL_${String(i + 1).padStart(3, "0")}`,
        title: `${faker.helpers.arrayElement(policyTopics)} Policy`,
        content_text: faker.lorem.paragraphs(3),
      },
    })
  }

  console.log("✅ Seeding complete!")
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ Seeding error:", e)
    prisma.$disconnect()
  })
