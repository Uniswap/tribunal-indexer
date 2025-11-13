import { createConfig } from "ponder";
import { http } from "viem";

import { TribunalAbi } from "./abis/TribunalAbi";

// Tribunal contract address (same across all chains)
const TRIBUNAL_ADDRESS = "0x000000000000790009689f43bAedb61D67D45bB8";

// Deployment blocks for each chain
const DEPLOYMENT_BLOCKS = {
  // Mainnets
  1: 23792251, // Ethereum Mainnet
  8453: 38136046, // Base
  42161: 399920589, // Arbitrum One
  10: 143731559, // Optimism
  130: 32312809, // Unichain

  // Testnets
  11155111: 9623396, // Sepolia
  84532: 33647071, // Base Sepolia
  421614: 214897561, // Arbitrum Sepolia
  11155420: 35629884, // Optimism Sepolia
  1301: 36209562, // Unichain Sepolia
};

export default createConfig({
  ordering: "multichain",
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
