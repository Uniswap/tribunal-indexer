# Tribunal Indexer

A multichain indexer for the [Tribunal protocol](https://github.com/Uniswap/Tribunal) built with [Ponder](https://ponder.sh). This indexer tracks cross-chain auction executions, fills, cancellations, and dispatch events across multiple EVM chains.

## Overview

Tribunal is a protocol for running competitive priority gas auctions (PGA) for claims against resource locks in The Compact. This indexer provides a GraphQL API for querying:

- **Fills**: Auction executions with fill amounts and claim amounts
- **Cancellations**: Sponsor-initiated cancellations of unfilled auctions
- **Dispatches**: Cross-chain message relay events
- **Mandates**: Auction parameters and statistics
- **Accounts**: Sponsors, fillers, adjusters, and arbiters

## Supported Chains

### Mainnets
- Ethereum Mainnet (Chain ID: 1)
- Base (Chain ID: 8453)
- Arbitrum One (Chain ID: 42161)
- Optimism (Chain ID: 10)
- Unichain (Chain ID: 130)

### Testnets
- Sepolia (Chain ID: 11155111)
- Base Sepolia (Chain ID: 84532)
- Arbitrum Sepolia (Chain ID: 421614)
- Optimism Sepolia (Chain ID: 11155420)
- Unichain Sepolia (Chain ID: 1301)

## Prerequisites

- Node.js >= 18.14
- pnpm (recommended) or npm
- RPC endpoints for the chains you want to index

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd tribunal-indexer
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

4. Edit `.env.local` and add your RPC URLs:
```bash
# Example for Alchemy
PONDER_RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
PONDER_RPC_URL_11155111=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
# ... add other chains as needed
```

## Development

### Run the indexer in development mode:
```bash
pnpm dev
```

This will:
- Start the indexer and begin syncing historical data
- Launch a GraphQL API server at `http://localhost:42069`
- Provide a GraphQL playground at `http://localhost:42069/graphql`

### Generate types:
```bash
pnpm codegen
```

### Type checking:
```bash
pnpm typecheck
```

### Linting:
```bash
pnpm lint
```

## Production Deployment

1. Build and start the indexer:
```bash
pnpm start
```

2. For production database, set `DATABASE_URL` in `.env.local`:
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/tribunal_indexer
```

## GraphQL API

Once running, the GraphQL API is available at `http://localhost:42069/graphql`.

### Example Queries

#### Get recent fills across all chains:
```graphql
query GetRecentFills {
  fills(
    orderBy: "timestamp"
    orderDirection: "DESC"
    limit: 50
  ) {
    items {
      claimHash
      chainId
      sponsorAddress
      fillerAddress
      claimant
      claimantRecipient
      fillAmounts
      claimAmounts
      targetBlock
      timestamp
      transactionHash
    }
  }
}
```

#### Get fills for a specific filler:
```graphql
query GetFillerFills($fillerAddress: String!) {
  fills(
    where: { fillerAddress: { equals: $fillerAddress } }
    orderBy: "timestamp"
    orderDirection: "DESC"
  ) {
    items {
      claimHash
      chainId
      fillAmounts
      claimAmounts
      timestamp
      mandate {
        sponsorAddress
        adjusterAddress
      }
    }
  }
}
```

#### Get chain statistics:
```graphql
query GetChainStats {
  chainStatistics(
    orderBy: "totalFills"
    orderDirection: "DESC"
  ) {
    items {
      chainId
      totalFills
      totalCancellations
      lastUpdated
    }
  }
}
```

#### Get mandate details with all fills:
```graphql
query GetMandateDetails($mandateHash: String!, $chainId: BigInt!) {
  mandate(mandateHash: $mandateHash, chainId: $chainId) {
    mandateHash
    chainId
    sponsorAddress
    adjusterAddress
    arbiterAddress
    totalFills
    totalCancellations
    fills {
      items {
        claimHash
        fillerAddress
        fillAmounts
        claimAmounts
        timestamp
      }
    }
  }
}
```

## Database Schema

The indexer uses the following main entities:

- **account**: All addresses (sponsors, fillers)
- **adjuster**: Adjusters who provide signed adjustments
- **arbiter**: Arbiters responsible for processing claims
- **mandate**: Auction parameters and statistics
- **fill**: Executed fills with amounts and recipients
- **cancellation**: Sponsor-initiated cancellations
- **dispatch**: Cross-chain message relay events
- **chainStatistics**: Aggregated statistics per chain

## Architecture

The indexer follows the design patterns established by [The Compact Indexer](https://github.com/Uniswap/the-compact-indexer):

1. **Multi-chain Support**: All entities include `chainId` for cross-chain tracking
2. **Event Handlers**: Separate handlers for Fill, FillWithClaim, Cancel, and Dispatch events
3. **Helper Functions**: Utilities for account management, claimant decoding, and statistics updates
4. **Relations**: Leverages Ponder's relations for GraphQL nesting

## Contract Information

- **Contract Address**: `0x000000000000790009689f43bAedb61D67D45bB8` (same on all chains)
- **Events Indexed**:
  - `Fill`: Emitted when a filler executes a fill
  - `FillWithClaim`: Emitted when a fill is executed with a claim
  - `Cancel`: Emitted when a sponsor cancels an auction
  - `Dispatch`: Emitted for cross-chain message dispatches

## Known Limitations

1. **Transaction Input Parsing**: Currently uses placeholder logic for extracting mandate details from transaction inputs. In production, implement proper ABI decoding to extract sponsor, adjuster, and arbiter addresses from the `BatchCompact`, `FillParameters`, and `Adjustment` structs.

2. **Mandate Hash Derivation**: The mandate hash needs to be properly computed from transaction inputs to accurately link fills and cancellations to their respective mandates.

## Future Enhancements

- [ ] Implement transaction input parsing for mandate details
- [ ] Add token metadata enrichment
- [ ] Implement derived pricing metrics
- [ ] Add historical snapshots
- [ ] Create aggregated statistics tables
- [ ] Build admin dashboard
- [ ] Add webhook notifications for fills

## Resources

- [Ponder Documentation](https://ponder.sh/docs)
- [Tribunal Protocol](https://github.com/Uniswap/Tribunal)
- [The Compact Protocol](https://github.com/Uniswap/the-compact)
- [The Compact Indexer](https://github.com/Uniswap/the-compact-indexer)

## License

MIT
