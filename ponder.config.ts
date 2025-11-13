import { createConfig } from "ponder";
import { http } from "viem";

import { TribunalAbi } from "./abis/TribunalAbi";

export default createConfig({
  ordering: "multichain",
  networks: {
    mainnet: { chainId: 1, transport: http(process.env.PONDER_RPC_URL_1) },
    sepolia: { chainId: 11155111, transport: http(process.env.PONDER_RPC_URL_11155111) },
    base: { chainId: 8453, transport: http(process.env.PONDER_RPC_URL_8453) },
    baseSepolia: { chainId: 84532, transport: http(process.env.PONDER_RPC_URL_84532) },
    arbitrum: { chainId: 42161, transport: http(process.env.PONDER_RPC_URL_42161) },
    arbitrumSepolia: { chainId: 421614, transport: http(process.env.PONDER_RPC_URL_421614) },
    optimism: { chainId: 10, transport: http(process.env.PONDER_RPC_URL_10) },
    optimismSepolia: { chainId: 11155420, transport: http(process.env.PONDER_RPC_URL_11155420) },
    unichain: { chainId: 130, transport: http(process.env.PONDER_RPC_URL_130) },
    unichainSepolia: { chainId: 1301, transport: http(process.env.PONDER_RPC_URL_1301) },
  },
  contracts: {
    Tribunal: {
      abi: TribunalAbi,
      address: "0x000000000000790009689f43bAedb61D67D45bB8",
      network: {
        mainnet: { startBlock: 23792251 },
        sepolia: { startBlock: 9623396 },
        base: { startBlock: 38136046 },
        baseSepolia: { startBlock: 33647071 },
        arbitrum: { startBlock: 399920589 },
        arbitrumSepolia: { startBlock: 214897561 },
        optimism: { startBlock: 143731559 },
        optimismSepolia: { startBlock: 35629884 },
        unichain: { startBlock: 32312809 },
        unichainSepolia: { startBlock: 36209562 },
      },
    },
  },
});
