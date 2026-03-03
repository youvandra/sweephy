import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import {
  Client, AccountId, TransferTransaction,
  Hbar, TransactionId, PublicKey,
  ContractExecuteTransaction, ContractFunctionParameters,
  ContractCallQuery,
  ContractId,
  TokenId,
} from "npm:@hashgraph/sdk@2.46.0";
import { KMSClient, GetPublicKeyCommand } from "npm:@aws-sdk/client-kms@3.437.0";
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
// SaucerSwap V1 Router V3
const SAUCERSWAP_ROUTER_ID = ContractId.fromString("0.0.3045981");
// WHBAR Token ID (Mainnet)
const WHBAR_TOKEN_ID = TokenId.fromString("0.0.1456986");
const USDC_TOKEN_ID = TokenId.fromString("0.0.456858");

// ✅ Cache di module level
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
  // ✅ FIX: Cek apakah messageHashBytes sudah berupa hash (32 bytes) atau raw bytes
  // Jika 32 bytes, asumsikan sudah di-hash oleh SDK. Jika tidak, hash manual.
  let digest: Uint8Array;
  if (messageHashBytes.length === 32) {
      console.log("Input is 32 bytes, assuming pre-hashed digest.");
      digest = messageHashBytes;
  } else {
      console.log("Input is not 32 bytes, hashing with Keccak-256.");
      const digestHex = ethers.keccak256(messageHashBytes).replace("0x", "");
      digest = new Uint8Array(digestHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
  }
  
   const hashBase64 = btoa(String.fromCharCode(...digest));

  const payload = JSON.stringify({
    KeyId: keyId,
    Message: hashBase64,
    MessageType: "DIGEST",
    SigningAlgorithm: "ECDSA_SHA_256",
  });


  const host = `kms.${AWS_REGION}.amazonaws.com`;
  const contentType = "application/x-amz-json-1.1";
  const target = "TrentService.Sign";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:${target}\n`;
  const signedHeaders = "content-type;host;x-amz-date;x-amz-target";

  const payloadHash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload)))
  ).map((b) => b.toString(16).padStart(2, "0")).join("");

  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const credentialScope = `${dateStamp}/${AWS_REGION}/kms/aws4_request`;

  const crHash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalRequest)))
  ).map((b) => b.toString(16).padStart(2, "0")).join("");

  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${crHash}`;

  const hmac = async (key: Uint8Array, data: string) => {
    const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)));
  };

  const kSecret = new TextEncoder().encode("AWS4" + AWS_SECRET_ACCESS_KEY);
  const kSigning = await hmac(await hmac(await hmac(await hmac(kSecret, dateStamp), AWS_REGION), "kms"), "aws4_request");
  const sigHex = Array.from(await hmac(kSigning, stringToSign)).map((b) => b.toString(16).padStart(2, "0")).join("");

  const res = await fetch(`https://${host}/`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "X-Amz-Date": amzDate,
      "X-Amz-Target": target,
      "Authorization": `AWS4-HMAC-SHA256 Credential=${AWS_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${sigHex}`,
    },
    body: payload,
  });

  if (!res.ok) throw new Error(`KMS Sign failed: ${await res.text()}`);

  const { Signature } = await res.json();
  
  const der = Uint8Array.from(atob(Signature), (c) => c.charCodeAt(0));
  
  const { r, s } = derToRaw(der);
  
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
  
  // DER SubjectPublicKeyInfo untuk secp256k1 selalu 88 bytes
  if (derBytes.length !== 88) throw new Error(`Unexpected DER length: ${derBytes.length}`);
  if (derBytes[23] !== 0x04) throw new Error(`Expected 0x04 at index 23, got: ${derBytes[23]}`);

  const x = derBytes.slice(24, 56);  // 32 bytes X
  const y = derBytes.slice(56, 88);  // 32 bytes Y

  // Compress: 02 jika Y even, 03 jika Y odd
  const prefix = (y[31] & 1) === 0 ? 0x02 : 0x03;
  const compressed = new Uint8Array(33);
  compressed[0] = prefix;
  compressed.set(x, 1);

  cachedPublicKey = PublicKey.fromBytesECDSA(compressed);
  return cachedPublicKey;
}

// ✅ Resolve EVM address -> Hedera Account ID
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

// ✅ Verify allowance via mirror node with pagination
async function verifyAllowance(ownerAccountId: string, spenderAccountId: string): Promise<number> {
  let nextLink: string | null = `/api/v1/accounts/${ownerAccountId}/allowances/crypto`;
  
  while (nextLink) {
    const res = await fetch(
      `${MIRROR_NODE_API}${nextLink}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) {
      console.warn("Cannot check allowance:", res.status);
      return -1; // Unknown
    }

    const data = await res.json();
    const allowances: any[] = data.allowances || [];

    const match = allowances.find(
      (a: any) => a.spender === spenderAccountId
    );

    if (match) {
        const tinybars = Number(match.amount);
        return tinybars;
    }
    
    // Check for next page
    nextLink = data.links?.next || null;
  }

  console.warn("No allowance found for spender:", spenderAccountId);
  return 0;
}

async function debugKmsKeyInfo(): Promise<void> {
  const kms = new KMSClient({
    region: AWS_REGION,
    credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
  });
  const { PublicKey: pubKeyBytes, KeySpec, SigningAlgorithms } = await kms.send(
    new GetPublicKeyCommand({ KeyId: AWS_KMS_KEY_ID })
  );
}

async function getEstimatedAmountOut(client: Client, amountHbar: number): Promise<bigint> {
  try {
    const amountTinybars = BigInt(Math.floor(amountHbar * 1e8));
    const amountTinybarsStr = amountTinybars.toString();
    const path = [WHBAR_TOKEN_ID.toSolidityAddress(), USDC_TOKEN_ID.toSolidityAddress()];

    // Function: getAmountsOut(uint amountIn, address[] path) returns (uint[] amounts)
    const query = new ContractCallQuery()
      .setContractId(SAUCERSWAP_ROUTER_ID)
      .setGas(100000) 
      .setFunction("getAmountsOut", new ContractFunctionParameters()
        .addUint256(amountTinybarsStr)
        .addAddressArray(path)
      );

    const result = await query.execute(client);
    
    // Decode result using ethers since Hedera SDK result handling for dynamic arrays can be tricky
    // The result from execute() returns a ContractFunctionResult
    // We can get the raw bytes
    const resultBytes = result.asBytes();
    
    // Create Interface to decode
    const abi = ["function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)"];
    const iface = new ethers.Interface(abi);
    
    // ContractFunctionResult.asBytes() returns the raw bytes returned by the contract function
    // However, ContractCallQuery result handling might need to be checked.
    // Let's assume asBytes() gives us the encoded return data.
    // If it fails, we might need to rely on the fact that result.getUint256(1) works if it flattens the array?
    // But standard is dynamic array.
    
    // Let's use a safer approach with the SDK if possible, but ethers decoding is standard.
    // Wait, ContractCallQuery might return the values directly accessible.
    // But dynamic arrays are usually not directly accessible via simple getters like getUint256(i) easily without knowing structure.
    // Let's try decoding the bytes.
    
    // Note: The SDK's asBytes() returns the raw bytes of the result.
    // But we need to be careful if it includes function selector or just return data.
    // Usually just return data.
    
    // ✅ FIX: Jika decode gagal atau result 0, throw error agar tidak lanjut swap dengan 0 amountOutMin
    let amountOut = 0n;
    try {
        const decoded = iface.decodeFunctionResult("getAmountsOut", resultBytes);
        // decoded[0] is the array of amounts [amountIn, amountOut]
        const amounts = decoded[0];
        amountOut = BigInt(amounts[1]); // The second element is the output amount
    } catch (decodeErr) {
        console.warn("Decode failed with asBytes(), trying direct access (if supported) or failing.", decodeErr);
        throw new Error("Failed to decode getAmountsOut result");
    }
    
    if (amountOut === 0n) {
        throw new Error("Estimated amount out is 0");
    }
    
    return amountOut;
  } catch (e) {
    console.error("Failed to estimate amount out:", e);
    throw e; // Rethrow to handle in caller
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" },
    });
  }

  // ✅ supabase dibuat di sini, lalu dipass ke helper
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ✅ logIntent sebagai closure - bisa akses supabase
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
      
      // ✅ FIX: Declare intentId outside to be accessible in catch
      let intentId: string | null = null;
      // ✅ Helper to update status (declared here to capture intentId)
      const updateIntentStatus = async (status: string, txId: string, note: string, amount?: number) => {
        if (!intentId) return;
        await supabase.from("intents").update({ 
            status, 
            tx_id: txId || "failed",
            amount: amount || 0 
        }).eq("id", intentId);
        
        await supabase.from("intent_logs").insert({
            intent_id: intentId,
            tx_hash: txId || "failed",
            signed_by: KMS_ACCOUNT_ID.toString(),
            details: { status, note },
        });
      };

      const stream = new ReadableStream({
        async start(controller) {
          const send = (msg: string) => {
            try {
              controller.enqueue(encoder.encode(msg + "\n"));
            } catch (e) { console.warn("Stream closed?", e); }
          };

          try {
            send("STATUS:Verifying Device...");
            
            // ✅ Idempotency Check (Prevent Double Processing)
            // Check if there's a recent intent from this device within the last 60 seconds (increased from 15s)
            // that is either processing or successful.
            const { data: recentIntent } = await supabase
              .from("intents")
              .select("created_at, status")
              .eq("device_id", device_id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (recentIntent) {
              const timeDiff = Date.now() - new Date(recentIntent.created_at).getTime();
              // ✅ FIX: Increased idempotency window to 60s
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
              amount: 0, // Will update later
              status: "processing", 
              tx_id: "pending",
            }).select().single();

            if (intentError || !newIntent) {
               console.error("DB Error:", intentError);
               throw new Error("DB Error: Failed to init intent");
            }
            intentId = newIntent.id;

            // await debugKmsKeyInfo(); // ✅ FIX: Removed debug call
            
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
            
            // Update amount in DB
            await supabase.from("intents").update({ amount: amountHbar }).eq("id", intentId);

            // 2. Verify allowance on-chain
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
            // ✅ FIX: Increase max attempts to handle transient gRPC/network errors (e.g. UNAVAILABLE, Write error)
            client.setMaxAttempts(10); 
            client.setRequestTimeout(60000); // ✅ FIX: 60s timeout to allow full execution without client-side timeout.

            const publicKey = await getKmsPublicKey();
            client.setOperatorWith(KMS_ACCOUNT_ID, publicKey, (msg) => awsSign(msg, AWS_KMS_KEY_ID));

            const userAccountId = AccountId.fromString(userAccountIdStr);
            let transferSucceeded = false;
            let swapCompleted = false;

            // 4. Build & execute transfer
            send("STATUS:Transferring HBAR...");
            const transferTx = new TransferTransaction()
              .addApprovedHbarTransfer(userAccountId, new Hbar(-amountHbar))
              .addHbarTransfer(KMS_ACCOUNT_ID, new Hbar(amountHbar))
              .setTransactionId(TransactionId.generate(KMS_ACCOUNT_ID))
              .setMaxTransactionFee(new Hbar(2))
              .setNodeAccountIds([                  
                  new AccountId(3),
                  new AccountId(4),
                  new AccountId(5),
                  new AccountId(6),
                ])
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

              // Proceed to Swap
              try {
                await executeSwap(amountHbar, userAccountId, txId);
              } catch (postTransferErr: any) {
                if (transferSucceeded && !swapCompleted) {
                  try {
                    const refundTx = new TransferTransaction()
                      .addHbarTransfer(KMS_ACCOUNT_ID, new Hbar(-amountHbar))
                      .addHbarTransfer(userAccountId, new Hbar(amountHbar))
                      .setTransactionId(TransactionId.generate(KMS_ACCOUNT_ID))
                      .setNodeAccountIds([                  
                          new AccountId(3),
                          new AccountId(4),
                          new AccountId(5),
                          new AccountId(6),
                        ])
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

              // Timeout / Unknown Error Recovery
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

              // Allowance errors
              if (txErr.message?.includes("SPENDER_DOES_NOT_HAVE_ALLOWANCE") ||
                  txErr.message?.includes("AMOUNT_EXCEEDS_ALLOWANCE")) {
                await updateIntentStatus("failed", "failed", txErr.message);
                throw new Error("ALLOWANCE ERR");
              }

              await updateIntentStatus("failed", "failed", txErr.message);
              throw new Error(txErr.message);
            }

            // --- Helper Function for Swap Logic ---
            async function executeSwap(amountHbar: number, userAccountId: AccountId, txId: string) {
              // 5. Execute Swap (HBAR -> USDC)
              send("STATUS:Swapping HBAR->USDC");
              try {
                // ✅ FIX: Calculate Slippage
                const estimatedOut = await getEstimatedAmountOut(client, amountHbar);
                // Apply 2% slippage tolerance (multiply by 0.98)
                const amountOutMin = (estimatedOut * 98n) / 100n;
                
                // ✅ FIX: Use toSolidityAddress() only for EVM compatible addresses, but for AccountId, 
                // SaucerSwap might expect the AccountId directly if it's not an EVM alias.
                // However, swapExactETHForTokens expects `address to`.
                // If userAccountId is 0.0.x, toSolidityAddress() returns the hex format of that ID.
                // If it's an alias (EVM addr), it returns that.
                
                // If the error is INVALID_ALIAS_KEY, it might be because we are sending funds TO an account
                // that doesn't have an alias set, or using an alias that doesn't map correctly?
                // Actually, INVALID_ALIAS_KEY often happens when transfer/crypto operations involve an account
                // that is being auto-created or referenced via alias incorrectly.
                
                // But here we are calling a contract.
                // Let's ensure 'to' is the solidity address of the user.
                const to = userAccountId.toSolidityAddress();
                
                // Jika error INVALID_ALIAS_KEY terjadi saat refund, itu karena kita mencoba transfer HBAR ke
                // userAccountId yang mungkin dianggap alias key yang tidak valid oleh network jika belum "ter-hydrate"
                // atau jika SDK salah format.
                
                const deadline = Math.floor(Date.now() / 1000) + 1200; 

                const path = [WHBAR_TOKEN_ID.toSolidityAddress(), USDC_TOKEN_ID.toSolidityAddress()];
                
                const swapTx = new ContractExecuteTransaction()
                  .setContractId(SAUCERSWAP_ROUTER_ID)
                  .setGas(2500000) // ✅ FIX: Increase Gas Limit to avoid CONTRACT_REVERT_EXECUTED (out of gas)
                  .setPayableAmount(amountHbar)
                  .setFunction("swapExactETHForTokens", new ContractFunctionParameters()
                    .addUint256(amountOutMin.toString()) // ✅ FIX: Use calculated amountOutMin as String
                    .addAddressArray(path)
                    .addAddress(to)
                    .addUint256(deadline)
                  )
                  .setTransactionId(TransactionId.generate(KMS_ACCOUNT_ID))
                  .freezeWith(client);

                const signedSwapTx = await swapTx.signWithOperator(client);
                const swapReceipt = await (await signedSwapTx.execute(client)).getReceipt(client);
                
                swapCompleted = true;
                
                // 6. Transfer USDC to User (Implicit in Swap)
                send("STATUS:Transferring USDC...");
                // ✅ FIX: Log amount details
                await updateIntentStatus("completed", txId, `Swap & Transfer Complete. Est: ${estimatedOut}, Min: ${amountOutMin}`, amountHbar);
                
                send("SUCCESS:" + txId);

              } catch (swapErr: any) {
                console.error("Swap Error:", swapErr.message);
                
                // 🚨 REFUND LOGIC
                send("STATUS:Swap Failed. Refunding...");
                
                try {
                    const refundTx = new TransferTransaction()
                      .addHbarTransfer(KMS_ACCOUNT_ID, new Hbar(-amountHbar))
                      .addHbarTransfer(userAccountId, new Hbar(amountHbar))
                      .setTransactionId(TransactionId.generate(KMS_ACCOUNT_ID))
                      .setNodeAccountIds([                  
                          new AccountId(3),
                          new AccountId(4),
                          new AccountId(5),
                          new AccountId(6),
                        ])
                      .freezeWith(client);
                      
                    const signedRefund = await refundTx.signWithOperator(client);
                    // ✅ FIX: Await receipt for refund
                    await (await signedRefund.execute(client)).getReceipt(client);
                    
                    await updateIntentStatus("failed", txId, `Swap Failed: ${swapErr.message}. REFUNDED.`, amountHbar);
                    send("ERROR:Swap Failed. HBAR Refunded.");
                } catch (refundErr: any) {
                    console.error("Refund Failed:", refundErr.message);
                    await updateIntentStatus("failed", txId, `Swap Failed & REFUND FAILED: ${refundErr.message}`, amountHbar);
                    send("ERROR:CRITICAL: Refund Failed. Contact Support.");
                }
              }
            }

          } catch (error: any) {
            console.error("Critical error:", error);
            let msg = error.message;
            if (msg.length > 50) msg = msg.substring(0, 50);
            
            // ✅ FIX: intentId is now accessible here if it was set
            if (intentId) {
                await updateIntentStatus("failed", "failed", `Critical Error: ${msg}`).catch(e => console.error("Failed to log critical error", e));
            }
            
            send("ERROR:" + msg);
          } finally {
            controller.close();
          }
        }
      });

      return new Response(stream, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });

  } catch (error: any) {
    console.error("Critical error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
