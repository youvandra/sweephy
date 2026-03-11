import { createClient } from "npm:@supabase/supabase-js@2.39.3";

import {
  Client, AccountId, TransferTransaction,
  Hbar, TransactionId, PublicKey,
  ContractExecuteTransaction, ContractFunctionParameters,
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
const KMS_ACCOUNT_ID = AccountId.fromString(getEnv("KMS_ACCOUNT_ID") || "0.0.10304901");
const SWEEPHY_CONTRACT_ID = ContractId.fromString(getEnv("SWEEPHY_CONTRACT_ID") || "0.0.10354696");
const SECP256K1_N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");

// SAUCERSWAP CONSTANTS (Mainnet)
const SAUCERSWAP_ROUTER_ID = ContractId.fromString(getEnv("SAUCERSWAP_ROUTER_ID") || "0.0.3045981");
const WHBAR_TOKEN_ID = TokenId.fromString(getEnv("WHBAR_TOKEN_ID") || "0.0.1456986");
const USDC_TOKEN_ID = TokenId.fromString(getEnv("USDC_TOKEN_ID") || "0.0.456858");

const kmsClient = new KMSClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

let cachedPublicKey: PublicKey | null = null;

// FIX #5: Cache resolved account IDs to avoid redundant Mirror Node calls
const accountIdCache = new Map<string, string>();

function derToRaw(der: Uint8Array): { r: Uint8Array; s: Uint8Array } {
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error("Invalid DER: Missing Sequence");
  const lenByte = der[offset++];
  if (lenByte & 0x80) offset += lenByte & 0x7f;
  if (der[offset++] !== 0x02) throw new Error("Invalid DER: Missing Integer R");
  const rLen = der[offset++];
  const rBytes = der.slice(offset, offset + rLen);
  offset += rLen;
  if (der[offset++] !== 0x02) throw new Error("Invalid DER: Missing Integer S");
  const sLen = der[offset++];
  const sBytes = der.slice(offset, offset + sLen);

  const toBigInt = (arr: Uint8Array) =>
    BigInt("0x" + Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join(""));

  const r = toBigInt(rBytes);
  let s = toBigInt(sBytes);
  if (s > SECP256K1_N / 2n) s = SECP256K1_N - s;

  const to32Bytes = (val: bigint) => {
    const hex = val.toString(16).padStart(64, "0");
    return new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  };
  return { r: to32Bytes(r), s: to32Bytes(s) };
}

// FIX #6: Remove double-hash. Hedera SDK already sends pre-hashed message bytes.
// Passing messageHashBytes directly to KMS as DIGEST — no keccak256 re-hash needed.
async function awsSign(messageHashBytes: Uint8Array, keyId: string): Promise<Uint8Array> {
  const response = await kmsClient.send(new SignCommand({
    KeyId: keyId,
    Message: messageHashBytes, // Already a digest from Hedera SDK — do NOT re-hash
    MessageType: "DIGEST",
    SigningAlgorithm: "ECDSA_SHA_256",
  }));

  if (!response.Signature) throw new Error("KMS Sign returned no signature");

  const der = new Uint8Array(response.Signature);
  const { r, s } = derToRaw(der);

  const sig = new Uint8Array(64);
  sig.set(r, 0);
  sig.set(s, 32);
  return sig;
}

async function getKmsPublicKey(): Promise<PublicKey> {
  if (cachedPublicKey) return cachedPublicKey;

  const { PublicKey: pubKeyBytes } = await kmsClient.send(new GetPublicKeyCommand({ KeyId: AWS_KMS_KEY_ID }));
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

// FIX #5: Added in-memory cache to avoid repeat Mirror Node lookups
async function resolveAccountId(address: string): Promise<string> {
  if (address.match(/^\d+\.\d+\.\d+$/)) return address;

  if (accountIdCache.has(address)) return accountIdCache.get(address)!;

  const evmAddr = address.startsWith("0x") ? address : "0x" + address;

  const res = await fetch(`${MIRROR_NODE_API}/api/v1/accounts/${evmAddr}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Mirror node ${res.status}: ${await res.text()}`);

  const data = await res.json();
  if (!data.account) throw new Error(`No Hedera account for: ${evmAddr}`);

  accountIdCache.set(address, data.account);
  return data.account;
}

// FIX #7: Pad nanos to 9 digits for correct Mirror Node transaction ID format
function toMirrorNodeTransactionId(txId: string): string {
  const at = txId.indexOf("@");
  if (at === -1) return txId;
  const account = txId.slice(0, at);
  const validStart = txId.slice(at + 1);
  const dot = validStart.indexOf(".");
  if (dot === -1) return `${account}-${validStart}`;
  const seconds = validStart.slice(0, dot);
  const nanos = validStart.slice(dot + 1).padStart(9, "0"); // FIX: always 9 digits
  return `${account}-${seconds}-${nanos}`;
}

// Verify on-chain allowance with pagination
async function verifyAllowance(ownerAccountId: string, spenderAccountId: string): Promise<number> {
  let nextLink: string | null =
    `${MIRROR_NODE_API}/api/v1/accounts/${ownerAccountId}/allowances/crypto?limit=100`;

  while (nextLink) {
    const res = await fetch(nextLink, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return -1;

    const data = (await res.json()) as {
      allowances?: Array<{ spender?: string; amount?: number }>;
      links?: { next?: string };
    };
    const allowances = data.allowances || [];

    const match = allowances.find((a) => a.spender === spenderAccountId);
    if (match?.amount !== undefined) return Number(match.amount);

    nextLink = data.links?.next ? `${MIRROR_NODE_API}${data.links.next}` : null;
  }

  return 0;
}

// Check if account has associated with a token via Mirror Node
async function checkTokenAssociation(accountId: string, tokenId: string): Promise<boolean> {
  try {
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

async function verifySignature(payload: string, signatureHex: string, secret: string): Promise<boolean> {
  try {
    const sig = signatureHex.trim().toLowerCase();
    if (!sig.match(/^[0-9a-f]+$/) || sig.length % 2 !== 0) return false;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureBytes = new Uint8Array(sig.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
    const payloadBytes = new TextEncoder().encode(payload);
    return await crypto.subtle.verify("HMAC", key, signatureBytes, payloadBytes);
  } catch {
    return false;
  }
}

async function getEstimatedAmountOut(amountHbar: number): Promise<bigint> {
  try {
    const amountTinybars = BigInt(Math.floor(amountHbar * 1e8));
    const path = [WHBAR_TOKEN_ID.toSolidityAddress(), USDC_TOKEN_ID.toSolidityAddress()];

    const iface = new ethers.Interface([
      "function getAmountsOut(uint256 amountIn, address[] path) external view returns (uint256[] amounts)"
    ]);
    const encodedData = iface.encodeFunctionData("getAmountsOut", [amountTinybars.toString(), path]);

    const response = await fetch(`${MIRROR_NODE_API}/api/v1/contracts/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        block: "latest",
        data: encodedData,
        to: SAUCERSWAP_ROUTER_ID.toSolidityAddress(),
        estimate: false
      })
    });

    if (!response.ok) {
      throw new Error(`Mirror node contract call failed: ${response.status}`);
    }

    const result = await response.json();
    const decoded = iface.decodeFunctionResult("getAmountsOut", result.result);
    const amounts = decoded[0];

    return BigInt(amounts[amounts.length - 1].toString());
  } catch (e) {
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

  try {
    if (!SUPABASE_URL || !AWS_ACCESS_KEY_ID || !AWS_KMS_KEY_ID) {
      throw new Error("Missing env vars");
    }

    const { device_id, payload: payloadStr, signature } = await req.json();
    if (!device_id || !payloadStr || !signature) throw new Error("Missing device_id, payload, or signature");

    const { data: device, error: deviceError } = await supabase
      .from("devices")
      .select("*, profiles(*, rules(*))")
      .eq("id", device_id)
      .single();

    if (deviceError || !device) {
      return new Response(JSON.stringify({ error: "Device not found" }), { status: 404 });
    }

    const isValid = await verifySignature(payloadStr, signature, device.secret_hash);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if device is disabled
    if (device.is_disabled) {
      return new Response(JSON.stringify({ error: "DEVICE_DISABLED" }), { status: 403 });
    }

    const { action, pairing_code } = JSON.parse(payloadStr);

    // Heartbeat (fire-and-forget)
    supabase.from("devices")
      .update({ last_seen: new Date().toISOString(), status: "online" })
      .eq("id", device_id)
      .then(() => {});

    // --- READY (Warm-up & Pre-flight Check) ---
    if (action === "ready") {
      try {
        if (!device.is_paired) throw new Error("Device not paired");
        const user = device.profiles;
        if (!user) throw new Error("No user profile found");
        const rules = user.rules;
        if (!rules?.allowance_granted) throw new Error("Allowance not granted");

        // FIX: Parallelise ALL pre-checks including resolve + KMS key warm-up
        const [userAccountIdStr, publicKey] = await Promise.all([
          resolveAccountId(user.wallet_address),
          getKmsPublicKey(),
        ]);

        const [
          remainingTinybars,
          isUsdcAssociated,
          isKmsUsdcAssociated,
          isContractUsdcAssociated,
          isContractWhbarAssociated
        ] = await Promise.all([
          verifyAllowance(userAccountIdStr, SWEEPHY_CONTRACT_ID.toString()),
          checkTokenAssociation(userAccountIdStr, USDC_TOKEN_ID.toString()),
          checkTokenAssociation(KMS_ACCOUNT_ID.toString(), USDC_TOKEN_ID.toString()),
          checkTokenAssociation(SWEEPHY_CONTRACT_ID.toString(), USDC_TOKEN_ID.toString()),
          checkTokenAssociation(SWEEPHY_CONTRACT_ID.toString(), WHBAR_TOKEN_ID.toString()),
        ]);

        if (remainingTinybars === 0) throw new Error("No allowance");
        if (!isUsdcAssociated) throw new Error("User USDC not associated");
        if (!isKmsUsdcAssociated) throw new Error("KMS USDC not associated");
        if (!isContractUsdcAssociated) throw new Error("Contract USDC not associated");
        if (!isContractWhbarAssociated) throw new Error("Contract WHBAR not associated");
        if (!publicKey) throw new Error("KMS Key init failed");

        return new Response(JSON.stringify({ status: "ready", message: "System Ready" }), {
          headers: { "Content-Type": "application/json" },
        });

      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown Error";
        return new Response(JSON.stringify({ status: "not_ready", error: msg }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

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
      const state = { intentId: null as string | null };

      const updateIntentStatus = async (
        status: string,
        txId: string,
        note: string,
        amount?: number,
        extra?: Partial<{
          tx_id_swap: string;
          tx_id_transfer: string;
          tx_id_refund: string;
          tx_id_receipt: string;
          amount_received: string | number;
        }>
      ) => {
        if (!state.intentId) return;
        const updates: Record<string, unknown> = {
          status,
          tx_id: txId || "failed",
          note: note,
        };
        if (amount !== undefined) updates.amount = amount;
        if (extra) {
          if (extra.tx_id_swap) updates.tx_id_swap = extra.tx_id_swap;
          if (extra.tx_id_transfer) updates.tx_id_transfer = extra.tx_id_transfer;
          if (extra.tx_id_refund) updates.tx_id_refund = extra.tx_id_refund;
          if (extra.tx_id_receipt) updates.tx_id_receipt = extra.tx_id_receipt;
          if (extra.amount_received) updates.amount_received = extra.amount_received;
        }

        await supabase.from("intents").update(updates).eq("id", state.intentId);
      };

      const stream = new ReadableStream({
        async start(controller) {
          let streamClosed = false;

          req.signal.addEventListener("abort", () => {
            streamClosed = true;
          });

          const send = (msg: string) => {
            if (streamClosed) return;
            try {
              controller.enqueue(encoder.encode(msg + "\n"));
            } catch (e) {
              streamClosed = true;
            }
          };

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

            if (intentError || !newIntent) throw new Error("DB Error: Failed to init intent");
            state.intentId = newIntent.id;

            if (!device.is_paired) {
              await updateIntentStatus("failed", "failed", "Device not paired");
              throw new Error("Device not paired");
            }

            const user = device.profiles;
            const rules = user?.rules;

            if (!rules?.allowance_granted) {
              await updateIntentStatus("failed", "failed", "Allowance not granted in DB");
              throw new Error("ALLOWANCE ERR");
            }

            const amountHbar = Math.max(rules.swap_amount || 1.0, 0.1);
            const amountTinybars = Math.floor(amountHbar * 1e8);

            // Daily Limit Check
            if (rules.daily_limit && rules.daily_limit > 0) {
              const today = new Date().toISOString().split("T")[0];
              const { data: dailyStats, error: dailyError } = await supabase
                .from("intents")
                .select("amount")
                .eq("device_id", device_id)
                .eq("status", "completed")
                .gte("created_at", `${today}T00:00:00.000Z`)
                .lte("created_at", `${today}T23:59:59.999Z`);

              if (!dailyError && dailyStats) {
                const stats = dailyStats as Array<{ amount: number | null }>;
                const totalSwappedToday = stats.reduce((sum, intent) => sum + (intent.amount || 0), 0);
                if (totalSwappedToday + amountHbar > rules.daily_limit) {
                  await updateIntentStatus("failed", "failed", `Daily limit reached. Used: ${totalSwappedToday}, Limit: ${rules.daily_limit}`);
                  throw new Error(`DAILY_LIMIT_EXCEEDED: Used ${totalSwappedToday.toFixed(2)}/${rules.daily_limit}`);
                }
              }
            }

            await supabase.from("intents").update({ amount: amountHbar }).eq("id", state.intentId);

            // OPTIMISATION: Parallelise account resolve + estimation + KMS key warm-up
            // These are all independent — run together to save ~400-600ms
            send("STATUS:Verifying Network State...");

            const [userAccountIdStr, estimatedOut, publicKey] = await Promise.all([
              resolveAccountId(user.wallet_address),         // Mirror Node lookup (cached after first call)
              getEstimatedAmountOut(amountHbar),             // Mirror Node contract call
              getKmsPublicKey(),                             // KMS (cached after first call)
            ]);

            // Now verify allowance and associations (require userAccountIdStr)
            const [
              remainingTinybars,
              isUsdcAssociated,
              isKmsUsdcAssociated,
              isContractUsdcAssociated,
              isContractWhbarAssociated,
            ] = await Promise.all([
              verifyAllowance(userAccountIdStr, SWEEPHY_CONTRACT_ID.toString()),
              checkTokenAssociation(userAccountIdStr, USDC_TOKEN_ID.toString()),
              checkTokenAssociation(KMS_ACCOUNT_ID.toString(), USDC_TOKEN_ID.toString()),
              checkTokenAssociation(SWEEPHY_CONTRACT_ID.toString(), USDC_TOKEN_ID.toString()),
              checkTokenAssociation(SWEEPHY_CONTRACT_ID.toString(), WHBAR_TOKEN_ID.toString()),
            ]);

            // Validate checks
            if (remainingTinybars === 0) {
              await updateIntentStatus("failed", "failed", "No allowance on-chain");
              throw new Error("ALLOWANCE ERR");
            }
            if (remainingTinybars > 0 && remainingTinybars < amountTinybars) {
              await updateIntentStatus("failed", "failed", `Allowance insufficient: ${remainingTinybars} < ${amountTinybars}`);
              throw new Error("ALLOWANCE LOW");
            }
            if (!isUsdcAssociated) {
              await updateIntentStatus("failed", "failed", "User account not associated with USDC");
              throw new Error("USDC_NOT_ASSOCIATED");
            }
            if (!isKmsUsdcAssociated) {
              await updateIntentStatus("failed", "failed", "KMS operator account not associated with USDC");
              throw new Error("KMS_USDC_NOT_ASSOCIATED");
            }
            if (!isContractUsdcAssociated) {
              await updateIntentStatus("failed", "failed", "Swap contract not associated with USDC");
              throw new Error("CONTRACT_USDC_NOT_ASSOCIATED");
            }
            if (!isContractWhbarAssociated) {
              await updateIntentStatus("failed", "failed", "Swap contract not associated with WHBAR");
              throw new Error("CONTRACT_WHBAR_NOT_ASSOCIATED");
            }

            // Setup Hedera client
            const client = Client.forMainnet();
            client.setMaxAttempts(5);
            client.setRequestTimeout(45000);
            // FIX #6: awsSign no longer double-hashes — operator signing is now correct
            client.setOperatorWith(KMS_ACCOUNT_ID, publicKey, (msg: Uint8Array) => awsSign(msg, AWS_KMS_KEY_ID));

            const userAccountId = AccountId.fromString(userAccountIdStr);

            send("STATUS:Initiating Smart Contract Swap...");

            try {
              if (estimatedOut === 0n) {
                throw new Error("Cannot estimate swap output. Aborting to protect funds.");
              }

              const feeBps = 20n; // 0.2%
              const slippagePercent = rules?.slippage_tolerance || 0.5;
              const slippageBps = BigInt(Math.floor(slippagePercent * 100));

              // estimatedOut = output for full amountHbar
              // Contract will swap 99.8% of amountHbar after deducting fee
              // So scale down estimated output proportionally, then apply slippage
              const estimatedAfterFee = (estimatedOut * (10000n - feeBps)) / 10000n;
              const amountOutMin = (estimatedAfterFee * (10000n - slippageBps)) / 10000n;

              const userSolidityAddress = userAccountId.toSolidityAddress();

              // FIX #5: Reduced gas limit to stay within Hedera node limits (~3M max)
              const contractTx = new ContractExecuteTransaction()
                .setContractId(SWEEPHY_CONTRACT_ID)
                .setGas(2500000) // FIX: was 4000000 which can exceed Hedera max
                .setFunction("executeSwap", new ContractFunctionParameters()
                  .addAddress(userSolidityAddress)
                  .addInt64(BigInt(amountTinybars).toString())
                  .addUint256(amountOutMin.toString())
                )
                .setTransactionId(TransactionId.generate(KMS_ACCOUNT_ID))
                .freezeWith(client);

              const txId = contractTx.transactionId?.toString() || "";
              send("STATUS:Executing Contract Call...");

              const signedTx = await contractTx.signWithOperator(client);
              const response = await signedTx.execute(client);

              await updateIntentStatus("processing", txId, "Contract Call Executed", amountHbar, { tx_id_swap: txId });

              // Verify Receipt
              try {
                const receipt = await response.getReceipt(client);
                if (receipt.status.toString() !== "SUCCESS") {
                  throw new Error(`Contract Call Failed: ${receipt.status.toString()}`);
                }
              } catch (receiptErr: unknown) {
                const receiptMsg = receiptErr instanceof Error ? receiptErr.message : String(receiptErr);
                if (receiptMsg.includes("CONTRACT_REVERT")) {
                  try {
                    // FIX #7: nanos now padded to 9 digits
                    const mirrorId = toMirrorNodeTransactionId(txId);
                    const r = await fetch(
                      `${MIRROR_NODE_API}/api/v1/contracts/results/${mirrorId}`,
                      { signal: AbortSignal.timeout(5000) }
                    );
                    if (r.ok) {
                      const d = await r.json();
                      const reason = d.error_message || d.revert_reason || null;
                      if (reason) {
                        await updateIntentStatus("failed", txId, `Revert: ${reason}`, amountHbar);
                      }
                    }
                  } catch { /* ignore fetch error */ }
                }
                throw new Error(receiptMsg);
              }

              const estimatedOutFormatted = ethers.formatUnits(estimatedOut, 6);
              await updateIntentStatus(
                "completed",
                txId,
                `Swap complete via Contract. Est: ${estimatedOut} uUSDC`,
                amountHbar,
                { tx_id_swap: txId, amount_received: estimatedOutFormatted }
              );
              send("SUCCESS:" + estimatedOutFormatted);

            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Unknown Error";
              await updateIntentStatus("failed", "failed", msg);
              send("ERROR:" + msg);
            }

          } catch (error: unknown) {
            let msg = error instanceof Error ? error.message : "Unknown Error";
            if (msg.length > 50) msg = msg.substring(0, 50);

            if (state.intentId) {
              await updateIntentStatus("failed", "failed", `Critical Error: ${msg}`)
                .catch(() => {});
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
          "X-Accel-Buffering": "no",
        },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown Error";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
