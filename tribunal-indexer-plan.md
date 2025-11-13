# Tribunal Indexer Design Document

## Executive Summary

This document outlines the complete architecture for building a multichain indexer for the Tribunal protocol using Ponder.sh. The indexer will track cross-chain swap settlements, auction executions, and claim dispositions across multiple EVM chains, following the proven patterns established by The Compact indexer.

---

## Table of Contents

1. [Protocol Overview](#protocol-overview)
2. [Key Differences from The Compact](#key-differences-from-the-compact)
3. [Events to Index](#events-to-index)
4. [Database Schema](#database-schema)
5. [Ponder Configuration](#ponder-configuration)
6. [Event Handlers](#event-handlers)
7. [GraphQL API Queries](#graphql-api-queries)
8. [Implementation Checklist](#implementation-checklist)
9. [Testing Strategy](#testing-strategy)

---

## Protocol Overview

### What is Tribunal?

Tribunal is a protocol for running competitive priority gas auctions (PGA) for claims against resource locks in The Compact. It enables:

- **Price Derivation**: Calculates fill/claim amounts based on sponsor parameters, adjuster settings, auction start block, current block, and priority fees
- **Filler Selection**: Designates a single filler per auction and their designated claimant
- **Result Distribution**: Makes auction results available via callbacks, state queries, or on-chain claims

### Core Roles

1. **Sponsor**: Creates and signs auction parameters (mandates), controls input tokens
2. **Adjuster**: Trusted party who provides signed adjustments, selects fills, sets auction parameters
3. **Filler**: Provides output tokens and designates claimant for input tokens
4. **Arbiter**: External party responsible for processing claims (may accept/reject Tribunal's suggestions)
5. **Claimant**: Party designated by filler to receive input tokens from resource lock

### Deployment Information

**Contract Address**: `0x000000000000790009689f43bAedb61D67D45bB8`

**Deployed on**:
- Ethereum Mainnet
- Unichain
- Base
- Arbitrum One
- Optimism
- Sepolia (testnet)
- Unichain Sepolia (testnet)
- Base Sepolia (testnet)
- Arbitrum Sepolia (testnet)
- Optimism Sepolia (testnet)

---

## Key Differences from The Compact

### Conceptual Differences

| Aspect | The Compact | Tribunal |
|--------|-------------|----------|
| **Purpose** | Resource lock management & claims | Competitive auctions for claims |
| **Primary Action** | Deposits, claims, allocations | Fills (auction executions) |
| **Pricing** | Fixed claim amounts | Dynamic pricing (PGA + curves) |
| **Cross-chain** | Via arbiters & messaging | Via fills on target chains |

### Indexing Implications

1. **More Complex State**: Tribunal tracks auction dispositions (filled/cancelled status + scaling factors)
2. **Multiple Fill Types**: Different execution methods (fill, fillAndDispatch, claimAndFill, settleOrRegister)
3. **Pricing Mechanisms**: Three composable pricing layers (PGA, time curves, supplemental curves)
4. **Callbacks**: Three distinct callback types with different purposes
5. **Mandate-Claim Relationship**: Mandates define auction parameters, with multiple potential fills per mandate

---

## Events to Index

### Core Tribunal Events

Based on the Tribunal contract, the following events should be indexed:

#### 1. Fill Event
```solidity
event Fill(
    bytes32 indexed claimHash,
    bytes32 indexed mandateHash,
    bytes32 claimant,
    uint256 fillBlock,
    uint256[] fillAmounts,
    uint256[] claimAmounts
);
```

**Purpose**: Emitted when a filler successfully executes a fill (any fill type)

**Key Information**:
- `claimHash`: Identifies the specific claim being filled
- `mandateHash`: Identifies the mandate (auction parameters)
- `claimant`: Encoded claimant details (lock tag + recipient address)
- `fillBlock`: Block number used for pricing calculations
- `fillAmounts`: Actual amounts of output tokens transferred
- `claimAmounts`: Actual amounts of input tokens claimable

#### 2. Cancel Event
```solidity
event Cancel(
    bytes32 indexed claimHash,
    bytes32 indexed mandateHash
);
```

**Purpose**: Emitted when sponsor cancels an unfilled auction

**Key Information**:
- Marks claim as cancelled (prevents fills)
- Sponsor can cancel before fill occurs on target chain

#### 3. Dispatch Event (if using dispatch callbacks)
```solidity
event Dispatch(
    bytes32 indexed claimHash,
    uint256 indexed chainId,
    address target,
    bytes context
);
```

**Purpose**: Emitted when dispatch callback is triggered

**Key Information**:
- Cross-chain message relay information
- Target chain and callback contract
- Context data for message

### Derived/Computed Data to Track

While not events, the following state should be queryable:

1. **Fill Disposition**: Via `filled(bytes32 claimHash) → bytes32` view function
2. **Scaling Factors**: Via `claimReductionScalingFactor(bytes32 claimHash) → uint256` view function
3. **Batch Disposition Details**: Via `getDispositionDetails(bytes32[] claimHashes)` view function

---

## Database Schema

### Schema Design Principles

Following The Compact indexer patterns:
1. **Multi-chain support**: Every table includes `chainId`
2. **Composite keys**: Use compound primary keys for multi-chain entities
3. **Relationships**: Leverage Ponder's `relations()` for GraphQL nesting
4. **Timestamps**: Track `firstSeenAt` for new entities, `timestamp` for events
5. **Indexes**: Add indexes on foreign keys and frequently queried fields

### Complete Schema (`ponder.schema.ts`)

```typescript
import { onchainTable, index, primaryKey, relations } from "ponder";

// ============================================================================
// ACCOUNTS & SPONSORS
// ============================================================================

export const account = onchainTable("account", (t) => ({
  address: t.hex().primaryKey(),
  firstSeenAt: t.bigint().notNull(),
}));

export const accountRelations = relations(account, ({ many }) => ({
  sponsoredMandates: many(mandate),
  fills: many(fill),
  cancellations: many(cancellation),
}));

// ============================================================================
// ADJUSTERS
// ============================================================================

export const adjuster = onchainTable("adjuster", (t) => ({
  address: t.hex().primaryKey(),
  firstSeenAt: t.bigint().notNull(),
}));

export const adjusterRelations = relations(adjuster, ({ many }) => ({
  mandates: many(mandate),
}));

// ============================================================================
// ARBITERS
// ============================================================================

export const arbiter = onchainTable("arbiter", (t) => ({
  address: t.hex().primaryKey(),
  firstSeenAt: t.bigint().notNull(),
}));

export const arbiterRelations = relations(arbiter, ({ many }) => ({
  fills: many(fill),
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
    chainIdIdx: index().on(table.chainId),
  })
);

export const mandateRelations = relations(mandate, ({ one, many }) => ({
  sponsor: one(account, {
    fields: [mandate.sponsorAddress],
    references: [account.address],
  }),
  adjuster: one(adjuster, {
    fields: [mandate.adjusterAddress],
    references: [adjuster.address],
  }),
  fills: many(fill),
  cancellations: many(cancellation),
}));

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
    fillerAddress: t.hex().notNull(),
    claimant: t.hex().notNull(), // Encoded: bytes12(lockTag) + bytes20(recipient)
    fillBlock: t.bigint().notNull(),
    
    // Amounts (stored as JSON arrays of strings to handle BigInt)
    fillAmounts: t.text().notNull(), // JSON: ["amount1", "amount2", ...]
    claimAmounts: t.text().notNull(), // JSON: ["amount1", "amount2", ...]
    
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
    chainIdIdx: index().on(table.chainId),
    timestampIdx: index().on(table.timestamp),
    arbiterIdx: index().on(table.arbiterAddress),
  })
);

export const fillRelations = relations(fill, ({ one }) => ({
  filler: one(account, {
    fields: [fill.fillerAddress],
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

// ============================================================================
// CANCELLATIONS
// ============================================================================

export const cancellation = onchainTable(
  "cancellation",
  (t) => ({
    // Composite ID: claimHash-chainId
    id: t.text().primaryKey(),
    
    claimHash: t.hex().notNull(),
    mandateHash: t.hex().notNull(),
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
    context: t.hex().notNull(), // Raw bytes data
    
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
// TOKENS (Track tokens involved in fills)
// ============================================================================

export const token = onchainTable(
  "token",
  (t) => ({
    chainId: t.bigint().notNull(),
    tokenAddress: t.hex().notNull(),
    
    // Token metadata (optional - can be enriched)
    symbol: t.text(),
    name: t.text(),
    decimals: t.integer(),
    
    // Statistics
    totalFillVolume: t.text().notNull().default("0"), // BigInt as string
    fillCount: t.bigint().notNull().default(0n),
    
    firstSeenAt: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.chainId, table.tokenAddress] }),
    chainIdIdx: index().on(table.chainId),
  })
);

// ============================================================================
// FILL STATISTICS (Aggregated data)
// ============================================================================

export const chainStatistics = onchainTable(
  "chain_statistics",
  (t) => ({
    chainId: t.bigint().primaryKey(),
    
    totalFills: t.bigint().notNull().default(0n),
    totalCancellations: t.bigint().notNull().default(0n),
    uniqueFillers: t.bigint().notNull().default(0n),
    uniqueSponsors: t.bigint().notNull().default(0n),
    
    lastUpdated: t.bigint().notNull(),
  })
);
```

---

## Ponder Configuration

### Configuration File (`ponder.config.ts`)

```typescript
import { createConfig } from "ponder";
import { http } from "viem";
import { TribunalAbi } from "./abis/TribunalAbi";

// Tribunal contract address (same across all chains)
const TRIBUNAL_ADDRESS = "0x000000000000790009689f43bAedb61D67D45bB8";

// Deployment blocks for each chain (update with actual values)
const DEPLOYMENT_BLOCKS = {
  // Mainnets
  1: 20000000, // Ethereum Mainnet
  8453: 15000000, // Base
  42161: 200000000, // Arbitrum One
  10: 120000000, // Optimism
  130: 1000000, // Unichain
  
  // Testnets
  11155111: 5000000, // Sepolia
  84532: 10000000, // Base Sepolia
  421614: 40000000, // Arbitrum Sepolia
  11155420: 15000000, // Optimism Sepolia
  1301: 500000, // Unichain Sepolia
};

export default createConfig({
  networks: {
    // Mainnets
    mainnet: {
      chainId: 1,
      transport: http(process.env.PONDER_RPC_URL_1),
    },
    base: {
      chainId: 8453,
      transport: http(process.env.PONDER_RPC_URL_8453),
    },
    arbitrum: {
      chainId: 42161,
      transport: http(process.env.PONDER_RPC_URL_42161),
    },
    optimism: {
      chainId: 10,
      transport: http(process.env.PONDER_RPC_URL_10),
    },
    unichain: {
      chainId: 130,
      transport: http(process.env.PONDER_RPC_URL_130),
    },
    
    // Testnets
    sepolia: {
      chainId: 11155111,
      transport: http(process.env.PONDER_RPC_URL_11155111),
    },
    baseSepolia: {
      chainId: 84532,
      transport: http(process.env.PONDER_RPC_URL_84532),
    },
    arbitrumSepolia: {
      chainId: 421614,
      transport: http(process.env.PONDER_RPC_URL_421614),
    },
    optimismSepolia: {
      chainId: 11155420,
      transport: http(process.env.PONDER_RPC_URL_11155420),
    },
    unichainSepolia: {
      chainId: 1301,
      transport: http(process.env.PONDER_RPC_URL_1301),
    },
  },
  
  contracts: {
    Tribunal: {
      abi: TribunalAbi,
      address: TRIBUNAL_ADDRESS,
      network: {
        mainnet: { startBlock: DEPLOYMENT_BLOCKS[1] },
        base: { startBlock: DEPLOYMENT_BLOCKS[8453] },
        arbitrum: { startBlock: DEPLOYMENT_BLOCKS[42161] },
        optimism: { startBlock: DEPLOYMENT_BLOCKS[10] },
        unichain: { startBlock: DEPLOYMENT_BLOCKS[130] },
        sepolia: { startBlock: DEPLOYMENT_BLOCKS[11155111] },
        baseSepolia: { startBlock: DEPLOYMENT_BLOCKS[84532] },
        arbitrumSepolia: { startBlock: DEPLOYMENT_BLOCKS[421614] },
        optimismSepolia: { startBlock: DEPLOYMENT_BLOCKS[11155420] },
        unichainSepolia: { startBlock: DEPLOYMENT_BLOCKS[1301] },
      },
    },
  },
});
```

### Environment Variables (`.env.local`)

```bash
# Mainnet RPCs
PONDER_RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
PONDER_RPC_URL_8453=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
PONDER_RPC_URL_42161=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
PONDER_RPC_URL_10=https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY
PONDER_RPC_URL_130=https://unichain-rpc-url

# Testnet RPCs
PONDER_RPC_URL_11155111=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
PONDER_RPC_URL_84532=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
PONDER_RPC_URL_421614=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
PONDER_RPC_URL_11155420=https://opt-sepolia.g.alchemy.com/v2/YOUR_KEY
PONDER_RPC_URL_1301=https://unichain-sepolia-rpc-url

# Optional: Database
DATABASE_URL=postgresql://user:password@localhost:5432/tribunal_indexer
```

---

## Event Handlers

### Event Handler File (`src/Tribunal.ts`)

```typescript
import { ponder } from "ponder:registry";
import schema from "ponder:schema";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Ensures an account exists in the database
 */
async function ensureAccount(
  db: any,
  address: string,
  timestamp: bigint
) {
  await db
    .insert(schema.account)
    .values({
      address,
      firstSeenAt: timestamp,
    })
    .onConflictDoNothing();
}

/**
 * Ensures an adjuster exists in the database
 */
async function ensureAdjuster(
  db: any,
  address: string,
  timestamp: bigint
) {
  await db
    .insert(schema.adjuster)
    .values({
      address,
      firstSeenAt: timestamp,
    })
    .onConflictDoNothing();
}

/**
 * Ensures an arbiter exists in the database
 */
async function ensureArbiter(
  db: any,
  address: string,
  timestamp: bigint
) {
  await db
    .insert(schema.arbiter)
    .values({
      address,
      firstSeenAt: timestamp,
    })
    .onConflictDoNothing();
}

/**
 * Extracts claimant lock tag and recipient from encoded claimant bytes32
 * Format: bytes12(lockTag) + bytes20(recipient)
 */
function decodeClaimant(claimant: string): {
  lockTag: string;
  recipient: string;
} {
  // claimant is bytes32 (66 chars with 0x prefix)
  // bytes12 = 24 hex chars (12 bytes)
  // bytes20 = 40 hex chars (20 bytes)
  
  const lockTag = "0x" + claimant.slice(2, 26); // First 12 bytes
  const recipient = "0x" + claimant.slice(26, 66); // Last 20 bytes
  
  return { lockTag, recipient };
}

/**
 * Updates chain statistics
 */
async function updateChainStatistics(
  db: any,
  chainId: bigint,
  timestamp: bigint,
  updates: {
    totalFills?: bigint;
    totalCancellations?: bigint;
    uniqueFillers?: bigint;
    uniqueSponsors?: bigint;
  }
) {
  const existing = await db
    .select()
    .from(schema.chainStatistics)
    .where({ chainId })
    .limit(1);
  
  if (existing.length === 0) {
    await db.insert(schema.chainStatistics).values({
      chainId,
      totalFills: updates.totalFills || 0n,
      totalCancellations: updates.totalCancellations || 0n,
      uniqueFillers: updates.uniqueFillers || 0n,
      uniqueSponsors: updates.uniqueSponsors || 0n,
      lastUpdated: timestamp,
    });
  } else {
    const current = existing[0];
    await db
      .update(schema.chainStatistics)
      .set({
        totalFills: updates.totalFills !== undefined 
          ? current.totalFills + updates.totalFills 
          : current.totalFills,
        totalCancellations: updates.totalCancellations !== undefined
          ? current.totalCancellations + updates.totalCancellations
          : current.totalCancellations,
        uniqueFillers: updates.uniqueFillers || current.uniqueFillers,
        uniqueSponsors: updates.uniqueSponsors || current.uniqueSponsors,
        lastUpdated: timestamp,
      })
      .where({ chainId });
  }
}

// ============================================================================
// FILL EVENT HANDLER
// ============================================================================

ponder.on("Tribunal:Fill", async ({ event, context }) => {
  const { db } = context;
  const { claimHash, mandateHash, claimant, fillBlock, fillAmounts, claimAmounts } = event.args;
  
  const chainId = BigInt(context.network.chainId);
  const timestamp = event.block.timestamp;
  const fillerAddress = event.transaction.from;
  
  // Decode claimant to extract lock tag and recipient
  const { lockTag, recipient } = decodeClaimant(claimant);
  
  // Ensure filler account exists
  await ensureAccount(db, fillerAddress, timestamp);
  
  // Note: We need to get sponsor, adjuster, and arbiter addresses
  // This requires either:
  // 1. Parsing transaction input data to get the compact
  // 2. Making a contract call to get mandate details
  // 3. Tracking mandate registration in a separate event
  
  // For now, we'll use placeholder logic - in production you'd need
  // to decode the transaction input or call the contract
  
  // TODO: Extract sponsor, adjuster, arbiter from transaction input
  // For demonstration, using placeholder addresses
  const sponsorAddress = "0x0000000000000000000000000000000000000000";
  const adjusterAddress = "0x0000000000000000000000000000000000000000";
  const arbiterAddress = "0x0000000000000000000000000000000000000000";
  
  await ensureAccount(db, sponsorAddress, timestamp);
  await ensureAdjuster(db, adjusterAddress, timestamp);
  await ensureArbiter(db, arbiterAddress, timestamp);
  
  // Ensure mandate exists (or create it)
  await db
    .insert(schema.mandate)
    .values({
      mandateHash,
      chainId,
      sponsorAddress,
      adjusterAddress,
      firstSeenAt: timestamp,
      blockNumber: event.block.number,
      transactionHash: event.transaction.hash,
      totalFills: 0n,
      totalCancellations: 0n,
    })
    .onConflictDoUpdate({
      totalFills: (current: any) => current.totalFills + 1n,
    });
  
  // Insert fill record
  const fillId = `${claimHash}-${chainId}`;
  await db.insert(schema.fill).values({
    id: fillId,
    claimHash,
    mandateHash,
    chainId,
    fillerAddress,
    claimant,
    fillBlock,
    fillAmounts: JSON.stringify(fillAmounts.map(String)),
    claimAmounts: JSON.stringify(claimAmounts.map(String)),
    claimantLockTag: lockTag,
    claimantRecipient: recipient,
    blockNumber: event.block.number,
    timestamp,
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    arbiterAddress,
  });
  
  // Update chain statistics
  await updateChainStatistics(db, chainId, timestamp, { totalFills: 1n });
});

// ============================================================================
// CANCEL EVENT HANDLER
// ============================================================================

ponder.on("Tribunal:Cancel", async ({ event, context }) => {
  const { db } = context;
  const { claimHash, mandateHash } = event.args;
  
  const chainId = BigInt(context.network.chainId);
  const timestamp = event.block.timestamp;
  const sponsorAddress = event.transaction.from;
  
  // Ensure sponsor account exists
  await ensureAccount(db, sponsorAddress, timestamp);
  
  // Update mandate cancellation count
  await db
    .update(schema.mandate)
    .set({
      totalCancellations: (current: any) => current.totalCancellations + 1n,
    })
    .where({ mandateHash, chainId });
  
  // Insert cancellation record
  const cancellationId = `${claimHash}-${chainId}`;
  await db.insert(schema.cancellation).values({
    id: cancellationId,
    claimHash,
    mandateHash,
    chainId,
    sponsorAddress,
    blockNumber: event.block.number,
    timestamp,
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
  });
  
  // Update chain statistics
  await updateChainStatistics(db, chainId, timestamp, { totalCancellations: 1n });
});

// ============================================================================
// DISPATCH EVENT HANDLER (Optional)
// ============================================================================

ponder.on("Tribunal:Dispatch", async ({ event, context }) => {
  const { db } = context;
  const { claimHash, chainId: targetChainId, target, context: dispatchContext } = event.args;
  
  const chainId = BigInt(context.network.chainId);
  const timestamp = event.block.timestamp;
  
  // Insert dispatch record
  const dispatchId = `${claimHash}-${chainId}-${event.log.logIndex}`;
  await db.insert(schema.dispatch).values({
    id: dispatchId,
    claimHash,
    chainId,
    targetChainId: BigInt(targetChainId),
    targetAddress: target,
    context: dispatchContext,
    blockNumber: event.block.number,
    timestamp,
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
  });
});
```

### Important Implementation Notes

1. **Transaction Input Parsing**: The Fill event doesn't include sponsor/adjuster addresses. You'll need to either:
   - Parse transaction input data to extract the `BatchCompact` and `FillParameters`
   - Make contract calls to retrieve mandate details
   - Track mandate registrations separately (if Tribunal emits such events)

2. **ABI Extraction**: You'll need to extract the Tribunal ABI from the deployed contract. Use:
   ```bash
   cast interface 0x000000000000790009689f43bAedb61D67D45bB8 --chain <chain>
   ```

3. **Token Enrichment**: Consider adding a separate service to enrich token metadata (symbol, name, decimals) via ERC20 calls.

---

## GraphQL API Queries

### Example Queries

Once the indexer is running, these GraphQL queries will be available:

#### 1. Get All Fills for a Specific Chain

```graphql
query GetFillsByChain($chainId: BigInt!) {
  fills(
    where: { chainId: { equals: $chainId } }
    orderBy: "timestamp"
    orderDirection: "DESC"
    limit: 50
  ) {
    items {
      claimHash
      mandateHash
      fillerAddress
      claimant
      claimantRecipient
      fillBlock
      fillAmounts
      claimAmounts
      timestamp
      transactionHash
      mandate {
        sponsorAddress
        adjusterAddress
      }
      filler {
        address
      }
    }
  }
}
```

#### 2. Get Fill History for a Specific Filler

```graphql
query GetFillerHistory($fillerAddress: String!) {
  account(address: $fillerAddress) {
    address
    fills(orderBy: "timestamp", orderDirection: "DESC") {
      items {
        claimHash
        mandateHash
        chainId
        fillAmounts
        claimAmounts
        timestamp
        transactionHash
        mandate {
          sponsorAddress
          adjusterAddress
        }
      }
    }
  }
}
```

#### 3. Get Mandate Details with All Fills

```graphql
query GetMandateDetails($mandateHash: String!, $chainId: BigInt!) {
  mandate(mandateHash: $mandateHash, chainId: $chainId) {
    mandateHash
    chainId
    sponsorAddress
    adjusterAddress
    totalFills
    totalCancellations
    firstSeenAt
    fills(orderBy: "timestamp", orderDirection: "DESC") {
      items {
        claimHash
        fillerAddress
        fillAmounts
        claimAmounts
        timestamp
        transactionHash
      }
    }
    cancellations(orderBy: "timestamp", orderDirection: "DESC") {
      items {
        claimHash
        timestamp
        transactionHash
      }
    }
  }
}
```

#### 4. Get Chain Statistics

```graphql
query GetChainStats {
  chainStatistics(orderBy: "totalFills", orderDirection: "DESC") {
    items {
      chainId
      totalFills
      totalCancellations
      uniqueFillers
      uniqueSponsors
      lastUpdated
    }
  }
}
```

#### 5. Get Recent Fills Across All Chains

```graphql
query GetRecentFills {
  fills(
    orderBy: "timestamp"
    orderDirection: "DESC"
    limit: 100
  ) {
    items {
      claimHash
      mandateHash
      chainId
      fillerAddress
      claimantRecipient
      fillAmounts
      claimAmounts
      timestamp
      blockNumber
      transactionHash
      mandate {
        sponsorAddress
        adjusterAddress
      }
    }
  }
}
```

#### 6. Get Cancellations for a Sponsor

```graphql
query GetSponsorCancellations($sponsorAddress: String!) {
  account(address: $sponsorAddress) {
    address
    cancellations(orderBy: "timestamp", orderDirection: "DESC") {
      items {
        claimHash
        mandateHash
        chainId
        timestamp
        transactionHash
        mandate {
          adjusterAddress
          totalFills
        }
      }
    }
  }
}
```

#### 7. Search Fills by Claim Hash

```graphql
query GetFillByClaimHash($claimHash: String!) {
  fills(where: { claimHash: { equals: $claimHash } }) {
    items {
      id
      claimHash
      mandateHash
      chainId
      fillerAddress
      claimant
      claimantRecipient
      fillAmounts
      claimAmounts
      timestamp
      transactionHash
      mandate {
        sponsorAddress
        adjusterAddress
      }
    }
  }
}
```

---

## Implementation Checklist

### Phase 1: Project Setup

- [ ] Initialize new Ponder project: `npm create ponder@latest`
- [ ] Install dependencies: `pnpm install`
- [ ] Set up Git repository
- [ ] Create `.env.local` with RPC URLs for all chains
- [ ] Extract Tribunal ABI from deployed contract
- [ ] Create `abis/TribunalAbi.ts` with ABI export

### Phase 2: Schema Definition

- [ ] Implement complete schema in `ponder.schema.ts`
- [ ] Add all entity tables (account, adjuster, arbiter, mandate, fill, cancellation, etc.)
- [ ] Define relationships using `relations()`
- [ ] Add appropriate indexes for query performance
- [ ] Verify schema with `pnpm ponder codegen`

### Phase 3: Configuration

- [ ] Complete `ponder.config.ts` with all networks
- [ ] Add Tribunal contract configuration for each chain
- [ ] Verify deployment block numbers for each chain
- [ ] Test RPC connectivity for all chains

### Phase 4: Event Handlers

- [ ] Implement Fill event handler
  - [ ] Account/adjuster/arbiter creation
  - [ ] Mandate upsert logic
  - [ ] Fill record insertion
  - [ ] Claimant decoding
  - [ ] Statistics updates
- [ ] Implement Cancel event handler
  - [ ] Cancellation record insertion
  - [ ] Mandate statistics update
  - [ ] Chain statistics update
- [ ] Implement Dispatch event handler (optional)
  - [ ] Dispatch record insertion
- [ ] Add transaction input parsing logic
  - [ ] Extract sponsor address from BatchCompact
  - [ ] Extract adjuster address from Adjustment
  - [ ] Extract arbiter address from BatchCompact

### Phase 5: Testing & Validation

- [ ] Test indexer on testnets first
  - [ ] Sepolia
  - [ ] Base Sepolia
  - [ ] Other testnets
- [ ] Verify event handling for each event type
- [ ] Test GraphQL queries
- [ ] Verify relationships work correctly
- [ ] Check for missing data or errors
- [ ] Load test with historical data

### Phase 6: Production Deployment

- [ ] Set up production database (PostgreSQL recommended)
- [ ] Configure production RPC endpoints
- [ ] Deploy to hosting service (Railway, Render, etc.)
- [ ] Set up monitoring and alerting
- [ ] Document API endpoints
- [ ] Create example queries documentation

### Phase 7: Enhancements (Optional)

- [ ] Add token metadata enrichment
- [ ] Implement derived metrics (TVL, volume, etc.)
- [ ] Add historical snapshots
- [ ] Create aggregated statistics tables
- [ ] Build admin dashboard
- [ ] Add webhook notifications for fills

---

## Testing Strategy

### Unit Testing

Test individual components:

```typescript
// tests/handlers.test.ts
import { expect, test } from "vitest";
import { decodeClaimant } from "../src/Tribunal";

test("decodeClaimant splits bytes32 correctly", () => {
  const claimant = "0x000000000000000000000001000000000000000000000000000000000000000a";
  const result = decodeClaimant(claimant);
  
  expect(result.lockTag).toBe("0x000000000000000000000001");
  expect(result.recipient).toBe("0x000000000000000000000000000000000000000a");
});
```

### Integration Testing

Test with actual chain data:

1. **Testnet Validation**: Run indexer on Sepolia/Base Sepolia and verify:
   - Events are captured correctly
   - Database records are created
   - Relationships work
   - GraphQL queries return expected data

2. **Historical Sync**: Test syncing from deployment block to current:
   - Monitor sync speed
   - Check for missed events
   - Verify data consistency

### Query Testing

Test all GraphQL queries:

```bash
# Start dev server
pnpm dev

# Test queries via GraphQL playground
# http://localhost:42069
```

---

## Advanced Features to Consider

### 1. Transaction Input Parsing

Parse transaction calldata to extract full mandate and adjustment details:

```typescript
import { decodeFunctionData } from "viem";

function parseFilltransaction(txInput: string, abi: any) {
  const decoded = decodeFunctionData({
    abi,
    data: txInput,
  });
  
  // Extract BatchCompact, FillParameters, Adjustment
  // Return sponsor, adjuster, arbiter addresses
}
```

### 2. Real-time Pricing Data

Calculate actual fill prices based on pricing curves:

```typescript
interface PricingData {
  baselinePriorityFee: bigint;
  scalingFactor: bigint;
  priceCurve: bigint[];
  supplementalCurve: bigint[];
  targetBlock: bigint;
  fillBlock: bigint;
}

function calculateFillPrice(pricing: PricingData): bigint {
  // Implement pricing calculation logic
  // Based on Tribunal's deriveAmounts function
}
```

### 3. Cross-chain Fill Tracking

Track related fills across chains:

```typescript
// Link fills on claim chain to fills on fill chain
interface CrossChainFill {
  claimChainId: bigint;
  fillChainId: bigint;
  claimHash: string;
  claimFill?: Fill;
  fillChainFills: Fill[];
}
```

### 4. Arbiter Performance Metrics

Track arbiter claim processing:

```typescript
interface ArbiterMetrics {
  arbiterAddress: string;
  totalClaims: bigint;
  averageProcessingTime: bigint;
  successRate: number;
}
```

---

## Deployment Guide

### Local Development

```bash
# Install dependencies
pnpm install

# Generate types from schema
pnpm ponder codegen

# Start development server
pnpm dev

# GraphQL playground: http://localhost:42069
```

### Production Deployment

**Option 1: Railway**

1. Connect GitHub repository
2. Add environment variables (RPC URLs)
3. Deploy with build command: `pnpm ponder start`

**Option 2: Docker**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm ponder codegen
CMD ["pnpm", "ponder", "start"]
```

**Option 3: Custom Server**

```bash
# Build
pnpm install
pnpm ponder codegen

# Run with PM2
pm2 start "pnpm ponder start" --name tribunal-indexer

# Monitor
pm2 logs tribunal-indexer
```

---

## Resources & References

### Documentation

- **Ponder Documentation**: https://ponder.sh/docs
- **The Compact Indexer**: https://github.com/Uniswap/the-compact-indexer
- **Tribunal Protocol**: https://github.com/Uniswap/Tribunal
- **The Compact Protocol**: https://github.com/Uniswap/the-compact

### Tribunal Contract Details

- **Address**: `0x000000000000790009689f43bAedb61D67D45bB8` (all chains)
- **Source Code**: Available on Etherscan/block explorers
- **License**: MIT

### Community

- **Ponder Telegram**: https://t.me/ponder_sh
- **Uniswap Discord**: https://discord.gg/uniswap
- **GitHub Issues**: https://github.com/Uniswap/Tribunal/issues

---

## Conclusion

This document provides a complete blueprint for building a production-ready Tribunal indexer using Ponder.sh. The architecture closely follows proven patterns from The Compact indexer while adapting to Tribunal's unique requirements around competitive auctions, dynamic pricing, and cross-chain fills.

Key implementation priorities:

1. ✅ **Start with testnets** - Validate event handling before mainnet
2. ✅ **Parse transaction inputs** - Extract sponsor/adjuster/arbiter details
3. ✅ **Test GraphQL queries** - Ensure relationships work correctly
4. ✅ **Monitor performance** - Track sync speed and query latency
5. ✅ **Document edge cases** - Handle cancellations, failures, chain reorgs

The indexer will provide essential infrastructure for:
- Filler discovery and monitoring
- Auction analytics and metrics
- Cross-chain fill tracking
- Sponsor/adjuster activity monitoring
- Protocol health monitoring

Good luck with the implementation! 🚀
