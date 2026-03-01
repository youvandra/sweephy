// Follows Supabase Deno Edge Function patterns
// Use native Deno.serve (available in Supabase Edge Runtime)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { 
  Client, 
  AccountId, 
  PrivateKey, 
  Transaction, 
  TransferTransaction, 
  ContractExecuteTransaction, 
  ContractFunctionParameters, 
  Hbar, 
  TransactionId,
  PublicKey
} from "npm:@hashgraph/sdk@2.46.0";
import { KMSClient, GetPublicKeyCommand } from "npm:@aws-sdk/client-kms@3.437.0";

// --- Configuration ---
const getEnv = (key: string) => Deno.env.get(key) || "";

const SUPABASE_URL = getEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
const AWS_ACCESS_KEY_ID = getEnv("AWS_ACCESS_KEY_ID");
const AWS_SECRET_ACCESS_KEY = getEnv("AWS_SECRET_ACCESS_KEY");
const AWS_REGION = getEnv("AWS_REGION");
const AWS_KMS_KEY_ID = getEnv("AWS_KMS_KEY_ID");

// Hedera Config
const NETWORK = "mainnet"; // or 'testnet'
const MIRROR_NODE_API = "https://mainnet-public.mirrornode.hedera.com";

// KMS Account (Relayer)
const KMS_ACCOUNT_ID = AccountId.fromString("0.0.10304901"); 

// SaucerSwap V2 Router (Mainnet)
const ROUTER_ID = "0.0.3045981"; 
const WHBAR = "0.0.1456986"; 
const USDC = "0.0.456858"; 

const SECP256K1_N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");

// --- Helper: ASN.1 / DER Handling for KMS Signature ---
function derToRaw(der: Uint8Array): { r: Uint8Array, s: Uint8Array } {
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

  // Convert to BigInt to check s
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
  
  // Pad to 32 bytes
  const to32Bytes = (val: bigint) => {
    let hex = val.toString(16);
    if (hex.length % 2 !== 0) hex = "0" + hex;
    while (hex.length < 64) hex = "0" + hex;
    return new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  };

  return { r: to32Bytes(r), s: to32Bytes(s) };
}

// --- Helper: Manual AWS Signature V4 ---
async function awsSign(messageHashBytes: Uint8Array, keyId: string): Promise<Uint8Array> {
  console.log("Starting AWS KMS Sign with keyId:", keyId);
  
  const hashBase64 = btoa(String.fromCharCode(...messageHashBytes));
  
  const payload = JSON.stringify({
    KeyId: keyId,
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

  const { r, s } = derToRaw(signatureDer);
  // Concatenate r and s
  const signature = new Uint8Array(64);
  signature.set(r, 0);
  signature.set(s, 32);
  return signature;
}

// --- Helper: Get Public Key from KMS ---
async function getKmsPublicKey(keyId: string): Promise<PublicKey> {
  const client = new KMSClient({
      region: AWS_REGION,
      credentials: {
          accessKeyId: AWS_ACCESS_KEY_ID,
          secretAccessKey: AWS_SECRET_ACCESS_KEY
      }
  });
  
  const command = new GetPublicKeyCommand({ KeyId: keyId });
  const response = await client.send(command);
  
  if (!response.PublicKey) throw new Error("No public key returned from KMS");
  
  // KMS returns DER format. Hedera SDK can parse it.
  return PublicKey.fromBytes(response.PublicKey);
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
        console.log("Starting Swap Action via Hedera SDK...");
        if (!device.is_paired) throw new Error("Device not paired");
        
        const user = device.profiles;
        const rules = user.rules;
        if (!rules.allowance_granted) throw new Error("Allowance not granted by user");

        // Use Global Relayer Key
        const signerKeyId = AWS_KMS_KEY_ID;
        const signerAccountId = KMS_ACCOUNT_ID;

        // Create Client
        const client = Client.forMainnet();
        
        // 1. Fetch KMS Public Key
        const publicKey = await getKmsPublicKey(signerKeyId);
        
        // 2. Set Operator with Custom Signer
        client.setOperatorWith(signerAccountId, publicKey, async (message: Uint8Array) => {
            return await awsSign(message, signerKeyId);
        });

        // --- STEP 1: Pull HBAR from User (TransferTransaction) ---
        const amountHbar = 0.1; 
        const userAccountId = AccountId.fromString(user.hedera_account_id || "0.0.0"); 

        if (userAccountId.toString() === "0.0.0") throw new Error("User Hedera Account ID not found");

        console.log("Executing Pull Funds (TransferTransaction)...");
        try {
          const transferTx = await new TransferTransaction()
              .addApprovedHbarTransfer(userAccountId, new Hbar(-amountHbar))
              .addHbarTransfer(signerAccountId, new Hbar(amountHbar))
              .execute(client);
          
          // Wait for receipt to ensure funds are transferred
          await transferTx.getReceipt(client);
        } catch (err: any) {
           console.error("Pull Funds Failed:", err);
           // If unauthorized, it means allowance is missing or insufficient
           if (err.message && err.message.includes("SPENDER_DOES_NOT_HAVE_ALLOWANCE")) {
               return new Response(JSON.stringify({ error: "Allowance Required" }), { status: 401 });
           }
           throw err;
        }

        // --- STEP 2: Swap (ContractExecuteTransaction) ---
        
        // Helper to convert Hedera ID to EVM Address
        const toEvmAddress = (id: string) => {
             const parts = id.split(".");
             const num = BigInt(parts[2]).toString(16).padStart(40, "0");
             return "0x" + num;
        };

        const recipient = rules.target_wallet || user.wallet_address;
        // Ensure recipient is EVM address for Router call
        let recipientEvm = recipient;
        if (recipient.startsWith("0.0.")) {
            recipientEvm = toEvmAddress(recipient);
        }

        console.log("Executing Swap (ContractExecuteTransaction)...");
        const swapTx = await new ContractExecuteTransaction()
             .setContractId(ROUTER_ID)
             .setGas(1000000)
             .setPayableAmount(amountHbar)
             .setFunction("swapExactETHForTokens", 
                 new ContractFunctionParameters()
                 .addUint256(0) // amountOutMin
                 .addAddressArray([toEvmAddress(WHBAR), toEvmAddress(USDC)]) // path
                 .addAddress(recipientEvm) // to
                 .addUint256(Math.floor(Date.now() / 1000) + 1200) // deadline
             )
             .execute(client);
             
        const txIdStr = swapTx.transactionId.toString();

        // 3. Insert 'Pending' Intent
        const { data: intent, error: intentError } = await supabase.from("intents").insert({
            device_id,
            action: "swap",
            pair: "HBAR/USDC", 
            amount: 0.1,
            status: "pending",
            tx_id: txIdStr
        }).select().single();

        if (intentError) console.error("DB Insert Error:", intentError);

        await supabase.from("intent_logs").insert({
            intent_id: intent?.id,
            tx_hash: txIdStr,
            signed_by: signerAccountId.toString(),
            details: { 
                status: "broadcasted",
                note: "Executed via Hedera SDK with KMS"
            }
        });

        return new Response(JSON.stringify({ 
            status: "success", 
            txId: txIdStr 
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

