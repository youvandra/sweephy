"use client";

import { createAppKit } from '@reown/appkit/react'
import { HederaAdapter } from '@hashgraph/hedera-wallet-connect'
import { hedera as hederaViem } from '@reown/appkit/networks'

// Define the network with explicit namespace
const hedera = {
  ...hederaViem,
  chainNamespace: 'eip155',
  caipNetworkId: 'eip155:295'
} as const

// 1. Get projectId from https://cloud.reown.com (formerly cloud.walletconnect.com)
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || '8e394f4a38575a02e52c88f17a941a8a'

// 2. Create a metadata object - optional
const metadata = {
  name: 'Sweephy',
  description: '1-Tap Swap for ESP32',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://sweephy.com',
  icons: ['https://avatars.githubusercontent.com/u/37784886']
}

// 3. Create the AppKit instance
createAppKit({
  adapters: [
    new HederaAdapter({
      projectId,
      namespace: 'eip155',
      networks: [hedera]
    })
  ],
  networks: [hedera],
  metadata,
  projectId,
  features: {
    analytics: true
  }
})

export function Web3ModalProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
