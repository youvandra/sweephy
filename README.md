This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Deploy Smart Contract (Hedera Mainnet)

Script deploy contract: [deploy-sweephy-contract.ts](file:///Users/youvandrafebrial/Documents/trae_projects/sweephy/scripts/deploy-sweephy-contract.ts)

```bash
npx ts-node scripts/deploy-sweephy-contract.ts
```

Test compile tanpa deploy:

```bash
npx ts-node scripts/deploy-sweephy-contract.ts --compile-only
```

Dry-run (cek parameter constructor tanpa broadcast transaksi):

```bash
npx ts-node scripts/deploy-sweephy-contract.ts --dry-run
```

Environment variables yang dibutuhkan:

- Pilih salah satu signer untuk deploy:
  - Local signer:
    - HEDERA_OPERATOR_ID
    - HEDERA_OPERATOR_PRIVATE_KEY
    - HEDERA_OPERATOR_KEY_TYPE (optional: AUTO|DER|ECDSA|ED25519, default: AUTO)
  - AWS KMS signer:
    - AWS_ACCESS_KEY_ID
    - AWS_SECRET_ACCESS_KEY
    - AWS_REGION (default: us-east-1)
    - AWS_KMS_KEY_ID
    - KMS_ACCOUNT_ID

- SAUCERSWAP_ROUTER_ID (default: 0.0.3045981)
- WHBAR_TOKEN_ID (default: 0.0.1456986)
- USDC_TOKEN_ID (default: 0.0.456858)

Flow swap saat ini: user memberi allowance HBAR ke akun KMS, lalu KMS mengeksekusi swap ke SaucerSwap.

- Set `KMS_ACCOUNT_ID` di Supabase Edge Function environment (spender allowance + executor transaksi).
- Set `NEXT_PUBLIC_KMS_ACCOUNT_ID` di Next.js environment (untuk UI grant/revoke allowance ke KMS).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
