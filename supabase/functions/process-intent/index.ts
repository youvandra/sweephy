import { createClient } from "npm:@supabase/supabase-js@2.39.3";

import {
  Client, AccountId, TransferTransaction,
  Hbar, TransactionId, PublicKey,
  ContractExecuteTransaction, ContractFunctionParameters,
  ContractCallQuery,
  ContractId,
  TokenId,
} from "npm:@hashgraph/sdk@2.46.0";
import { KMSClient, GetPublicKeyCommand, SignCommand } from "npm:@aws-sdk/client-kms@3.437.0";
import { ethers } from "npm:ethers@6.11.1";

const getEnv = (key: string) => Deno.env.get(key) || "";
const SUPABASE_URL = getEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
const AWS_ACCESS_KEY_ID = getEnv("AWS_ACCESS_KEY_ID");
const AWS_SECRET_ACCESS_KEY = getEnv("AWS_SECRET_ACCESS_KEY");
const AWS_REGION = getEnv("AWS_REGION");
const AWS_KMS_KEY_ID = getEnv("AWS_KMS_KEY_ID");
const MIRROR_NODE_API = "https://mainnet-public.mirrornode.hedera.com";
const KMS_ACCOUNT_ID = AccountId.fromString("0.0.10304901");
const SECP256K1_N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");

// SAUCERSWAP CONSTANTS (Mainnet)
const SAUCERSWAP_ROUTER_ID = ContractId.fromString("0.0.3045981");
const WHBAR_TOKEN_ID = TokenId.fromString("0.0.1456986");
const USDC_TOKEN_ID = TokenId.fromString("0.0.456858");



// Node accounts untuk semua transaksi (konsisten)
const NODE_ACCOUNT_IDS = [
  new AccountId(3),
  new AccountId(4),
  new AccountId(5),
  new AccountId(6),
];

// Cache public key di module level
let cachedPublicKey: PublicKey | null = null;

function derToRaw(der: Uint8Array): { r: Uint8Array; s: Uint8Array } {
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error("Invalid DER: Missing Sequence");
  let lenByte = der[offset++];
  if (lenByte & 0x80) offset += lenByte & 0x7f;
  if (der[offset++] !== 0x02) throw new Error("Invalid DER: Missing Integer R");
  let rLen = der[offset++];
  let rBytes = der.slice(offset, offset + rLen);
  offset += rLen;
  if (der[offset++] !== 0x02) throw new Error("Invalid DER: Missing Integer S");
  let sLen = der[offset++];
  let sBytes = der.slice(offset, offset + sLen);

  const toBigInt = (arr: Uint8Array) =>
    BigInt("0x" + Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join(""));

  let r = toBigInt(rBytes);
  let s = toBigInt(sBytes);
  if (s > SECP256K1_N / 2n) s = SECP256K1_N - s;

  const to32Bytes = (val: bigint) => {
    let hex = val.toString(16).padStart(64, "0");
    return new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  };
  return { r: to32Bytes(r), s: to32Bytes(s) };
}

// ✅ FIX #1 — ROOT CAUSE SEBENARNYA dari INVALID_SIGNATURE:
//
// Keccak-256 sudah benar per HIP-222. Masalahnya adalah implementasi manual
// AWS4 HTTP signing via fetch() sangat rawan bug halus (format date, canonical
// headers, encoding) yang menyebabkan KMS mengembalikan signature dari key yang
// berbeda atau menolak request secara silent dengan hasil yang corrupted.
//
// Solusi: gunakan @aws-sdk/client-kms SignCommand yang sudah ada di package —
// SDK ini handle semua AWS4 auth secara internal, battle-tested, tidak perlu
// manual HTTP signing sama sekali. `getKmsPublicKey` sudah pakai SDK ini.
//
// Flow yang benar (per HIP-222 & official Hedera KMS guide):
// 1. SDK memanggil signer dengan raw transaction bytes (bodyBytes)
// 2. Kita keccak256-hash bytes tersebut → 32 byte digest
// 3. Kirim ke KMS dengan MessageType: "DIGEST" (KMS tidak hash lagi)
// 4. KMS kembalikan DER-encoded signature → decode ke raw 64-byte (r+s)
// 5. Low-S normalization wajib dilakukan agar signature valid di Hedera
async function awsSign(messageHashBytes: Uint8Array, keyId: string): Promise<Uint8Array> {
  // Step 1: Keccak-256 dari raw transaction bytes
  const digestHex = ethers.keccak256(messageHashBytes).replace("0x", "");
  const digest = new Uint8Array(digestHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));

  // Step 2: Gunakan AWS SDK — jauh lebih reliable daripada manual AWS4 signing
  const kms = new KMSClient({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });

  const response = await kms.send(new SignCommand({
    KeyId: keyId,
    Message: digest,          // Uint8Array langsung — tidak perlu base64 manual
    MessageType: "DIGEST",    // Kita sudah hash, KMS jangan hash lagi
    SigningAlgorithm: "ECDSA_SHA_256",
  }));

  if (!response.Signature) throw new Error("KMS Sign returned no signature");

  // Step 3: Decode DER → raw r+s (dengan low-S normalization)
  const der = new Uint8Array(response.Signature);
  const { r, s } = derToRaw(der); // derToRaw sudah handle low-S normalization

  const sig = new Uint8Array(64);
  sig.set(r, 0);
  sig.set(s, 32);
  return sig;
}

async function getKmsPublicKey(): Promise<PublicKey> {
  if (cachedPublicKey) return cachedPublicKey;
  const kms = new KMSClient({
    region: AWS_REGION,
    credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
  });
  const { PublicKey: pubKeyBytes } = await kms.send(new GetPublicKeyCommand({ KeyId: AWS_KMS_KEY_ID }));
  if (!pubKeyBytes) throw new Error("No public key from KMS");

  const derBytes = new Uint8Array(pubKeyBytes);

  if (derBytes.length !== 88) throw new Error(`Unexpected DER length: ${derBytes.length}`);
  if (derBytes[23] !== 0x04) throw new Error(`Expected 0x04 at index 23, got: ${derBytes[23]}`);

  const x = derBytes.slice(24, 56);
  const y = derBytes.slice(56, 88);

  const prefix = (y[31] & 1) === 0 ? 0x02 : 0x03;
  const compressed = new Uint8Array(33);
  compressed[0] = prefix;
  compressed.set(x, 1);

  cachedPublicKey = PublicKey.fromBytesECDSA(compressed);
  return cachedPublicKey;
}

async function resolveAccountId(address: string): Promise<string> {
  if (address.match(/^\d+\.\d+\.\d+$/)) return address;

  const evmAddr = address.startsWith("0x") ? address : "0x" + address;

  const res = await fetch(`${MIRROR_NODE_API}/api/v1/accounts/${evmAddr}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Mirror node ${res.status}: ${await res.text()}`);

  const data = await res.json();
  if (!data.account) throw new Error(`No Hedera account for: ${evmAddr}`);

  return data.account;
}

function toMirrorNodeTransactionId(txId: string): string {
  const at = txId.indexOf("@");
  if (at === -1) return txId;
  const account = txId.slice(0, at);
  const validStart = txId.slice(at + 1);
  const dot = validStart.indexOf(".");
  if (dot === -1) return `${account}-${validStart}`;
  const seconds = validStart.slice(0, dot);
  const nanos = validStart.slice(dot + 1);
  return `${account}-${seconds}-${nanos}`;
}

// ✅ FIX #8: Tambah pagination untuk allowance check
async function verifyAllowance(ownerAccountId: string, spenderAccountId: string): Promise<number> {
  let nextLink: string | null =
    `${MIRROR_NODE_API}/api/v1/accounts/${ownerAccountId}/allowances/crypto?limit=100`;

  while (nextLink) {
    const res = await fetch(nextLink, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      console.warn("Cannot check allowance:", res.status);
      return -1; // Unknown, proceed anyway
    }

    const data = await res.json();
    const allowances: any[] = data.allowances || [];

    const match = allowances.find((a: any) => a.spender === spenderAccountId);
    if (match) {
      return Number(match.amount);
    }

    // Pagination: lanjut ke halaman berikutnya jika ada
    nextLink = data.links?.next
      ? `${MIRROR_NODE_API}${data.links.next}`
      : null;
  }

  console.warn("No allowance found for spender:", spenderAccountId);
  return 0;
}

// Cek apakah account sudah associate token tertentu via mirror node
async function checkTokenAssociation(accountId: string, tokenId: string): Promise<boolean> {
  try {
    // Mirror node tokenId format: 0.0.XXXXX
    const normalizedTokenId = tokenId.includes(".") ? tokenId : TokenId.fromString(tokenId).toString();
    const res = await fetch(
      `${MIRROR_NODE_API}/api/v1/accounts/${accountId}/tokens?token.id=${normalizedTokenId}&limit=1`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return false;
    const data = await res.json();
    return (data.tokens?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

// ✅ FIX decode: per dokumentasi resmi SaucerSwap, cara yang benar adalah
// execute() → getRecord() → record.contractFunctionResult.getResult(['uint[]'])
// BUKAN ContractCallQuery + ethers decode.
async function getEstimatedAmountOut(client: Client, amountHbar: number): Promise<bigint> {
  try {
    const amountTinybars = BigInt(Math.floor(amountHbar * 1e8));
    const path = [WHBAR_TOKEN_ID.toSolidityAddress(), USDC_TOKEN_ID.toSolidityAddress()];

    const query = new ContractCallQuery()
      .setContractId(SAUCERSWAP_ROUTER_ID)
      .setGas(100000)
      .setFunction("getAmountsOut", new ContractFunctionParameters()
        .addUint256(amountTinybars.toString())
        .addAddressArray(path)
      );

    const result = await query.execute(client);

    // Per dokumentasi resmi SaucerSwap: getResult(['uint[]']) adalah cara yang benar
    // untuk decode dynamic array dari ContractFunctionResult.
    // https://docs.saucerswap.finance/developer/saucerswap-v1/swap-operations/swap-hbar-for-tokens
    const values = result.getResult(["uint[]"]);
    const amounts: bigint[] = values[0];

    // amounts[0] = HBAR input (tinybars), amounts[1] = USDC output (smallest unit, 1e6)
    const amountOut = amounts[amounts.length - 1];
    console.log(`getEstimatedAmountOut: ${amountHbar} HBAR = ${amountOut} uUSDC`);
    return BigInt(amountOut.toString());
  } catch (e) {
    console.error("Failed to estimate amount out:", e);
    return BigInt(0);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const logIntent = async (
    deviceId: string, action: string, pair: string,
    amount: number, status: string, txId: string | null, note: string
  ) => {
    try {
      const { data: intent } = await supabase.from("intents").insert({
        device_id: deviceId, action, pair, amount,
        status, tx_id: txId || "failed",
      }).select().single();

      if (intent) {
        await supabase.from("intent_logs").insert({
          intent_id: intent.id,
          tx_hash: txId || "failed",
          signed_by: KMS_ACCOUNT_ID.toString(),
          details: { status, note },
        });
      }
    } catch (e) {
      console.error("logIntent failed:", e);
    }
  };

  try {
    if (!SUPABASE_URL || !AWS_ACCESS_KEY_ID || !AWS_KMS_KEY_ID) {
      throw new Error("Missing env vars");
    }

    const { device_id, payload: payloadStr } = await req.json();
    if (!device_id || !payloadStr) throw new Error("Missing device_id or payload");

    const { data: device, error: deviceError } = await supabase
      .from("devices")
      .select("*, profiles(*, rules(*))")
      .eq("id", device_id)
      .single();

    if (deviceError || !device) {
      return new Response(JSON.stringify({ error: "Device not found" }), { status: 404 });
    }

    const { action, pairing_code } = JSON.parse(payloadStr);

    // Heartbeat fire-and-forget
    supabase.from("devices")
      .update({ last_seen: new Date().toISOString(), status: "online" })
      .eq("id", device_id)
      .then(() => {});

    // --- PAIR ---
    if (action === "pair") {
      if (!pairing_code) throw new Error("Pairing code required");
      const { data: code } = await supabase.from("pairing_codes")
        .select("*").eq("device_id", device_id).eq("code", pairing_code).single();
      if (!code || code.used) throw new Error("Invalid or used pairing code");

      await supabase.from("pairing_codes").update({ used: true }).eq("id", code.id);
      await supabase.from("devices").update({ is_paired: true }).eq("id", device_id);
      return new Response(JSON.stringify({ status: "success", message: "Paired" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // --- SWAP (Streaming Response) ---
    if (action === "swap") {
      const encoder = new TextEncoder();

      // ✅ FIX #6: intentId dikelola di luar stream scope menggunakan object
      // agar bisa diakses dari outer catch maupun stream catch.
      const state = { intentId: null as string | null };

      const updateIntentStatus = async (status: string, txId: string, note: string, amount?: number) => {
        if (!state.intentId) return;
        await supabase.from("intents").update({
          status,
          tx_id: txId || "failed",
          amount: amount || 0,
        }).eq("id", state.intentId);

        await supabase.from("intent_logs").insert({
          intent_id: state.intentId,
          tx_hash: txId || "failed",
          signed_by: KMS_ACCOUNT_ID.toString(),
          details: { status, note },
        });
      };

      const stream = new ReadableStream({
        async start(controller) {
          let streamClosed = false;

          const send = (msg: string) => {
            if (streamClosed) {
              console.warn("Attempted send after stream closed:", msg);
              return;
            }
            try {
              controller.enqueue(encoder.encode(msg + "\n"));
            } catch (e) {
              streamClosed = true;
              console.warn("Stream closed on send:", msg, e);
            }
          };

          // Keepalive ping setiap 5 detik agar koneksi HTTP tidak timeout
          // selama operasi transfer + swap yang bisa memakan 30-60 detik.
          const keepaliveInterval = setInterval(() => {
            if (streamClosed) {
              clearInterval(keepaliveInterval);
              return;
            }
            try {
              controller.enqueue(encoder.encode("PING\n"));
            } catch {
              streamClosed = true;
              clearInterval(keepaliveInterval);
            }
          }, 5000);

          try {
            send("STATUS:Verifying Device...");

            // Idempotency Check
            const { data: recentIntent } = await supabase
              .from("intents")
              .select("created_at, status")
              .eq("device_id", device_id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (recentIntent) {
              const timeDiff = Date.now() - new Date(recentIntent.created_at).getTime();
              if (
                timeDiff < 60000 &&
                (recentIntent.status === "processing" ||
                  recentIntent.status === "success" ||
                  recentIntent.status === "completed")
              ) {
                console.warn(`Duplicate request ignored for device ${device_id}`);
                send("ERROR:Too Many Requests");
                return;
              }
            }

            const { data: newIntent, error: intentError } = await supabase.from("intents").insert({
              device_id: device_id,
              action: "swap",
              pair: "HBAR/USDC",
              amount: 0,
              status: "processing",
              tx_id: "pending",
            }).select().single();

            if (intentError || !newIntent) {
              console.error("DB Error:", intentError);
              throw new Error("DB Error: Failed to init intent");
            }
            // ✅ FIX #6: Simpan ke state object (bukan local var) agar accessible di luar
            state.intentId = newIntent.id;

            if (!device.is_paired) {
              await updateIntentStatus("failed", "failed", "Device not paired");
              throw new Error("Device not paired");
            }

            const user = device.profiles;
            const rules = user?.rules;

            if (!rules?.allowance_granted) {
              await updateIntentStatus("failed", "failed", "Allowance not granted in DB");
              console.error("allowance_granted is false in DB for user:", user?.id);
              throw new Error("ALLOWANCE ERR");
            }

            // 1. Resolve account ID
            send("STATUS:Verifying Account...");
            let userAccountIdStr: string;
            try {
              userAccountIdStr = await resolveAccountId(user.wallet_address);
            } catch (e: any) {
              console.error("Resolve failed:", e.message);
              await updateIntentStatus("failed", "failed", `Resolve failed: ${e.message}`);
              throw new Error("RESOLVE ERR");
            }

            const amountHbar = Math.max(rules.swap_amount || 1.0, 0.1);
            const amountTinybars = Math.floor(amountHbar * 1e8);

            await supabase.from("intents").update({ amount: amountHbar }).eq("id", state.intentId);

            // 2. Verify allowance on-chain (dengan pagination)
            send("STATUS:Checking Allowance...");
            const remainingTinybars = await verifyAllowance(userAccountIdStr, KMS_ACCOUNT_ID.toString());

            if (remainingTinybars === 0) {
              await updateIntentStatus("failed", "failed", "No allowance on-chain");
              throw new Error("ALLOWANCE ERR");
            }
            if (remainingTinybars > 0 && remainingTinybars < amountTinybars) {
              await updateIntentStatus("failed", "failed", `Allowance insufficient: ${remainingTinybars} < ${amountTinybars}`);
              throw new Error("ALLOWANCE LOW");
            }

            // 3. Setup client + KMS
            const client = Client.forMainnet();
            client.setMaxAttempts(5);
            client.setRequestTimeout(45000);

            const publicKey = await getKmsPublicKey();
            client.setOperatorWith(KMS_ACCOUNT_ID, publicKey, (msg) => awsSign(msg, AWS_KMS_KEY_ID));

            const userAccountId = AccountId.fromString(userAccountIdStr);
            let transferSucceeded = false;
            let swapCompleted = false;

            // 3b. Pre-check: pastikan user account sudah associate USDC
            // Ini WAJIB dilakukan SEBELUM transfer HBAR — supaya jika gagal,
            // tidak ada dana yang sudah berpindah dan perlu di-refund.
            // SaucerSwap V1 akan revert (CONTRACT_REVERT_EXECUTED) jika recipient
            // belum associate output token, per dokumentasi resmi SaucerSwap.
            send("STATUS:Checking USDC Association...");
            const isUsdcAssociated = await checkTokenAssociation(
              userAccountIdStr,
              USDC_TOKEN_ID.toString()
            );
            if (!isUsdcAssociated) {
              await updateIntentStatus("failed", "failed", "User account not associated with USDC");
              throw new Error("USDC_NOT_ASSOCIATED");
            }

            // 3c. Pre-check: pastikan KMS operator account juga sudah associate USDC.
            // "Safe token transfer failed!" terjadi karena SaucerSwap Router memanggil
            // safeTransferToken dari KMS account (msg.sender) ke user account.
            // Hedera HTS mensyaratkan msg.sender juga sudah associate token yang di-transfer.
            const isKmsUsdcAssociated = await checkTokenAssociation(
              KMS_ACCOUNT_ID.toString(),
              USDC_TOKEN_ID.toString()
            );
            if (!isKmsUsdcAssociated) {
              await updateIntentStatus("failed", "failed", "KMS operator account not associated with USDC — associate manually via HashPack or SDK");
              throw new Error("KMS_USDC_NOT_ASSOCIATED");
            }

            // 4. Build & execute transfer
            send("STATUS:Transferring HBAR...");
            const transferTx = new TransferTransaction()
              .addApprovedHbarTransfer(userAccountId, new Hbar(-amountHbar))
              .addHbarTransfer(KMS_ACCOUNT_ID, new Hbar(amountHbar))
              .setTransactionId(TransactionId.generate(KMS_ACCOUNT_ID))
              .setMaxTransactionFee(new Hbar(2))
              .setNodeAccountIds(NODE_ACCOUNT_IDS) // ✅ Konsisten
              .freezeWith(client);

            const signedTx = await transferTx.signWithOperator(client);
            let txId = transferTx.transactionId?.toString() || "";

            try {
              const result = await Promise.race([
                signedTx.execute(client).then((r) => r.getReceipt(client)),
                new Promise<never>((_, rej) => setTimeout(() => rej(new Error("TX_TIMEOUT")), 60000)),
              ]);

              transferSucceeded = true;
              await updateIntentStatus("processing", txId, "Transfer OK", amountHbar);

              try {
                await executeSwap(amountHbar, userAccountId, txId);
              } catch (postTransferErr: any) {
                if (transferSucceeded && !swapCompleted) {
                  try {
                    // ✅ FIX #4: Refund juga pakai NODE_ACCOUNT_IDS
                    const refundTx = new TransferTransaction()
                      .addHbarTransfer(KMS_ACCOUNT_ID, new Hbar(-amountHbar))
                      .addHbarTransfer(userAccountId, new Hbar(amountHbar))
                      .setTransactionId(TransactionId.generate(KMS_ACCOUNT_ID))
                      .setNodeAccountIds(NODE_ACCOUNT_IDS)
                      .freezeWith(client);
                    const signedRefund = await refundTx.signWithOperator(client);
                    await (await signedRefund.execute(client)).getReceipt(client);
                    await updateIntentStatus(
                      "failed",
                      txId,
                      `Post-transfer error. REFUNDED. ${postTransferErr?.message || postTransferErr}`,
                      amountHbar,
                    );
                    send("ERROR:Post-transfer error. HBAR Refunded.");
                    return;
                  } catch (refundErr: any) {
                    await updateIntentStatus(
                      "failed",
                      txId,
                      `Post-transfer error & REFUND FAILED: ${refundErr?.message || refundErr}`,
                      amountHbar,
                    );
                    send("ERROR:CRITICAL: Refund Failed. Contact Support.");
                    return;
                  }
                }
                throw postTransferErr;
              }

            } catch (txErr: any) {
              console.error("TX Error:", txErr.message);

              if (txErr.message === "TX_TIMEOUT" || txErr.message.includes("UNKNOWN") || txErr.message.includes("max attempts")) {
                try {
                  const mirrorTxId = toMirrorNodeTransactionId(txId);
                  for (let attempt = 0; attempt < 4; attempt++) {
                    await new Promise((r) => setTimeout(r, 5000));
                    const check = await fetch(`${MIRROR_NODE_API}/api/v1/transactions/${mirrorTxId}`, {
                      signal: AbortSignal.timeout(5000),
                    });

                    if (check.ok) {
                      const { transactions } = await check.json();
                      const successTx = transactions?.find((t: any) => t.result === "SUCCESS");
                      if (successTx) {
                        console.log("Recovered: TX succeeded on-chain despite timeout/error");
                        transferSucceeded = true;
                        await updateIntentStatus("processing", txId, "Recovered from " + txErr.message, amountHbar);
                        send("STATUS:Transfer Verified (Recovered)");

                        await executeSwap(amountHbar, userAccountId, txId);
                        return;
                      }
                    }
                  }
                } catch (recoveryErr) {
                  console.error("Recovery check failed:", recoveryErr);
                }

                await updateIntentStatus("failed", "failed", txErr.message);
                throw new Error("SERVER TIMEOUT/UNKNOWN");
              }

              if (txErr.message?.includes("SPENDER_DOES_NOT_HAVE_ALLOWANCE") ||
                txErr.message?.includes("AMOUNT_EXCEEDS_ALLOWANCE")) {
                await updateIntentStatus("failed", "failed", txErr.message);
                throw new Error("ALLOWANCE ERR");
              }

              await updateIntentStatus("failed", "failed", txErr.message);
              throw new Error(txErr.message);
            }

            // --- Swap Logic ---
            async function executeSwap(amountHbar: number, userAccountId: AccountId, txId: string) {
              send("STATUS:Swapping HBAR->USDC");

              // Declare di luar try agar catch bisa akses transactionId untuk mirror node lookup
              let swapTxId = "";

              try {
                // getAmountsOut mengembalikan amounts dalam unit masing-masing token:
                // amounts[0] = HBAR input dalam tinybars (1e8)
                // ✅ FIX: Calculate Slippage Dynamic based on user rules
                const estimatedOut = await getEstimatedAmountOut(client, amountHbar);
                if (estimatedOut === 0n) {
                  throw new Error("Cannot estimate swap output. Aborting to protect funds.");
                }

                // Get slippage from rules, default to 0.5% if not set
                // Note: rules.slippage_tolerance is percentage (e.g. 0.5 for 0.5%)
                const slippagePercent = rules?.slippage_tolerance || 0.5;
                
                // Calculate amountOutMin
                // Formula: amountOutMin = estimatedOut * (1 - slippage/100)
                // In basis points (10000): amountOutMin = estimatedOut * (10000 - slippage*100) / 10000
                const slippageBps = BigInt(Math.floor(slippagePercent * 100));
                const amountOutMin = (estimatedOut * (10000n - slippageBps)) / 10000n;

                console.log(`Swap: ${amountHbar} HBAR → est. ${estimatedOut} uUSDC, min ${amountOutMin} uUSDC (slippage: ${slippagePercent}%)`);

                // Resolve EVM address yang benar untuk parameter `to` di contract call.
                // wallet_address bisa berupa format apapun (0.0.XXXXX, EVM hex, dll).
                // Kita perlu EVM alias 20-byte (40 hex chars) yang valid untuk addAddress().
                // Cara paling reliable: fetch dari mirror node → field evm_address.
                let to: string;
                try {
                  const accRes = await fetch(
                    `${MIRROR_NODE_API}/api/v1/accounts/${userAccountIdStr}`,
                    { signal: AbortSignal.timeout(5000) }
                  );
                  if (!accRes.ok) throw new Error("Mirror node account fetch failed");
                  const accData = await accRes.json();
                  // evm_address adalah EVM alias 20-byte yang valid untuk HTS contract calls
                  const evmAddress = accData.evm_address as string | undefined;
                  if (!evmAddress || evmAddress.length < 40) throw new Error("No valid evm_address");
                  to = evmAddress.startsWith("0x") ? evmAddress : "0x" + evmAddress;
                } catch (addrErr: any) {
                  // Fallback: gunakan toSolidityAddress() dari AccountId
                  console.warn("EVM address fetch failed, using toSolidityAddress:", addrErr.message);
                  to = userAccountId.toSolidityAddress();
                }
                console.log("Swap to address:", to);
                const deadline = Math.floor(Date.now() / 1000) + 1200;
                const path = [WHBAR_TOKEN_ID.toSolidityAddress(), USDC_TOKEN_ID.toSolidityAddress()];

                const swapTx = new ContractExecuteTransaction()
                  .setContractId(SAUCERSWAP_ROUTER_ID)
                  .setGas(2500000)
                  .setPayableAmount(amountHbar)
                  .setFunction("swapExactETHForTokens", new ContractFunctionParameters()
                    .addUint256(amountOutMin.toString())  // USDC smallest unit (1e6)
                    .addAddressArray(path)
                    .addAddress(to)
                    .addUint256(deadline)
                  )
                  .setTransactionId(TransactionId.generate(KMS_ACCOUNT_ID))
                  .setNodeAccountIds(NODE_ACCOUNT_IDS)
                  .freezeWith(client);

                swapTxId = swapTx.transactionId?.toString() || "";
                console.log("Executing swap tx:", swapTxId);
                send("STATUS:Executing swap on-chain...");

                const signedSwapTx = await swapTx.signWithOperator(client);
                const swapResponse = await signedSwapTx.execute(client);
                console.log("Swap execute() returned, getting receipt...");

                // getReceipt() otomatis throw jika status != SUCCESS
                // Pisahkan dari execute() agar bisa dibedakan mana yang gagal
                try {
                  await swapResponse.getReceipt(client);
                } catch (receiptErr: any) {
                  console.error("getReceipt error:", receiptErr.message);

                  // Jika CONTRACT_REVERT atau status error — swap gagal, aman refund
                  if (
                    receiptErr.message?.includes("CONTRACT_REVERT") ||
                    receiptErr.message?.includes("INVALID") ||
                    receiptErr.message?.includes("INSUFFICIENT")
                  ) {
                    throw receiptErr;
                  }

                  // Jika timeout/UNKNOWN — verifikasi mirror node dulu sebelum refund
                  console.warn("Receipt inconclusive, verifying via mirror node...");
                  send("STATUS:Verifying swap on-chain...");

                  const mirrorId = toMirrorNodeTransactionId(swapTxId);
                  let verified = false;
                  for (let i = 0; i < 6; i++) {
                    await new Promise(r => setTimeout(r, 4000));
                    try {
                      const check = await fetch(
                        `${MIRROR_NODE_API}/api/v1/transactions/${mirrorId}`,
                        { signal: AbortSignal.timeout(5000) }
                      );
                      if (check.ok) {
                        const { transactions } = await check.json();
                        if (transactions?.find((t: any) => t.result === "SUCCESS")) {
                          console.log("Mirror node: swap SUCCESS");
                          verified = true;
                          break;
                        }
                        if (transactions?.length > 0) {
                          console.log("Mirror node: swap result =", transactions[0].result);
                          throw new Error("SWAP_FAILED: " + transactions[0].result);
                        }
                      }
                    } catch (e: any) {
                      if (e.message?.startsWith("SWAP_FAILED")) throw e;
                    }
                  }
                  if (!verified) throw new Error("SWAP_UNVERIFIED_TIMEOUT");
                }

                swapCompleted = true;

                send("STATUS:Transferring USDC...");
                await updateIntentStatus(
                  "completed",
                  txId,
                  `Swap complete. Est: ${estimatedOut} uUSDC, Min: ${amountOutMin} uUSDC`,
                  amountHbar,
                );

                send("SUCCESS:" + txId);

              } catch (swapErr: any) {
                // SAFETY GUARD: Jika swapCompleted sudah true, swap sudah sukses.
                // Jangan refund — ini seharusnya tidak terjadi, tapi sebagai last resort.
                if (swapCompleted) {
                  console.error("BUG: entered catch after swapCompleted=true:", swapErr.message);
                  send("SUCCESS:" + txId);
                  return;
                }

                // Fetch exact revert reason dari mirror node
                if (swapTxId && swapErr.message?.includes("CONTRACT_REVERT_EXECUTED")) {
                  try {
                    const mirrorId = toMirrorNodeTransactionId(swapTxId);
                    const r = await fetch(
                      `${MIRROR_NODE_API}/api/v1/contracts/results/${mirrorId}`,
                      { signal: AbortSignal.timeout(5000) }
                    );
                    if (r.ok) {
                      const d = await r.json();
                      const reason = d.error_message || d.revert_reason || "no revert reason in mirror";
                      console.error("Contract revert reason:", reason);
                      swapErr.message = `CONTRACT_REVERT: ${reason}`;
                    }
                  } catch (e) {
                    console.warn("Could not fetch revert reason:", e);
                  }
                }

                // Jika error bukan SWAP_FAILED_VERIFIED (artinya bukan dari mirror verify kita),
                // lakukan satu kali pengecekan mirror node sebelum refund untuk safety.
                if (swapTxId && swapErr.message !== "SWAP_FAILED_VERIFIED") {
                  try {
                    const mirrorId = toMirrorNodeTransactionId(swapTxId);
                    await new Promise(r => setTimeout(r, 3000));
                    const check = await fetch(
                      `${MIRROR_NODE_API}/api/v1/transactions/${mirrorId}`,
                      { signal: AbortSignal.timeout(5000) }
                    );
                    if (check.ok) {
                      const { transactions } = await check.json();
                      const success = transactions?.find((t: any) => t.result === "SUCCESS");
                      if (success) {
                        // Swap ternyata sukses — jangan refund!
                        console.log("Swap was actually SUCCESS — skipping refund");
                        swapCompleted = true;
                        await updateIntentStatus("completed", txId, "Swap SUCCESS (recovered from catch)", amountHbar);
                        send("SUCCESS:" + txId);
                        return;
                      }
                    }
                  } catch { /* lanjut ke refund */ }
                }

                console.error("Swap Error:", swapErr.message);
                send("STATUS:Swap Failed. Refunding...");

                try {
                  const refundTx = new TransferTransaction()
                    .addHbarTransfer(KMS_ACCOUNT_ID, new Hbar(-amountHbar))
                    .addHbarTransfer(userAccountId, new Hbar(amountHbar))
                    .setTransactionId(TransactionId.generate(KMS_ACCOUNT_ID))
                    .setNodeAccountIds(NODE_ACCOUNT_IDS)
                    .freezeWith(client);

                  const signedRefund = await refundTx.signWithOperator(client);
                  await (await signedRefund.execute(client)).getReceipt(client);

                  await updateIntentStatus(
                    "failed",
                    txId,
                    `Swap Failed: ${swapErr.message}. REFUNDED.`,
                    amountHbar,
                  );
                  send("ERROR:Swap Failed. HBAR Refunded.");
                } catch (refundErr: any) {
                  console.error("Refund Failed:", refundErr.message);
                  await updateIntentStatus(
                    "failed",
                    txId,
                    `Swap Failed & REFUND FAILED: ${refundErr.message}`,
                    amountHbar,
                  );
                  send("ERROR:CRITICAL: Refund Failed. Contact Support.");
                }
              }
            }

          } catch (error: any) {
            console.error("Critical error:", error);
            let msg = error.message;
            if (msg.length > 50) msg = msg.substring(0, 50);

            // ✅ FIX #6: state.intentId sekarang accessible karena pakai object reference
            if (state.intentId) {
              await updateIntentStatus("failed", "failed", `Critical Error: ${msg}`)
                .catch(e => console.error("Failed to log critical error", e));
            }

            send("ERROR:" + msg);
          } finally {
            streamClosed = true;
            clearInterval(keepaliveInterval);
            try { controller.close(); } catch { /* already closed */ }
          }
        }
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",  // Disable nginx buffering jika ada reverse proxy
        },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });

  } catch (error: any) {
    console.error("Critical error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});