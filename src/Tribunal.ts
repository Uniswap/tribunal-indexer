import { ponder } from "ponder:registry";
import schema from "ponder:schema";
import type { Address, Hex } from "viem";
import { decodeFunctionData, keccak256, encodeAbiParameters } from "viem";
import { TribunalAbi } from "../abis/TribunalAbi";
import { and, eq, lt } from "ponder";

// 24 hours in seconds
const RETENTION_SECONDS = 24n * 60n * 60n;

// Number of old blocks to cleanup per block event (to spread the load)
const CLEANUP_BATCH_SIZE = 50;

// ============================================================================
// BLOCK TRACKER - Track indexed blocks for cross-indexer consistency checks
// ============================================================================

ponder.on("BlockTracker:block", async ({ event, context }) => {
  const chainId = BigInt(context.network.chainId);
  const { number: blockNumber, hash: blockHash, timestamp: blockTimestamp } = event.block;

  // Insert the block record (skip if already exists)
  await context.db
    .insert(schema.indexedBlock)
    .values({
      chainId,
      blockNumber,
      blockHash,
      blockTimestamp,
      indexedAt: blockTimestamp,
    })
    .onConflictDoNothing();

  // Cleanup old blocks (older than 24 hours from current block timestamp)
  const cutoffTimestamp = blockTimestamp - RETENTION_SECONDS;
  
  // Query for old blocks to delete
  const oldBlocks = await context.db.sql
    .select({ blockNumber: schema.indexedBlock.blockNumber })
    .from(schema.indexedBlock)
    .where(
      and(
        eq(schema.indexedBlock.chainId, chainId),
        lt(schema.indexedBlock.blockTimestamp, cutoffTimestamp)
      )
    )
    .limit(CLEANUP_BATCH_SIZE);

  // Delete old blocks
  for (const oldBlock of oldBlocks) {
    await context.db.delete(schema.indexedBlock, {
      blockNumber: oldBlock.blockNumber,
      chainId,
    });
  }
});

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface TransactionDetails {
  sponsorAddress: Address;
  adjusterAddress: Address;
  arbiterAddress: Address;
  mandateHash: Hex;
  originalMinimumFillAmounts?: bigint[];
  originalMaximumClaimAmounts?: bigint[];
}

interface FillComponent {
  fillToken: Address;
  minimumFillAmount: bigint;
  recipient: Address;
  applyScaling: boolean;
}

interface RecipientCallback {
  chainId: bigint;
  compact: BatchCompact;
  mandateHash: Hex;
  context: Hex;
}

interface FillParameters {
  chainId: bigint;
  tribunal: Address;
  expires: bigint;
  components: FillComponent[];
  baselinePriorityFee: bigint;
  scalingFactor: bigint;
  priceCurve: bigint[];
  recipientCallback: RecipientCallback[];
  salt: Hex;
}

interface Lock {
  lockTag: Hex;
  token: Address;
  amount: bigint;
}

interface BatchCompact {
  arbiter: Address;
  sponsor: Address;
  nonce: bigint;
  expires: bigint;
  commitments: Lock[];
}

interface Mandate {
  adjuster: Address;
  fills: FillParameters[];
}

// ============================================================================
// HASH COMPUTATION FUNCTIONS
// ============================================================================

/**
 * Computes the hash of a FillComponent
 * Matches Tribunal's deriveFillComponentHash function
 */
function computeFillComponentHash(component: FillComponent): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "uint256" },
        { type: "address" },
        { type: "bool" },
      ],
      [
        component.fillToken,
        component.minimumFillAmount,
        component.recipient,
        component.applyScaling,
      ]
    )
  );
}

/**
 * Computes the hash of FillComponents array
 * Matches Tribunal's deriveFillComponentsHash function
 */
function computeFillComponentsHash(components: FillComponent[]): Hex {
  const componentHashes = components.map(computeFillComponentHash);
  return keccak256(
    encodeAbiParameters([{ type: "bytes32[]" }], [componentHashes])
  );
}

/**
 * Computes the hash of a Lock
 */
function computeLockHash(lock: Lock): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes12" }, { type: "address" }, { type: "uint256" }],
      [lock.lockTag, lock.token, lock.amount]
    )
  );
}

/**
 * Computes the hash of a BatchCompact
 */
function computeBatchCompactHash(compact: BatchCompact): Hex {
  const lockHashes = compact.commitments.map(computeLockHash);
  const locksHash = keccak256(
    encodeAbiParameters([{ type: "bytes32[]" }], [lockHashes])
  );

  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "bytes32" },
      ],
      [compact.arbiter, compact.sponsor, compact.nonce, compact.expires, locksHash]
    )
  );
}

/**
 * Computes the hash of RecipientCallback array
 * Matches Tribunal's deriveRecipientCallbackHash function
 */
function computeRecipientCallbackHash(
  recipientCallbacks: RecipientCallback[]
): Hex {
  if (recipientCallbacks.length === 0) {
    return "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;
  }

  const callbackHashes = recipientCallbacks.map((callback) => {
    const compactHash = computeBatchCompactHash(callback.compact);
    return keccak256(
      encodeAbiParameters(
        [
          { type: "uint256" },
          { type: "bytes32" },
          { type: "bytes32" },
          { type: "bytes32" },
        ],
        [
          callback.chainId,
          compactHash,
          callback.mandateHash,
          keccak256(callback.context),
        ]
      )
    );
  });

  return keccak256(
    encodeAbiParameters([{ type: "bytes32[]" }], [callbackHashes])
  );
}

/**
 * Computes the hash of a FillParameters
 * Matches Tribunal's deriveFillHash function
 */
function computeFillHash(fill: FillParameters): Hex {
  const componentsHash = computeFillComponentsHash(fill.components);
  const priceCurveHash = keccak256(
    encodeAbiParameters([{ type: "uint256[]" }], [fill.priceCurve])
  );
  const recipientCallbackHash = computeRecipientCallbackHash(
    fill.recipientCallback
  );

  return keccak256(
    encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "address" },
        { type: "uint256" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
      ],
      [
        fill.chainId,
        fill.tribunal,
        fill.expires,
        componentsHash,
        fill.baselinePriorityFee,
        fill.scalingFactor,
        priceCurveHash,
        recipientCallbackHash,
        fill.salt,
      ]
    )
  );
}

/**
 * Computes the hash of a Mandate
 * Matches Tribunal's deriveMandateHash function
 */
function computeMandateHash(mandate: Mandate): Hex {
  const fillHashes = mandate.fills.map(computeFillHash);
  const fillsHash = keccak256(
    encodeAbiParameters([{ type: "bytes32[]" }], [fillHashes])
  );

  return keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "bytes32" }],
      [mandate.adjuster, fillsHash]
    )
  );
}

// ============================================================================
// TRANSACTION PARSING FUNCTIONS
// ============================================================================

/**
 * Parses transaction input to extract mandate details
 * Handles fill, fillAndDispatch, claimAndFill, cancel, and cancelAndDispatch functions
 */
function parseTransactionInput(txInput: Hex): TransactionDetails | null {
  try {
    const decoded = decodeFunctionData({
      abi: TribunalAbi,
      data: txInput,
    });

    const functionName = decoded.functionName;

    if (functionName === "fill" || functionName === "fillAndDispatch") {
      const compact = decoded.args[0] as BatchCompact;
      const mandate = decoded.args[1] as FillParameters;
      const adjustment = decoded.args[2] as any;

      const mandateStruct: Mandate = {
        adjuster: adjustment.adjuster,
        fills: [mandate],
      };

      const mandateHash = computeMandateHash(mandateStruct);

      // Extract original minimum fill amounts from mandate components
      const originalMinimumFillAmounts = mandate.components.map(
        (c) => c.minimumFillAmount
      );

      // Extract original maximum claim amounts from compact commitments
      const originalMaximumClaimAmounts = compact.commitments.map(
        (l) => l.amount
      );

      return {
        sponsorAddress: compact.sponsor,
        adjusterAddress: adjustment.adjuster,
        arbiterAddress: compact.arbiter,
        mandateHash,
        originalMinimumFillAmounts,
        originalMaximumClaimAmounts,
      };
    } else if (functionName === "claimAndFill") {
      const claim = decoded.args[0] as any;
      const compact = claim.compact as BatchCompact;
      const mandate = decoded.args[1] as FillParameters;
      const adjustment = decoded.args[2] as any;

      const mandateStruct: Mandate = {
        adjuster: adjustment.adjuster,
        fills: [mandate],
      };

      const mandateHash = computeMandateHash(mandateStruct);

      // Extract original minimum fill amounts from mandate components
      const originalMinimumFillAmounts = mandate.components.map(
        (c) => c.minimumFillAmount
      );

      // Extract original maximum claim amounts from compact commitments
      const originalMaximumClaimAmounts = compact.commitments.map(
        (l) => l.amount
      );

      return {
        sponsorAddress: compact.sponsor,
        adjusterAddress: adjustment.adjuster,
        arbiterAddress: compact.arbiter,
        mandateHash,
        originalMinimumFillAmounts,
        originalMaximumClaimAmounts,
      };
    } else if (
      functionName === "cancel" ||
      functionName === "cancelAndDispatch"
    ) {
      const compact = decoded.args[0] as BatchCompact;
      const mandateHash = decoded.args[1] as Hex;

      return {
        sponsorAddress: compact.sponsor,
        adjusterAddress: "0x0000000000000000000000000000000000000000" as Address,
        arbiterAddress: compact.arbiter,
        mandateHash,
      };
    }

    return null;
  } catch (error) {
    console.error("Failed to parse transaction input:", error);
    return null;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Ensures an account exists in the database
 */
async function ensureAccount(db: any, address: Address, timestamp: bigint) {
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
async function ensureAdjuster(db: any, address: Address, timestamp: bigint) {
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
async function ensureArbiter(db: any, address: Address, timestamp: bigint) {
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
 * Calculates price improvement percentage
 * For fills: positive values indicate filler received more than minimum
 * For claims: positive values indicate claimant paid less than maximum (better deal)
 * @param original - Original amount (minimum for fills, maximum for claims)
 * @param realized - Realized amount (actual fill or claim amount)
 * @param isClaim - Whether this is a claim amount (inverts the calculation)
 * @returns Price improvement as a string percentage (e.g., "10.5" for 10.5%)
 */
function calculatePriceImprovement(
  original: bigint,
  realized: bigint,
  isClaim: boolean = false
): string {
  // Avoid division by zero
  if (original === 0n) {
    return "0";
  }

  // Calculate percentage difference
  // For fills: ((realized - minimum) / minimum) * 100
  // For claims: ((maximum - realized) / maximum) * 100
  let improvement: bigint;
  
  if (isClaim) {
    // For claims, improvement is when realized is less than maximum
    improvement = ((original - realized) * 10000n) / original;
  } else {
    // For fills, improvement is when realized is more than minimum
    improvement = ((realized - original) * 10000n) / original;
  }

  // Convert to decimal string with 2 decimal places
  const isNegative = improvement < 0n;
  const absImprovement = isNegative ? -improvement : improvement;
  const wholePart = absImprovement / 100n;
  const decimalPart = absImprovement % 100n;
  
  const result = `${wholePart}.${decimalPart.toString().padStart(2, "0")}`;
  return isNegative ? `-${result}` : result;
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
    .find(schema.chainStatistics, { chainId })
    .catch(() => null);

  if (!existing) {
    await db.insert(schema.chainStatistics).values({
      chainId,
      totalFills: updates.totalFills || 0n,
      totalCancellations: updates.totalCancellations || 0n,
      uniqueFillers: updates.uniqueFillers || 0n,
      uniqueSponsors: updates.uniqueSponsors || 0n,
      lastUpdated: timestamp,
    });
  } else {
    await db
      .update(schema.chainStatistics, { chainId })
      .set({
        totalFills:
          updates.totalFills !== undefined
            ? existing.totalFills + updates.totalFills
            : existing.totalFills,
        totalCancellations:
          updates.totalCancellations !== undefined
            ? existing.totalCancellations + updates.totalCancellations
            : existing.totalCancellations,
        uniqueFillers: updates.uniqueFillers || existing.uniqueFillers,
        uniqueSponsors: updates.uniqueSponsors || existing.uniqueSponsors,
        lastUpdated: timestamp,
      });
  }
}

// ============================================================================
// FILL EVENT HANDLER
// ============================================================================

ponder.on("Tribunal:Fill", async ({ event, context }) => {
  const { db } = context;
  const { sponsor, claimant, claimHash, fillRecipients, claimAmounts, targetBlock } =
    event.args;

  const chainId = BigInt(context.network.chainId);
  const timestamp = event.block.timestamp;
  const fillerAddress = event.transaction.from;

  // Decode claimant to extract lock tag and recipient
  const { lockTag, recipient } = decodeClaimant(claimant);

  // Ensure filler account exists
  await ensureAccount(db, fillerAddress, timestamp);
  await ensureAccount(db, sponsor, timestamp);

  // Parse transaction input to get full mandate details
  const parsed = parseTransactionInput(event.transaction.input);

  if (!parsed) {
    console.error(
      `Failed to parse transaction input for Fill event: ${event.transaction.hash}`
    );
    return;
  }

  const { adjusterAddress, arbiterAddress, mandateHash } = parsed;

  await ensureAdjuster(db, adjusterAddress, timestamp);
  await ensureArbiter(db, arbiterAddress, timestamp);

  // Ensure mandate exists (or create it)
  await db
    .insert(schema.mandate)
    .values({
      mandateHash,
      chainId,
      sponsorAddress: sponsor,
      adjusterAddress,
      arbiterAddress,
      firstSeenAt: timestamp,
      blockNumber: event.block.number,
      transactionHash: event.transaction.hash,
      totalFills: 0n,
      totalCancellations: 0n,
    })
    .onConflictDoUpdate((row: any) => ({
      totalFills: row.totalFills + 1n,
    }));

  // Convert fillRecipients to JSON
  const fillRecipientsJson = JSON.stringify(
    fillRecipients.map((r: any) => ({
      fillAmount: r.fillAmount.toString(),
      recipient: r.recipient,
    }))
  );

  // Extract fillAmounts from fillRecipients
  const fillAmounts = fillRecipients.map((r: any) => r.fillAmount);

  // Get original amounts from parsed transaction
  const originalMinimumFillAmounts =
    parsed.originalMinimumFillAmounts || [];
  const originalMaximumClaimAmounts =
    parsed.originalMaximumClaimAmounts || [];

  // Calculate price improvements
  const fillPriceImprovements = fillAmounts.map((realized: bigint, i: number) => {
    const original = originalMinimumFillAmounts[i];
    return original ? calculatePriceImprovement(original, realized, false) : "0";
  });

  const claimPriceImprovements = claimAmounts.map(
    (realized: bigint, i: number) => {
      const original = originalMaximumClaimAmounts[i];
      return original ? calculatePriceImprovement(original, realized, true) : "0";
    }
  );

  // Insert fill record
  const fillId = `${claimHash}-${chainId}`;
  await db.insert(schema.fill).values({
    id: fillId,
    claimHash,
    mandateHash,
    chainId,
    sponsorAddress: sponsor,
    fillerAddress,
    claimant,
    targetBlock,
    originalMinimumFillAmounts: JSON.stringify(
      originalMinimumFillAmounts.map(String)
    ),
    originalMaximumClaimAmounts: JSON.stringify(
      originalMaximumClaimAmounts.map(String)
    ),
    fillAmounts: JSON.stringify(fillAmounts.map(String)),
    claimAmounts: JSON.stringify(claimAmounts.map(String)),
    fillPriceImprovements: JSON.stringify(fillPriceImprovements),
    claimPriceImprovements: JSON.stringify(claimPriceImprovements),
    fillRecipients: fillRecipientsJson,
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
// FILL WITH CLAIM EVENT HANDLER
// ============================================================================

ponder.on("Tribunal:FillWithClaim", async ({ event, context }) => {
  const { db } = context;
  const { sponsor, claimant, claimHash, fillRecipients, claimAmounts, targetBlock } =
    event.args;

  const chainId = BigInt(context.network.chainId);
  const timestamp = event.block.timestamp;
  const fillerAddress = event.transaction.from;

  // Decode claimant to extract lock tag and recipient
  const { lockTag, recipient } = decodeClaimant(claimant);

  // Ensure filler account exists
  await ensureAccount(db, fillerAddress, timestamp);
  await ensureAccount(db, sponsor, timestamp);

  // Parse transaction input to get full mandate details
  const parsed = parseTransactionInput(event.transaction.input);

  if (!parsed) {
    console.error(
      `Failed to parse transaction input for FillWithClaim event: ${event.transaction.hash}`
    );
    return;
  }

  const { adjusterAddress, arbiterAddress, mandateHash } = parsed;

  await ensureAdjuster(db, adjusterAddress, timestamp);
  await ensureArbiter(db, arbiterAddress, timestamp);

  // Ensure mandate exists (or create it)
  await db
    .insert(schema.mandate)
    .values({
      mandateHash,
      chainId,
      sponsorAddress: sponsor,
      adjusterAddress,
      arbiterAddress,
      firstSeenAt: timestamp,
      blockNumber: event.block.number,
      transactionHash: event.transaction.hash,
      totalFills: 0n,
      totalCancellations: 0n,
    })
    .onConflictDoUpdate((row: any) => ({
      totalFills: row.totalFills + 1n,
    }));

  // Convert fillRecipients to JSON
  const fillRecipientsJson = JSON.stringify(
    fillRecipients.map((r: any) => ({
      fillAmount: r.fillAmount.toString(),
      recipient: r.recipient,
    }))
  );

  // Extract fillAmounts from fillRecipients
  const fillAmounts = fillRecipients.map((r: any) => r.fillAmount);

  // Get original amounts from parsed transaction
  const originalMinimumFillAmounts =
    parsed.originalMinimumFillAmounts || [];
  const originalMaximumClaimAmounts =
    parsed.originalMaximumClaimAmounts || [];

  // Calculate price improvements
  const fillPriceImprovements = fillAmounts.map((realized: bigint, i: number) => {
    const original = originalMinimumFillAmounts[i];
    return original ? calculatePriceImprovement(original, realized, false) : "0";
  });

  const claimPriceImprovements = claimAmounts.map(
    (realized: bigint, i: number) => {
      const original = originalMaximumClaimAmounts[i];
      return original ? calculatePriceImprovement(original, realized, true) : "0";
    }
  );

  // Insert fill record (use different ID to avoid collision with regular Fill events)
  const fillId = `${claimHash}-${chainId}-claim`;
  await db
    .insert(schema.fill)
    .values({
      id: fillId,
      claimHash,
      mandateHash,
      chainId,
      sponsorAddress: sponsor,
      fillerAddress,
      claimant,
      targetBlock,
      originalMinimumFillAmounts: JSON.stringify(
        originalMinimumFillAmounts.map(String)
      ),
      originalMaximumClaimAmounts: JSON.stringify(
        originalMaximumClaimAmounts.map(String)
      ),
      fillAmounts: JSON.stringify(fillAmounts.map(String)),
      claimAmounts: JSON.stringify(claimAmounts.map(String)),
      fillPriceImprovements: JSON.stringify(fillPriceImprovements),
      claimPriceImprovements: JSON.stringify(claimPriceImprovements),
      fillRecipients: fillRecipientsJson,
      claimantLockTag: lockTag,
      claimantRecipient: recipient,
      blockNumber: event.block.number,
      timestamp,
      transactionHash: event.transaction.hash,
      logIndex: event.log.logIndex,
      arbiterAddress,
    })
    .onConflictDoNothing(); // In case both Fill and FillWithClaim are emitted

  // Update chain statistics
  await updateChainStatistics(db, chainId, timestamp, { totalFills: 1n });
});

// ============================================================================
// CANCEL EVENT HANDLER
// ============================================================================

ponder.on("Tribunal:Cancel", async ({ event, context }) => {
  const { db } = context;
  const { sponsor, claimHash } = event.args;

  const chainId = BigInt(context.network.chainId);
  const timestamp = event.block.timestamp;

  // Ensure sponsor account exists
  await ensureAccount(db, sponsor, timestamp);

  // Parse transaction input to get mandate hash
  const parsed = parseTransactionInput(event.transaction.input);

  const mandateHash = parsed?.mandateHash || null;

  // Update mandate cancellation count if we can determine the mandate
  if (mandateHash && mandateHash !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
    await db
      .update(schema.mandate, { mandateHash, chainId })
      .set((row: any) => ({
        totalCancellations: row.totalCancellations + 1n,
      }))
      .catch(() => {
        // Mandate might not exist yet, that's OK
      });
  }

  // Insert cancellation record
  const cancellationId = `${claimHash}-${chainId}`;
  await db.insert(schema.cancellation).values({
    id: cancellationId,
    claimHash,
    mandateHash,
    chainId,
    sponsorAddress: sponsor,
    blockNumber: event.block.number,
    timestamp,
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
  });

  // Update chain statistics
  await updateChainStatistics(db, chainId, timestamp, {
    totalCancellations: 1n,
  });
});

// ============================================================================
// DISPATCH EVENT HANDLER (Optional)
// ============================================================================

ponder.on("Tribunal:Dispatch", async ({ event, context }) => {
  const { db } = context;
  const { dispatchTarget, chainId: targetChainId, claimant, claimHash } = event.args;

  const chainId = BigInt(context.network.chainId);
  const timestamp = event.block.timestamp;

  // Insert dispatch record
  const dispatchId = `${claimHash}-${chainId}-${event.log.logIndex}`;
  await db.insert(schema.dispatch).values({
    id: dispatchId,
    claimHash,
    chainId,
    targetChainId: BigInt(targetChainId),
    targetAddress: dispatchTarget,
    claimant,
    blockNumber: event.block.number,
    timestamp,
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex,
  });
});
