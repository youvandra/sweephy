"use client";

import { createAppKit } from '@reown/appkit/react'
import { HederaAdapter } from '@hashgraph/hedera-wallet-connect'
import { hedera as hederaViem } from '@reown/appkit/networks'
import type { CaipNetwork } from '@reown/appkit'
import { HederaChainDefinition } from '@hashgraph/hedera-wallet-connect'

// Use the official Native Hedera Mainnet definition
const hedera = HederaChainDefinition.Native.Mainnet

// Custom Adapter to enforce Mainnet only
class ProductionHederaAdapter extends HederaAdapter {
  private _networks: CaipNetwork[]

  constructor(params: any) {
    // Filter networks based on the namespace we are initializing with
    // The base HederaAdapter constructor throws if we pass mixed networks that don't match the namespace
    const filteredNetworks = params.networks.filter((n: any) => n.chainNamespace === params.namespace)
    
    // Pass only the matching networks to the super constructor
    super({
        ...params,
        networks: filteredNetworks
    })
    
    // Store ALL networks for our custom behavior
    this._networks = params.networks as CaipNetwork[]
    
    // Override getCaipNetworks to return the correct networks for the requested namespace
    // This allows the adapter to handle requests for either namespace if the AppKit asks
    this.getCaipNetworks = (namespace?: string) => {
      if (namespace) {
          return this._networks.filter(n => n.chainNamespace === namespace)
      }
      return this._networks
    }
  }

  // Implement missing abstract method from AdapterBlueprint
  async writeSolanaTransaction(params: any): Promise<any> {
    throw new Error('Solana not supported on Hedera adapter')
  }
}

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
    new ProductionHederaAdapter({
      projectId,
      namespace: 'hedera', 
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
