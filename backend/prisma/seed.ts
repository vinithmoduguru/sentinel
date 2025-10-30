import { PrismaClient } from "@prisma/client"
import { faker } from "@faker-js/faker"
import dotenv from "dotenv"
import fs from "fs"
import path from "path"

const prisma = new PrismaClient()

async function main() {
  // Load environment variables (for TXN_COUNT, BATCH_SIZE, etc.)
  dotenv.config()

  const totalTransactionsEnv = process.env.TXN_COUNT
  const transactionsBatchSizeEnv = process.env.BATCH_SIZE

  const totalTransactions = Number.isFinite(Number(totalTransactionsEnv))
    ? Number(totalTransactionsEnv)
    : 1_000_000

  const transactionsBatchSize = Number.isFinite(
    Number(transactionsBatchSizeEnv)
  )
    ? Number(transactionsBatchSizeEnv)
    : 5000

  console.log("🌱 Starting database seed...")
  console.log(
    `🔧 Using config: TXN_COUNT=${totalTransactions.toLocaleString()}, BATCH_SIZE=${transactionsBatchSize.toLocaleString()}`
  )

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
  console.log("💰 Creating transactions...")
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
  // values are derived from environment variables (with defaults set above)
  // use id arrays to avoid carrying full objects in selection
  const customerIds = customers.map((c) => c.id)
  const cardIds = cards.map((c) => c.id)

  console.log(
    `💰 Creating ${totalTransactions.toLocaleString()} transactions in batches of ${transactionsBatchSize.toLocaleString()}...`
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

  // 🔟 Create KbDoc entries with real, searchable content
  console.log("📚 Creating knowledge base documents...")

  const kbDocs = [
    {
      title: "Card Fraud Prevention Guidelines",
      anchor: "fraud_prevention",
      content:
        "Card fraud prevention involves multiple layers of security. Monitor for unusual spending patterns, velocity checks (multiple transactions in short timeframes), and geographic anomalies. Always verify device fingerprints and require additional authentication for high-risk transactions. Common fraud indicators include: transactions from foreign countries without travel history, multiple failed authorization attempts, and sudden large purchases after account dormancy.",
    },
    {
      title: "Chargeback and Dispute Resolution",
      anchor: "dispute_resolution",
      content:
        "When handling chargebacks and disputes, follow reason code guidelines. Reason code 10.4 indicates 'Fraud - Card Absent Environment' where the cardholder claims they did not authorize the transaction. For disputes, gather transaction details, merchant information, and any authentication logs. Respond within regulatory timeframes (typically 30 days for Visa/Mastercard). Document all evidence including device ID, IP address, and transaction timestamps.",
    },
    {
      title: "Identity Verification and KYC",
      anchor: "kyc_verification",
      content:
        "Know Your Customer (KYC) procedures are mandatory for compliance. Full KYC requires government-issued ID, proof of address, and biometric verification. Limited KYC allows reduced transaction limits with basic information. Pending KYC status restricts account functionality until verification completes. Re-verify customer identity annually or when suspicious activity is detected.",
    },
    {
      title: "Transaction Monitoring Best Practices",
      anchor: "transaction_monitoring",
      content:
        "Effective transaction monitoring includes velocity checks, amount thresholds, merchant category code (MCC) analysis, and geographic risk scoring. Flag transactions that exceed normal customer behavior patterns. Monitor for velocity fraud: multiple small transactions testing card validity before larger purchases. Set appropriate thresholds based on customer risk profile and historical spending patterns.",
    },
    {
      title: "AML and Sanctions Compliance",
      anchor: "aml_compliance",
      content:
        "Anti-Money Laundering (AML) compliance requires monitoring for structuring (breaking large amounts into smaller transactions), unusual wire transfers, and high-risk jurisdictions. Screen against OFAC, UN, and EU sanctions lists. Report suspicious activity via SAR (Suspicious Activity Report) within required timeframes. Maintain transaction records for minimum 5 years.",
    },
    {
      title: "Device and Behavioral Analytics",
      anchor: "device_analytics",
      content:
        "Device fingerprinting tracks unique device identifiers including browser type, screen resolution, timezone, and installed fonts. New device detection triggers additional authentication requirements. Behavioral analytics monitor typing patterns, mouse movements, and session duration. Flag sudden device changes, especially when combined with unusual transaction patterns or location changes.",
    },
    {
      title: "Geographic Risk and Travel Detection",
      anchor: "travel_detection",
      content:
        "Geographic risk scoring considers transaction country, customer residence, and recent travel history. Flag transactions from high-risk countries or when location changes rapidly (velocity check across geography). Allow legitimate travel by monitoring gradual location changes or checking travel notifications. Consider timezone consistency - transactions at unusual local times may indicate fraud.",
    },
    {
      title: "Pre-authorization vs Settlement",
      anchor: "preauth_settlement",
      content:
        "Pre-authorization (auth hold) reserves funds but doesn't complete payment immediately. Common in hotels, gas stations, and car rentals. The final settlement amount may differ from the authorization amount (hotel incidentals, actual gas pump amount). Customers often see 'duplicate charges' when both auth and settlement appear temporarily. Authorizations typically release within 3-7 business days if not settled. Explain this to customers to resolve confusion.",
    },
    {
      title: "High-Risk Merchant Categories",
      anchor: "high_risk_mcc",
      content:
        "Certain MCC codes indicate higher fraud risk: 5732 (electronics stores), 5999 (miscellaneous retail), 4899 (telecom), 5816 (gaming). These categories have higher chargeback rates and fraud occurrence. Apply additional scrutiny including transaction amount limits, velocity checks, and enhanced authentication. Balance fraud prevention with customer experience.",
    },
    {
      title: "Customer Communication Protocols",
      anchor: "customer_communication",
      content:
        "When contacting customers about suspicious activity, use verified contact information from account records. Never request full card numbers, CVV, or passwords. Explain specific concerns: 'We noticed a transaction at ABC Mart for ₹4,999 yesterday - did you authorize this?' Provide clear next steps: freeze card, file dispute, or confirm legitimate activity. Document all customer interactions in case management system.",
    },
  ]

  for (const doc of kbDocs) {
    await prisma.kbDoc.create({
      data: {
        title: doc.title,
        anchor: doc.anchor,
        content_text: doc.content,
      },
    })
  }

  // 1️⃣1️⃣ Create Policy entries with real, enforceable content
  console.log("📜 Creating policy documents...")

  const policies = [
    {
      code: "POL_001",
      title: "Dispute and Chargeback Handling Policy",
      content:
        "All disputes must be logged within 60 days of transaction date. Investigate transaction authenticity using device ID, IP address, merchant information, and customer communication history. Disputes with reason code 10.4 (fraud - card absent) require immediate card freeze and customer contact. Provide evidence to card networks within 30 days. Document all findings in case management system. Follow escalation procedures for disputes exceeding ₹50,000.",
    },
    {
      code: "POL_002",
      title: "Fraud Detection and Prevention Policy",
      content:
        "Implement multi-layered fraud detection including velocity checks, device fingerprinting, and geographic risk scoring. Transactions exceeding ₹25,000 require additional authentication. Flag new device usage combined with high-value transactions. Monitor for card testing patterns (multiple small transactions). Freeze cards automatically when 3+ failed authorization attempts occur within 1 hour. Maintain false positive rate below 2% while detecting 95%+ of fraudulent transactions.",
    },
    {
      code: "POL_003",
      title: "Customer Authentication and OTP Policy",
      content:
        "OTP (One-Time Password) is required for: card freeze/unfreeze actions by agent role, transactions above ₹50,000, and new device authorization. OTP expires after 5 minutes. Maximum 3 OTP attempts allowed before account lockout. Lead role can bypass OTP for emergency actions but must document justification. Never share OTP codes via email - use SMS or authenticator app only.",
    },
    {
      code: "POL_004",
      title: "Data Privacy and PII Protection Policy",
      content:
        "All Personally Identifiable Information (PII) must be redacted in logs and traces. Card numbers (PAN) with 13-19 digits must be masked as ****REDACTED****. Email addresses must be partially masked (e.g., user@****). Never log full CVV, PIN, or passwords. Access to unmasked PII requires lead role and documented business justification. Comply with data protection regulations including GDPR, PCI-DSS, and local privacy laws.",
    },
    {
      code: "POL_005",
      title: "KYC and Identity Verification Policy",
      content:
        "Full KYC verification required for accounts with cumulative transactions exceeding ₹1,00,000. Limited KYC allows up to ₹50,000 monthly limit. Verification documents must include government-issued ID and proof of address less than 3 months old. Reverify identity annually or when suspicious activity detected. Pending KYC accounts restricted to ₹10,000 transaction limit. Enhanced due diligence required for high-risk customers or politically exposed persons (PEPs).",
    },
    {
      code: "POL_006",
      title: "Transaction Monitoring and Alerts Policy",
      content:
        "Monitor all transactions for risk indicators. Generate alerts for: transactions from high-risk countries, velocity exceeding 5 transactions per hour, amount exceeding 3x average transaction size, and MCC code changes indicating card compromise. Alerts must be triaged within 4 hours during business hours, 24 hours otherwise. High-risk alerts require immediate action. Maintain audit trail of all triage decisions.",
    },
    {
      code: "POL_007",
      title: "Case Management and Escalation Policy",
      content:
        "All cases must be assigned within 1 hour of creation. Agent role can handle standard cases; lead role required for disputes exceeding ₹1,00,000, fraud cases with potential criminal activity, and regulatory compliance matters. Cases must be updated every 24 hours with progress notes. Resolve disputes within 30 days, fraud investigations within 15 days. Escalate to management if unable to meet SLA.",
    },
    {
      code: "POL_008",
      title: "Knowledge Base Search and Citation Policy",
      content:
        "All case actions must reference relevant KB documents or policies. Maximum 10 search results per query to ensure relevance. Cite policy codes and KB anchors in case notes. Update KB documents quarterly or when regulatory changes occur. Agents must review cited documents before applying recommendations. Track KB usage metrics to identify gaps in documentation.",
    },
    {
      code: "POL_009",
      title: "Rate Limiting and API Access Policy",
      content:
        "API rate limit: 5 requests per second per client. Exceeded requests return HTTP 429 with Retry-After header. Implement exponential backoff for retries. Critical operations (card freeze, dispute filing) have dedicated quota. Rate limits enforced via Redis token bucket algorithm. Monitor for abuse patterns indicating bot activity or DDoS attempts. Temporary rate limit increases require lead approval.",
    },
    {
      code: "POL_010",
      title: "Incident Response and Business Continuity Policy",
      content:
        "Critical incidents (data breach, system outage, fraud spike) trigger incident response protocol. Notify stakeholders within 1 hour. Assemble incident response team including security, compliance, and engineering. Document all actions in incident timeline. Post-incident review required within 48 hours. Implement circuit breakers and fallback mechanisms for service dependencies. Maintain 99.9% uptime SLA for core services.",
    },
  ]

  for (const policy of policies) {
    await prisma.policy.create({
      data: {
        code: policy.code,
        title: policy.title,
        content_text: policy.content,
      },
    })
  }

  // 1️⃣2️⃣ Create deterministic eval fixtures
  console.log("🧪 Creating deterministic eval fixtures...")

  // Create a special eval customer with known ID (using first customer)
  const evalCustomer = customers[0]
  const evalCard = cards[0]

  if (!evalCustomer || !evalCard) {
    console.warn(
      "⚠️  No customers/cards available for eval fixtures. Skipping."
    )
    console.log("✅ Seeding complete!")
    return
  }

  const evalAccount = await prisma.account.findFirst({
    where: { customer_id: evalCustomer.id },
  })

  // Create specific transactions for eval scenarios
  const evalTxn1001 = await prisma.transaction.create({
    data: {
      customer_id: evalCustomer.id,
      card_id: evalCard.id,
      mcc: "5999",
      merchant: "ABC Mart",
      amount_cents: 499900, // ₹4,999
      currency: "INR",
      ts: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
      device_id: faker.string.uuid(),
      country: "IN",
      city: "Mumbai",
    },
  })

  const evalTxn1002 = await prisma.transaction.create({
    data: {
      customer_id: evalCustomer.id,
      card_id: evalCard.id,
      mcc: "4111",
      merchant: "QuickCab",
      amount_cents: 25000, // ₹250
      currency: "INR",
      ts: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      device_id: faker.string.uuid(),
      country: "IN",
      city: "Delhi",
    },
  })

  // Create a high-risk transaction
  const evalTxn1003 = await prisma.transaction.create({
    data: {
      customer_id: evalCustomer.id,
      card_id: evalCard.id,
      mcc: "5732",
      merchant: "Unknown Electronics",
      amount_cents: 9999900, // ₹99,999 - large amount
      currency: "INR",
      ts: new Date(),
      device_id: faker.string.uuid(),
      country: "IN",
      city: "Bangalore",
    },
  })

  // Create an alert for eval
  const evalAlert = await prisma.alert.create({
    data: {
      customer_id: evalCustomer.id,
      suspect_txn_id: evalTxn1003.id,
      risk: "HIGH",
      status: "OPEN",
      created_at: new Date(),
    },
  })

  // Write eval fixture files
  // Determine project root: when running from backend/, cwd is backend/
  // We need to go to sentinel/ root
  const backendDir = process.cwd().includes("/backend")
    ? process.cwd()
    : path.join(process.cwd(), "backend")
  const projectRoot = path.dirname(backendDir)
  const fixturesDir = path.join(projectRoot, "fixtures")
  const evalsDir = path.join(fixturesDir, "evals")

  // Ensure directories exist
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true })
  }
  if (!fs.existsSync(evalsDir)) {
    fs.mkdirSync(evalsDir, { recursive: true })
  }

  // Generate eval fixtures with actual IDs matching the expected format
  const evalFixtures = {
    freeze_otp: {
      name: "Freeze Card - OTP Flow",
      description: "Validate OTP soft-block then success with correct OTP.",
      cases: [
        {
          id: "freeze-otp-pending",
          category: "freeze_otp",
          input: { payload: { cardId: evalCard.id } },
          expected: { status: "PENDING_OTP" },
        },
        {
          id: "freeze-otp-success",
          category: "freeze_otp",
          input: {
            payload: { cardId: evalCard.id, otp: "123456" },
          },
          expected: { status: "FROZEN" },
        },
      ],
    },
    dispute: {
      name: "Dispute Creation",
      description: "Open dispute returns OPEN status and KB citation present.",
      cases: [
        {
          id: "dispute-open",
          category: "dispute",
          input: {
            payload: {
              txnId: evalTxn1001.id,
              reasonCode: "10.4",
              confirm: true,
            },
          },
          expected: { status: "OPEN" },
        },
        {
          id: "dispute-kb-citation",
          category: "kb_citation",
          input: {
            payload: {
              txnId: evalTxn1001.id,
              reasonCode: "10.4",
              confirm: true,
            },
          },
          expected: { kbCitation: true },
        },
      ],
    },
    duplicate_auth_vs_capture: {
      name: "Duplicate Auth vs Capture",
      description:
        "Explain preauth vs capture; no dispute needed; risk low/medium.",
      cases: [
        {
          id: "duplicate-auth-vs-capture",
          category: "duplicate_auth_vs_capture",
          input: {
            triage: { alertId: evalAlert.id, customerId: evalCustomer.id },
          },
          expected: {
            dispute: false,
            risk: "low|medium",
          },
        },
      ],
    },
    ambiguous_merchants: {
      name: "Ambiguous Merchants",
      description:
        "Insights should provide disambiguation when merchants have similar names.",
      cases: [
        {
          id: "ambiguous-merchant",
          category: "ambiguous_merchant",
          input: { customerId: evalCustomer.id },
          expected: { summary_contains: ["merchant", "transaction"] },
        },
      ],
    },
    device_change: {
      name: "Device Change",
      description: "New device should increase risk score and include reason.",
      cases: [
        {
          id: "new-device-reason",
          category: "device_change",
          input: {
            triage: {
              alertId: evalAlert.id,
              customerId: evalCustomer.id,
              context: { devices: [{ id: "known-device-1" }] },
            },
          },
          expected: { reasons_include: ["device"] },
        },
      ],
    },
    fallback_path: {
      name: "Fallback Path - Circuit Breaker",
      description:
        "When risk tool circuit is open, fallback should be used automatically.",
      cases: [
        {
          id: "fallback-circuit-open",
          category: "fallback_path",
          input: {
            triage: {
              alertId: evalAlert.id,
              customerId: evalCustomer.id,
              simulate: { riskSignals: "circuit_open" },
            },
          },
          expected: { fallback_used: true },
        },
      ],
    },
    risk_timeout_fallback: {
      name: "Risk Timeout → Fallback",
      description:
        "When risk tool times out and retries exhaust, fallback is used.",
      cases: [
        {
          id: "risk-timeout",
          category: "risk_timeout",
          input: {
            triage: {
              alertId: evalAlert.id,
              customerId: evalCustomer.id,
              simulate: { riskSignals: "timeout" },
            },
          },
          expected: { fallback_used: true, risk: "low|medium" },
        },
      ],
    },
    travel_window: {
      name: "Travel Window",
      description: "Foreign country transaction should be noted in reasons.",
      cases: [
        {
          id: "travel-foreign-country",
          category: "travel_window",
          input: {
            triage: {
              alertId: evalAlert.id,
              customerId: evalCustomer.id,
              context: { profile: { recentCountries: ["IN"] } },
            },
          },
          expected: { reasons_include: ["country"] },
        },
      ],
    },
    pii_redaction: {
      name: "PII Redaction",
      description: "PAN-like sequences redacted in UI/logs/traces.",
      cases: [
        {
          id: "pii-redaction-pan",
          category: "pii_redaction",
          input: {
            triage: {
              alertId: evalAlert.id,
              customerId: evalCustomer.id,
            },
          },
          expected: { redacted: true },
        },
      ],
    },
    rate_limit: {
      name: "Rate Limit Behavior",
      description: "429 with Retry-After on rate limit exceeded.",
      cases: [
        {
          id: "rate-limit-429",
          category: "rate_limit",
          input: { requests: 10, path: "/api/alerts" },
          expected: { status: 429 },
        },
      ],
    },
    performance_90d: {
      name: "Performance - 90 Day Query",
      description: "p95 ≤ 100ms for 90-day transaction query.",
      cases: [
        {
          id: "perf-90d",
          category: "performance",
          input: {
            customerId: evalCustomer.id,
            range: "90d",
          },
          expected: { p95_ms: "<=100" },
        },
      ],
    },
  }

  // Write each eval fixture
  for (const [filename, fixture] of Object.entries(evalFixtures)) {
    const filepath = path.join(evalsDir, `${filename}.json`)
    fs.writeFileSync(filepath, JSON.stringify(fixture, null, 2))
    console.log(`  ✓ Created ${filename}.json`)
  }

  // Write a readme for the evals directory
  const readme = {
    name: "Eval Fixtures Documentation",
    description:
      "These eval fixtures are auto-generated during database seeding with actual IDs from the database. They test all acceptance scenarios from the spec.",
    categories: [
      "freeze_otp - OTP flow validation",
      "dispute - Dispute creation with KB citations",
      "duplicate_auth_vs_capture - Preauth vs capture scenarios",
      "ambiguous_merchant - Insights API merchant disambiguation",
      "device_change - New device detection in triage",
      "fallback_path - Circuit breaker fallback behavior",
      "risk_timeout - Risk tool timeout handling",
      "travel_window - Foreign country transaction detection",
      "pii_redaction - PAN redaction in traces",
      "rate_limit - 429 rate limiting behavior",
      "performance - 90-day query performance benchmarks",
    ],
    usage: "POST /api/evals/run to execute all eval cases",
    regeneration:
      "These files are overwritten on each seed run. Custom evals should use different filenames.",
  }
  fs.writeFileSync(
    path.join(evalsDir, "readme.json"),
    JSON.stringify(readme, null, 2)
  )
  console.log("  ✓ Created readme.json")

  // Write a reference file with the eval customer/card/transaction IDs
  const evalReference = {
    description:
      "Reference IDs for eval scenarios - generated during seed script",
    customerId: evalCustomer.id,
    customerName: evalCustomer.name,
    cardId: evalCard.id,
    cardLast4: evalCard.last4,
    accountId: evalAccount?.id,
    transactions: {
      dispute_target: evalTxn1001.id, // ABC Mart ₹4,999
      duplicate_check: evalTxn1002.id, // QuickCab ₹250
      high_risk: evalTxn1003.id, // Unknown Electronics ₹99,999
    },
    alertId: evalAlert.id,
  }

  fs.writeFileSync(
    path.join(evalsDir, "_eval_reference.json"),
    JSON.stringify(evalReference, null, 2)
  )
  console.log("  ✓ Created _eval_reference.json")

  console.log("✅ Seeding complete!")
  console.log(`📊 Summary:`)
  console.log(`   - ${customers.length.toLocaleString()} customers`)
  console.log(
    `   - ${totalTransactions.toLocaleString()} transactions (bulk + eval)`
  )
  console.log(`   - ${alerts.length} alerts`)
  console.log(`   - ${cases.length} cases`)
  console.log(`   - Eval fixtures ready in ${evalsDir}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ Seeding error:", e)
    prisma.$disconnect()
  })
