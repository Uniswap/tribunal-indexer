import { onchainTable, index, primaryKey, relations } from "ponder";

// ============================================================================
// ACCOUNTS & SPONSORS
// ============================================================================

export const account = onchainTable("account", (t) => ({
  address: t.hex().primaryKey(),
  firstSeenAt: t.bigint().notNull(),
}));

// ============================================================================
// ADJUSTERS
// ============================================================================

export const adjuster = onchainTable("adjuster", (t) => ({
  address: t.hex().primaryKey(),
  firstSeenAt: t.bigint().notNull(),
}));

// ============================================================================
// ARBITERS
// ============================================================================

export const arbiter = onchainTable("arbiter", (t) => ({
  address: t.hex().primaryKey(),
  firstSeenAt: t.bigint().notNull(),
}));

// ============================================================================
// MANDATES (Auction Parameters)
// ============================================================================

export const mandate = onchainTable(
  "mandate",
  (t) => ({
    mandateHash: t.hex().notNull(),
    chainId: t.bigint().notNull(),

    // Core mandate data
    sponsorAddress: t.hex().notNull(),
    adjusterAddress: t.hex().notNull(),
    arbiterAddress: t.hex().notNull(),

    // Metadata
    firstSeenAt: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    transactionHash: t.hex().notNull(),

    // Statistics (updated as fills occur)
    totalFills: t.bigint().notNull().default(0n),
    totalCancellations: t.bigint().notNull().default(0n),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.mandateHash, table.chainId] }),
    sponsorIdx: index().on(table.sponsorAddress),
    adjusterIdx: index().on(table.adjusterAddress),
    arbiterIdx: index().on(table.arbiterAddress),
    chainIdIdx: index().on(table.chainId),
  })
);

// ============================================================================
// FILLS (Auction Executions)
// ============================================================================

export const fill = onchainTable(
  "fill",
  (t) => ({
    // Composite ID: claimHash-chainId
    id: t.text().primaryKey(),

    claimHash: t.hex().notNull(),
    mandateHash: t.hex().notNull(),
    chainId: t.bigint().notNull(),

    // Fill details
    sponsorAddress: t.hex().notNull(),
    fillerAddress: t.hex().notNull(),
    claimant: t.hex().notNull(), // Encoded: bytes12(lockTag) + bytes20(recipient)
    targetBlock: t.bigint().notNull(),

    // Original amounts from mandate (stored as JSON arrays of strings to handle BigInt)
    originalMinimumFillAmounts: t.text().notNull(), // JSON: ["amount1", "amount2", ...]
    originalMaximumClaimAmounts: t.text().notNull(), // JSON: ["amount1", "amount2", ...]

    // Realized amounts (stored as JSON arrays of strings to handle BigInt)
    fillAmounts: t.text().notNull(), // JSON: ["amount1", "amount2", ...]
    claimAmounts: t.text().notNull(), // JSON: ["amount1", "amount2", ...]

    // Price improvement metrics (stored as JSON arrays of strings for percentages)
    // For fills: positive values indicate filler received more than minimum
    // For claims: positive values indicate claimant paid less than maximum
    fillPriceImprovements: t.text().notNull(), // JSON: ["10.5", "-5.2", ...] (percentages)
    claimPriceImprovements: t.text().notNull(), // JSON: ["15.0", "8.3", ...] (percentages)

    // Fill recipients (stored as JSON)
    fillRecipients: t.text().notNull(), // JSON: [{"fillAmount": "...", "recipient": "0x..."}, ...]

    // Derived claimant details
    claimantLockTag: t.hex(), // Extracted bytes12
    claimantRecipient: t.hex(), // Extracted bytes20

    // Metadata
    blockNumber: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    transactionHash: t.hex().notNull(),
    logIndex: t.integer().notNull(),

    // Arbiter (from compact)
    arbiterAddress: t.hex().notNull(),
  }),
  (table) => ({
    claimHashIdx: index().on(table.claimHash),
    mandateHashIdx: index().on(table.mandateHash),
    fillerIdx: index().on(table.fillerAddress),
    sponsorIdx: index().on(table.sponsorAddress),
    chainIdIdx: index().on(table.chainId),
    timestampIdx: index().on(table.timestamp),
    arbiterIdx: index().on(table.arbiterAddress),
  })
);

// ============================================================================
// CANCELLATIONS
// ============================================================================

export const cancellation = onchainTable(
  "cancellation",
  (t) => ({
    // Composite ID: claimHash-chainId
    id: t.text().primaryKey(),

    claimHash: t.hex().notNull(),
    mandateHash: t.hex(), // May be null if not determinable
    chainId: t.bigint().notNull(),

    // Cancellation details
    sponsorAddress: t.hex().notNull(),

    // Metadata
    blockNumber: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    transactionHash: t.hex().notNull(),
    logIndex: t.integer().notNull(),
  }),
  (table) => ({
    claimHashIdx: index().on(table.claimHash),
    mandateHashIdx: index().on(table.mandateHash),
    sponsorIdx: index().on(table.sponsorAddress),
    chainIdIdx: index().on(table.chainId),
    timestampIdx: index().on(table.timestamp),
  })
);

// ============================================================================
// DISPATCH EVENTS (Optional - for cross-chain messaging tracking)
// ============================================================================

export const dispatch = onchainTable(
  "dispatch",
  (t) => ({
    // Composite ID: claimHash-chainId-logIndex
    id: t.text().primaryKey(),

    claimHash: t.hex().notNull(),
    chainId: t.bigint().notNull(),
    targetChainId: t.bigint().notNull(),

    // Dispatch details
    targetAddress: t.hex().notNull(),
    claimant: t.hex().notNull(),

    // Metadata
    blockNumber: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    transactionHash: t.hex().notNull(),
    logIndex: t.integer().notNull(),
  }),
  (table) => ({
    claimHashIdx: index().on(table.claimHash),
    chainIdIdx: index().on(table.chainId),
    targetChainIdx: index().on(table.targetChainId),
    timestampIdx: index().on(table.timestamp),
  })
);

// ============================================================================
// CHAIN STATISTICS (Aggregated data)
// ============================================================================

export const chainStatistics = onchainTable("chain_statistics", (t) => ({
  chainId: t.bigint().primaryKey(),

  totalFills: t.bigint().notNull().default(0n),
  totalCancellations: t.bigint().notNull().default(0n),
  uniqueFillers: t.bigint().notNull().default(0n),
  uniqueSponsors: t.bigint().notNull().default(0n),

  lastUpdated: t.bigint().notNull(),
}));

// ============================================================================
// RELATIONS (must be defined after all tables)
// ============================================================================

export const accountRelations = relations(account, ({ many }) => ({
  sponsoredMandates: many(mandate),
  fills: many(fill),
  cancellations: many(cancellation),
}));

export const adjusterRelations = relations(adjuster, ({ many }) => ({
  mandates: many(mandate),
}));

export const arbiterRelations = relations(arbiter, ({ many }) => ({
  mandates: many(mandate),
}));

export const mandateRelations = relations(mandate, ({ one, many }) => ({
  sponsor: one(account, {
    fields: [mandate.sponsorAddress],
    references: [account.address],
  }),
  adjuster: one(adjuster, {
    fields: [mandate.adjusterAddress],
    references: [adjuster.address],
  }),
  arbiter: one(arbiter, {
    fields: [mandate.arbiterAddress],
    references: [arbiter.address],
  }),
  fills: many(fill),
  cancellations: many(cancellation),
}));

export const fillRelations = relations(fill, ({ one }) => ({
  filler: one(account, {
    fields: [fill.fillerAddress],
    references: [account.address],
  }),
  sponsor: one(account, {
    fields: [fill.sponsorAddress],
    references: [account.address],
  }),
  mandate: one(mandate, {
    fields: [fill.mandateHash, fill.chainId],
    references: [mandate.mandateHash, mandate.chainId],
  }),
  arbiter: one(arbiter, {
    fields: [fill.arbiterAddress],
    references: [arbiter.address],
  }),
}));

export const cancellationRelations = relations(cancellation, ({ one }) => ({
  sponsor: one(account, {
    fields: [cancellation.sponsorAddress],
    references: [account.address],
  }),
  mandate: one(mandate, {
    fields: [cancellation.mandateHash, cancellation.chainId],
    references: [mandate.mandateHash, mandate.chainId],
  }),
}));
