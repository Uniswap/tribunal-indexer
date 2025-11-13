# Price Improvement Implementation Summary

## Overview
This document summarizes the implementation of price improvement tracking for the Tribunal indexer, which now tracks original minimum fill amounts, realized fill amounts, original maximum claim amounts, realized claim amounts, and calculates price improvement metrics.

## Changes Made

### 1. Schema Updates (`ponder.schema.ts`)

Added the following fields to the `fill` table:

```typescript
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
```

### 2. Transaction Parsing Updates (`src/Tribunal.ts`)

#### Updated `TransactionDetails` Interface
```typescript
interface TransactionDetails {
  sponsorAddress: Address;
  adjusterAddress: Address;
  arbiterAddress: Address;
  mandateHash: Hex;
  originalMinimumFillAmounts?: bigint[];  // NEW
  originalMaximumClaimAmounts?: bigint[]; // NEW
}
```

#### Enhanced `parseTransactionInput` Function
The function now extracts:
- **Original minimum fill amounts** from `mandate.components[].minimumFillAmount`
- **Original maximum claim amounts** from `compact.commitments[].amount`

These values are extracted from the transaction calldata for both `fill`/`fillAndDispatch` and `claimAndFill` function calls.

### 3. Price Improvement Calculation

Added new helper function `calculatePriceImprovement`:

```typescript
function calculatePriceImprovement(
  original: bigint,
  realized: bigint,
  isClaim: boolean = false
): string
```

**Logic:**
- **For fills**: `improvement = ((realized - minimum) / minimum) * 100`
  - Positive values indicate the filler received MORE than the minimum (better for filler)
  - Negative values indicate the filler received LESS than the minimum

- **For claims**: `improvement = ((maximum - realized) / maximum) * 100`
  - Positive values indicate the claimant paid LESS than the maximum (better for claimant)
  - Negative values indicate the claimant paid MORE than the maximum

Returns a string with 2 decimal places (e.g., "10.50" for 10.5% improvement).

### 4. Event Handler Updates

Both `Tribunal:Fill` and `Tribunal:FillWithClaim` event handlers now:

1. Extract original amounts from parsed transaction data
2. Calculate price improvements for each fill and claim amount
3. Store all data in the database:
   - `originalMinimumFillAmounts`: JSON array of original minimums
   - `originalMaximumClaimAmounts`: JSON array of original maximums
   - `fillAmounts`: JSON array of realized fill amounts
   - `claimAmounts`: JSON array of realized claim amounts
   - `fillPriceImprovements`: JSON array of percentage improvements
   - `claimPriceImprovements`: JSON array of percentage improvements

## Data Format

All amounts are stored as JSON-encoded string arrays to handle BigInt values:

```json
{
  "originalMinimumFillAmounts": ["1000000000000000000", "2000000000000000000"],
  "originalMaximumClaimAmounts": ["1000000000000000000", "2000000000000000000"],
  "fillAmounts": ["1050000000000000000", "1900000000000000000"],
  "claimAmounts": ["950000000000000000", "1900000000000000000"],
  "fillPriceImprovements": ["5.00", "-5.00"],
  "claimPriceImprovements": ["5.00", "5.00"]
}
```

In this example:
- First fill: filler received 5% MORE than minimum (good)
- Second fill: filler received 5% LESS than minimum (bad)
- First claim: claimant paid 5% LESS than maximum (good)
- Second claim: claimant paid 5% LESS than maximum (good)

## Usage

Once the indexer is running and processing events, you can query the price improvement data:

```typescript
// Query fills with price improvement data
const fills = await db.find(schema.fill, {
  // your filters
});

fills.forEach(fill => {
  const originalMins = JSON.parse(fill.originalMinimumFillAmounts);
  const originalMaxs = JSON.parse(fill.originalMaximumClaimAmounts);
  const fillAmounts = JSON.parse(fill.fillAmounts);
  const claimAmounts = JSON.parse(fill.claimAmounts);
  const fillImprovements = JSON.parse(fill.fillPriceImprovements);
  const claimImprovements = JSON.parse(fill.claimPriceImprovements);
  
  console.log('Fill price improvements:', fillImprovements);
  console.log('Claim price improvements:', claimImprovements);
});
```

## Next Steps

1. Configure `.env.local` with your RPC URLs and database settings
2. Run `pnpm dev` to start the indexer
3. The indexer will process Fill and FillWithClaim events, extracting and calculating price improvements
4. Query the data through the Ponder GraphQL API or directly from the database

## Benefits

- **Full transparency**: Track both original and realized amounts
- **Performance metrics**: Calculate exact price improvement for fills and claims
- **Historical data**: All price improvements are preserved for analysis
- **Flexible queries**: JSON format allows easy parsing and filtering
