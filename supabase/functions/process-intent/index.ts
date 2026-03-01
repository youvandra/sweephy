// Follows Supabase Deno Edge Function patterns
// Use native Deno.serve (available in Supabase Edge Runtime)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { ethers } from "https://esm.sh/ethers@5.7.2?target=deno";

// --- Configuration ---
const getEnv = (key: string) => Deno.env.get(key) || "";

const SUPABASE_URL = getEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
const AWS_ACCESS_KEY_ID = getEnv("AWS_ACCESS_KEY_ID");
const AWS_SECRET_ACCESS_KEY = getEnv("AWS_SECRET_ACCESS_KEY");
const AWS_REGION = getEnv("AWS_REGION");
const AWS_KMS_KEY_ID = getEnv("AWS_KMS_KEY_ID");

// Hedera Hashio Mainnet JSON-RPC
const RPC_URL = "https://mainnet.hashio.io/api";
const CHAIN_ID = 295; // Hedera Mainnet
const SENDER_ADDRESS = "0x2fa7a293044E847E10815012C2963f2C172cD9CD"; 

const SECP256K1_N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");

// --- Helper: ASN.1 / DER Handling for KMS Signature ---
function derToRaw(der: Uint8Array): { r: string, s: string } {
  // Simple DER parser for ECDSA signature
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error("Invalid DER: Missing Sequence");
  
  let lenByte = der[offset++];
  if (lenByte & 0x80) offset += (lenByte & 0x7f);

  if (der[offset++] !== 0x02) throw new Error("Invalid DER: Missing Integer R");
  let rLen = der[offset++];
  let rBytes = der.slice(offset, offset + rLen);
  offset += rLen;

  if (der[offset++] !== 0x02) throw new Error("Invalid DER: Missing Integer S");
  let sLen = der[offset++];
  let sBytes = der.slice(offset, offset + sLen);

  // Convert to BigInt
  const toBigInt = (arr: Uint8Array) => {
    let hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    return BigInt("0x" + hex);
  };

  let r = toBigInt(rBytes);
  let s = toBigInt(sBytes);

  // EIP-2 Malleability check: s must be <= N/2
  if (s > SECP256K1_N / 2n) {
      console.log("Flipping S value for EIP-2 compliance");
      s = SECP256K1_N - s;
  }

  const toHex = (val: bigint) => {
    let hex = val.toString(16);
    if (hex.length % 2 !== 0) hex = "0" + hex;
    // Pad to 32 bytes (64 hex chars)
    while (hex.length < 64) hex = "0" + hex;
    return "0x" + hex;
  };

  return { r: toHex(r), s: toHex(s) };
}

// --- Helper: Manual AWS Signature V4 ---
async function awsSign(messageHashBytes: Uint8Array): Promise<{ r: string, s: string }> {
  console.log("Starting AWS KMS Sign...");
  
  const hashBase64 = btoa(String.fromCharCode(...messageHashBytes));
  
  const payload = JSON.stringify({
    KeyId: AWS_KMS_KEY_ID,
    Message: hashBase64,
    MessageType: "DIGEST",
    SigningAlgorithm: "ECDSA_SHA_256"
  });

  const method = "POST";
  const service = "kms";
  const host = `kms.${AWS_REGION}.amazonaws.com`;
  const endpoint = `https://${host}/`;
  const contentType = "application/x-amz-json-1.1";
  const target = "TrentService.Sign";
  
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:${target}\n`;
  const signedHeaders = "content-type;host;x-amz-date;x-amz-target";
  
  const payloadHashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  const payloadHashHex = Array.from(new Uint8Array(payloadHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  const canonicalRequest = `${method}\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHashHex}`;

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${AWS_REGION}/${service}/aws4_request`;
  
  const canonicalRequestHashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalRequest));
  const canonicalRequestHashHex = Array.from(new Uint8Array(canonicalRequestHashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${canonicalRequestHashHex}`;

  const hmac = async (key: Uint8Array, data: string) => {
    const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data)));
  };

  const kSecret = new TextEncoder().encode("AWS4" + AWS_SECRET_ACCESS_KEY);
  const kDate = await hmac(kSecret, dateStamp);
  const kRegion = await hmac(kDate, AWS_REGION);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  
  const signatureBuffer = await hmac(kSigning, stringToSign);
  const signatureHex = Array.from(signatureBuffer).map(b => b.toString(16).padStart(2, '0')).join('');

  const authHeader = `${algorithm} Credential=${AWS_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "X-Amz-Date": amzDate,
      "X-Amz-Target": target,
      "Authorization": authHeader
    },
    body: payload
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AWS KMS Error Response:", errorText);
    throw new Error(`AWS KMS Call Failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const responseData = await response.json();
  const signatureBase64 = responseData.Signature;
  const signatureDerString = atob(signatureBase64);
  const signatureDer = new Uint8Array(signatureDerString.length);
  for (let i = 0; i < signatureDerString.length; i++) {
    signatureDer[i] = signatureDerString.charCodeAt(i);
  }

  return derToRaw(signatureDer);
}

// --- Main Handler ---
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
  }

  try {
    console.log("Processing Request...");
    
    if (!SUPABASE_URL || !AWS_ACCESS_KEY_ID || !AWS_KMS_KEY_ID) {
      throw new Error("Missing Server Configuration (Env Vars)");
    }

    const bodyText = await req.text();
    let device_id, payload;
    try {
        const body = JSON.parse(bodyText);
        device_id = body.device_id;
        payload = body.payload;
    } catch (e) {
        throw new Error("Invalid JSON body");
    }

    if (!device_id || !payload) {
      throw new Error("Missing required fields: device_id, payload");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: device, error: deviceError } = await supabase
      .from("devices")
      .select("*, profiles(*, rules(*)), pairing_codes(*)")
      .eq("id", device_id)
      .single();

    if (deviceError || !device) {
      return new Response(JSON.stringify({ error: "Device not found" }), { status: 404 });
    }

    const data = JSON.parse(payload);
    const { action, pairing_code } = data;

    // Heartbeat
    await supabase.from("devices").update({ last_seen: new Date().toISOString(), status: "online" }).eq("id", device_id);

    if (action === "pair") {
        if (!pairing_code) throw new Error("Pairing code required");
        const { data: code } = await supabase.from("pairing_codes").select("*").eq("device_id", device_id).eq("code", pairing_code).single();
        if (!code || code.used) throw new Error("Invalid or used pairing code");
        
        await supabase.from("pairing_codes").update({ used: true }).eq("id", code.id);
        await supabase.from("devices").update({ is_paired: true }).eq("id", device_id);
        
        return new Response(JSON.stringify({ status: "success", message: "Paired successfully" }), { headers: { "Content-Type": "application/json" } });
    }

    if (action === "swap") {
        console.log("Starting Swap Action via JSON-RPC...");
        if (!device.is_paired) throw new Error("Device not paired");
        
        const user = device.profiles;
        const rules = user.rules;
        if (!rules.allowance_granted) throw new Error("Allowance not granted by user");

        // 1. Initialize Provider (Ethers v5)
        const provider = new ethers.providers.JsonRpcProvider(RPC_URL, CHAIN_ID);
        
        // 2. Prepare Transaction (SaucerSwap V2)
        const nonce = await provider.getTransactionCount(SENDER_ADDRESS);
        const feeData = await provider.getFeeData();

        // SaucerSwap V2 Router
        const ROUTER_ADDRESS = "0x00000000000000000000000000000000002e7b1d"; // 0.0.3045981
        const WHBAR = "0x0000000000000000000000000000000000163b5a"; // 0.0.1456986
        const USDC = "0x000000000000000000000000000000000006f89a";  // 0.0.456858
        
        // Target: User's Wallet (or Rule target)
        // Convert Hedera ID "0.0.x" to EVM Address if needed, or use existing if 0x
        let recipient = rules.target_wallet || SENDER_ADDRESS; // Default to self if not set
        if (recipient.startsWith("0.0.")) {
            // Simple conversion for now (only works if alias set, but let's try direct Solidity address)
            const parts = recipient.split(".");
            const num = BigInt(parts[2]).toString(16).padStart(40, "0");
            recipient = "0x" + num;
        }

        const amountIn = ethers.utils.parseEther("0.1"); // Swap 0.1 HBAR (Small test amount)
        const amountOutMin = 0; // Slippage 100% for test (Use with caution in prod)
        const path = [WHBAR, USDC];
        const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 mins

        // Encode Function Data
        const iface = new ethers.utils.Interface([
            "function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) external payable returns (uint[] amounts)"
        ]);
        const data = iface.encodeFunctionData("swapExactETHForTokens", [
            amountOutMin,
            path,
            recipient,
            deadline
        ]);

        const tx = {
            to: ROUTER_ADDRESS,
            value: amountIn,
            chainId: CHAIN_ID,
            nonce: nonce,
            gasLimit: ethers.BigNumber.from("1000000"), // 1M Gas for Swap
            gasPrice: feeData.gasPrice,
            data: data,
            type: 0 // Legacy
        };

        // 3. Insert 'Pending' Intent
        const { data: intent, error: intentError } = await supabase.from("intents").insert({
            device_id,
            action: "swap",
            status: "pending",
            details: { type: "saucerswap_v2", path: "HBAR->USDC" }
        }).select().single();

        if (intentError) console.error("DB Insert Error:", intentError);

        // 4. Hash Transaction
        const unsignedSerialized = ethers.utils.serializeTransaction(tx);
        const msgHash = ethers.utils.keccak256(unsignedSerialized);
        const msgHashBytes = ethers.utils.arrayify(msgHash);

        // 5. Sign with KMS
        const { r, s } = await awsSign(msgHashBytes);

        // 6. Determine v
        let signature;
        const v0 = CHAIN_ID * 2 + 35 + 0;
        const sig0 = { r: r, s: s, v: v0 };
        const recovered0 = ethers.utils.recoverAddress(msgHash, sig0);
        
        if (recovered0.toLowerCase() === SENDER_ADDRESS.toLowerCase()) {
            signature = sig0;
        } else {
             const v1 = CHAIN_ID * 2 + 35 + 1;
             const sig1 = { r: r, s: s, v: v1 };
             const recovered1 = ethers.utils.recoverAddress(msgHash, sig1);
             if (recovered1.toLowerCase() === SENDER_ADDRESS.toLowerCase()) {
                 signature = sig1;
             } else {
                 throw new Error("Failed to recover correct address from KMS signature");
             }
        }

        // 7. Serialize Signed Transaction
        const signedSerialized = ethers.utils.serializeTransaction(tx, signature);

        console.log("Broadcasting Swap Transaction...");
        const txResponse = await provider.sendTransaction(signedSerialized);
        console.log("Transaction Hash:", txResponse.hash);

        // 8. Wait for Receipt (Blocking)
        console.log("Waiting for confirmation...");
        const receipt = await txResponse.wait(1); // Wait for 1 confirmation
        console.log("Transaction Status:", receipt.status); // 1 = Success, 0 = Revert

        const finalStatus = receipt.status === 1 ? "completed" : "failed"; // Use 'completed' instead of 'success'

        // 9. Update Intent & Log
        if (intent) {
            await supabase.from("intents").update({
                status: finalStatus,
                tx_id: txResponse.hash
            }).eq("id", intent.id);

            await supabase.from("intent_logs").insert({
                intent_id: intent.id,
                tx_hash: txResponse.hash,
                signed_by: SENDER_ADDRESS,
                details: { 
                    gasUsed: receipt.gasUsed.toString(), 
                    blockNumber: receipt.blockNumber,
                    status: finalStatus
                }
            });
        }

        if (finalStatus === "failed") {
             return new Response(JSON.stringify({ 
                error: "Transaction Reverted On-Chain", 
                txId: txResponse.hash 
            }), { status: 500, headers: { "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({ 
            status: "success", 
            txId: txResponse.hash 
        }), { headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });

  } catch (error) {
    console.error("Critical Error in process-intent:", error);
    return new Response(JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined
    }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
    });
  }
});
