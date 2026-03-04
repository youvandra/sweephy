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
const KMS_ACCOUNT_ID = AccountId.fromString(getEnv("KMS_ACCOUNT_ID") || "0.0.10304901");
const SECP256K1_N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");

// SAUCERSWAP CONSTANTS (Mainnet)
const SAUCERSWAP_ROUTER_ID = ContractId.fromString(getEnv("SAUCERSWAP_ROUTER_ID") || "0.0.3045981");
const WHBAR_TOKEN_ID = TokenId.fromString(getEnv("WHBAR_TOKEN_ID") || "0.0.1456986");
const USDC_TOKEN_ID = TokenId.fromString(getEnv("USDC_TOKEN_ID") || "0.0.456858");

// Node accounts for all transactions
const NODE_ACCOUNT_IDS = [
  new AccountId(3),
  new AccountId(4),
  new AccountId(5),
  new AccountId(6),
];

const kmsClient = new KMSClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

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

async function awsSign(messageHashBytes: Uint8Array, keyId: string): Promise<Uint8Array> {
  const digestHex = ethers.keccak256(messageHashBytes).replace("0x", "");
  const digest = new Uint8Array(digestHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));

  const response = await kmsClient.send(new SignCommand({
    KeyId: keyId,
    Message: digest,
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

// Verify on-chain allowance with pagination
async function verifyAllowance(ownerAccountId: string, spenderAccountId: string): Promise<number> {
  let nextLink: string | null =
    `${MIRROR_NODE_API}/api/v1/accounts/${ownerAccountId}/allowances/crypto?limit=100`;

  while (nextLink) {
    const res = await fetch(nextLink, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return -1;

    const data = await res.json();
    const allowances: any[] = data.allowances || [];

    const match = allowances.find((a: any) => a.spender === spenderAccountId);
    if (match) return Number(match.amount);

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

async function getEstimatedAmountOut(client: Client, amountHbar: number): Promise<bigint> {
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

    // Check if device is disabled - Block all actions if disabled
    if (device.is_disabled) {
      return new Response(JSON.stringify({ error: "DEVICE_DISABLED" }), { status: 403 });
    }

    const { action, pairing_code } = JSON.parse(payloadStr);

    // Heartbeat
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

        // 1. Resolve Account
        let userAccountIdStr: string;
        try {
          userAccountIdStr = await resolveAccountId(user.wallet_address);
        } catch (e: any) {
          throw new Error(`Resolve failed: ${e.message}`);
        }

        // 2. Parallel Warm-up & Checks
        const [
          remainingTinybars,
          isUsdcAssociated,
          isKmsUsdcAssociated,
          publicKey
        ] = await Promise.all([
          verifyAllowance(userAccountIdStr, KMS_ACCOUNT_ID.toString()),
          checkTokenAssociation(userAccountIdStr, USDC_TOKEN_ID.toString()),
          checkTokenAssociation(KMS_ACCOUNT_ID.toString(), USDC_TOKEN_ID.toString()),
          getKmsPublicKey()
        ]);

        if (remainingTinybars === 0) throw new Error("No allowance");
        if (!isUsdcAssociated) throw new Error("User USDC not associated");
        if (!isKmsUsdcAssociated) throw new Error("KMS USDC not associated");
        if (!publicKey) throw new Error("KMS Key init failed");

        return new Response(JSON.stringify({ status: "ready", message: "System Ready" }), {
          headers: { "Content-Type": "application/json" },
        });

      } catch (e: any) {
        return new Response(JSON.stringify({ status: "not_ready", error: e.message }), {
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

      const updateIntentStatus = async (status: string, txId: string, note: string, amount?: number) => {
        if (!state.intentId) return;
        await supabase.from("intents").update({
          status,
          tx_id: txId || "failed",
          amount: amount || 0,
        }).eq("id", state.intentId);
      };

      const stream = new ReadableStream({
        async start(controller) {
          let streamClosed = false;

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

            // 1. Resolve account ID
            send("STATUS:Verifying Account...");
            let userAccountIdStr: string;
            try {
              userAccountIdStr = await resolveAccountId(user.wallet_address);
            } catch (e: any) {
              await updateIntentStatus("failed", "failed", `Resolve failed: ${e.message}`);
              throw new Error("RESOLVE ERR");
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
                const totalSwappedToday = dailyStats.reduce((sum, intent) => sum + (intent.amount || 0), 0);
                if (totalSwappedToday + amountHbar > rules.daily_limit) {
                  await updateIntentStatus("failed", "failed", `Daily limit reached. Used: ${totalSwappedToday}, Limit: ${rules.daily_limit}`);
                  throw new Error(`DAILY_LIMIT_EXCEEDED: Used ${totalSwappedToday.toFixed(2)}/${rules.daily_limit}`);
                }
              }
            }

            await supabase.from("intents").update({ amount: amountHbar }).eq("id", state.intentId);

            // 2. Parallel Pre-Checks (Allowance, Associations, KMS Key)
            send("STATUS:Verifying Network State...");
            
            const [
              remainingTinybars,
              isUsdcAssociated,
              isKmsUsdcAssociated,
              publicKey 
            ] = await Promise.all([
              verifyAllowance(userAccountIdStr, KMS_ACCOUNT_ID.toString()),
              checkTokenAssociation(userAccountIdStr, USDC_TOKEN_ID.toString()),
              checkTokenAssociation(KMS_ACCOUNT_ID.toString(), USDC_TOKEN_ID.toString()),
              getKmsPublicKey()
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

            // 3. Setup client + KMS
            const client = Client.forMainnet();
            client.setMaxAttempts(5);
            client.setRequestTimeout(45000);

            // Set operator with the key we already fetched
            client.setOperatorWith(KMS_ACCOUNT_ID, publicKey, (msg) => awsSign(msg, AWS_KMS_KEY_ID));

            const userAccountId = AccountId.fromString(userAccountIdStr);
            let transferSucceeded = false;
            let swapCompleted = false;

            // 4. Build & execute transfer
            const NETWORK_FEE_BUFFER = 0.001; 
            const totalPullAmount = amountHbar + NETWORK_FEE_BUFFER;

            send("STATUS:Transferring HBAR...");
            const transferTx = new TransferTransaction()
              .addApprovedHbarTransfer(userAccountId, new Hbar(-totalPullAmount)) 
              .addHbarTransfer(KMS_ACCOUNT_ID, new Hbar(totalPullAmount))       
              .setTransactionId(TransactionId.generate(KMS_ACCOUNT_ID))         
              .setMaxTransactionFee(new Hbar(2))
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
                // We only swap the original requested amount, keeping the buffer in KMS to cover the fee
                await executeSwap(amountHbar, userAccountId, txId);
              } catch (postTransferErr: any) {
                if (transferSucceeded && !swapCompleted) {
                  try {
                    const refundTx = new TransferTransaction()
                      .addHbarTransfer(KMS_ACCOUNT_ID, new Hbar(-totalPullAmount))
                      .addHbarTransfer(userAccountId, new Hbar(totalPullAmount))
                      .setTransactionId(TransactionId.generate(KMS_ACCOUNT_ID))
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
                        transferSucceeded = true;
                        await updateIntentStatus("processing", txId, "Recovered from " + txErr.message, amountHbar);
                        send("STATUS:Transfer Verified (Recovered)");

                        await executeSwap(amountHbar, userAccountId, txId);
                        return;
                      }
                    }
                  }
                } catch (recoveryErr) {
                  // recovery failed
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
              let swapTxId = "";

              try {
                const estimatedOut = await getEstimatedAmountOut(client, amountHbar);
                if (estimatedOut === 0n) {
                  throw new Error("Cannot estimate swap output. Aborting to protect funds.");
                }

                // Get slippage from rules, default to 0.5%
                const slippagePercent = rules?.slippage_tolerance || 0.5;
                const slippageBps = BigInt(Math.floor(slippagePercent * 100));
                const amountOutMin = (estimatedOut * (10000n - slippageBps)) / 10000n;

                let to: string;
                try {
                  const accRes = await fetch(
                    `${MIRROR_NODE_API}/api/v1/accounts/${userAccountIdStr}`,
                    { signal: AbortSignal.timeout(5000) }
                  );
                  if (!accRes.ok) throw new Error("Mirror node account fetch failed");
                  const accData = await accRes.json();
                  const evmAddress = accData.evm_address as string | undefined;
                  if (!evmAddress || evmAddress.length < 40) throw new Error("No valid evm_address");
                  to = evmAddress.startsWith("0x") ? evmAddress : "0x" + evmAddress;
                } catch (addrErr: any) {
                  to = userAccountId.toSolidityAddress();
                }

                const deadline = Math.floor(Date.now() / 1000) + 1200;
                const path = [WHBAR_TOKEN_ID.toSolidityAddress(), USDC_TOKEN_ID.toSolidityAddress()];

                const swapTx = new ContractExecuteTransaction()
                  .setContractId(SAUCERSWAP_ROUTER_ID)
                  .setGas(2500000)
                  .setPayableAmount(amountHbar)
                  .setFunction("swapExactETHForTokens", new ContractFunctionParameters()
                    .addUint256(amountOutMin.toString())
                    .addAddressArray(path)
                    .addAddress(to)
                    .addUint256(deadline)
                  )
                  .setTransactionId(TransactionId.generate(KMS_ACCOUNT_ID))
                  // REMOVED setNodeAccountIds to let SDK automatically select best nodes
                  .freezeWith(client);

                swapTxId = swapTx.transactionId?.toString() || "";
                send("STATUS:Executing swap on-chain...");

                const signedSwapTx = await swapTx.signWithOperator(client);
                const swapResponse = await signedSwapTx.execute(client);

                try {
                  await swapResponse.getReceipt(client);
                } catch (receiptErr: any) {
                  if (
                    receiptErr.message?.includes("CONTRACT_REVERT") ||
                    receiptErr.message?.includes("INVALID") ||
                    receiptErr.message?.includes("INSUFFICIENT")
                  ) {
                    throw receiptErr;
                  }

                  send("STATUS:Verifying swap on-chain...");

                  const mirrorId = toMirrorNodeTransactionId(swapTxId);
                  let verified = false;
                  
                  // Poll more aggressively: check every 2s for up to 12 times (24s total)
                  // Start checking immediately
                  for (let i = 0; i < 12; i++) {
                    try {
                      const check = await fetch(
                        `${MIRROR_NODE_API}/api/v1/transactions/${mirrorId}`,
                        { signal: AbortSignal.timeout(5000) }
                      );
                      if (check.ok) {
                        const { transactions } = await check.json();
                        if (transactions?.find((t: any) => t.result === "SUCCESS")) {
                          verified = true;
                          break;
                        }
                        if (transactions?.length > 0) {
                          throw new Error("SWAP_FAILED: " + transactions[0].result);
                        }
                      }
                    } catch (e: any) {
                      if (e.message?.startsWith("SWAP_FAILED")) throw e;
                    }
                    // Wait 2s before next check
                    await new Promise(r => setTimeout(r, 2000));
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
                if (swapCompleted) {
                  send("SUCCESS:" + txId);
                  return;
                }

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
                      swapErr.message = `CONTRACT_REVERT: ${reason}`;
                    }
                  } catch { /* ignore */ }
                }

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
                        swapCompleted = true;
                        await updateIntentStatus("completed", txId, "Swap SUCCESS (recovered from catch)", amountHbar);
                        send("SUCCESS:" + txId);
                        return;
                      }
                    }
                  } catch { /* ignore */ }
                }

                send("STATUS:Swap Failed. Refunding...");

                try {
                  const refundTx = new TransferTransaction()
                    .addHbarTransfer(KMS_ACCOUNT_ID, new Hbar(-totalPullAmount))
                    .addHbarTransfer(userAccountId, new Hbar(totalPullAmount))
                    .setTransactionId(TransactionId.generate(KMS_ACCOUNT_ID))
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
            let msg = error.message;
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

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
