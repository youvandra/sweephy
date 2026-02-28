import { KMSClient, SignCommand } from "@aws-sdk/client-kms";
import { 
  TransferTransaction, 
  AccountId, 
  Hbar, 
  Client,
  TransactionId,
  Timestamp,
  PublicKey
} from "@hashgraph/sdk";

/**
 * Signs a Hedera transaction using AWS KMS.
 * The KMS key must be an asymmetric ECC_NIST_P256 key.
 */
export async function signWithKMS(
  transaction: TransferTransaction,
  operatorId: string,
  kmsKeyId: string = process.env.AWS_KMS_KEY_ID!
) {
  const kmsClient = new KMSClient({ 
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
    }
  });

  // 1. Initialize Hedera client
  const hederaClient = Client.forTestnet(); // Use Testnet for development

  // 2. Freeze the transaction for signing
  transaction.freezeWith(hederaClient);

  // 3. Get the transaction bytes to sign
  const transactionBytes = transaction.toBytes();

  // 4. Call AWS KMS to sign the bytes
  const signCommand = new SignCommand({
    KeyId: kmsKeyId,
    Message: transactionBytes,
    MessageType: "RAW",
    SigningAlgorithm: "ECDSA_SHA_256"
  });

  const { Signature } = await kmsClient.send(signCommand);
  
  if (!Signature) {
    throw new Error("Failed to retrieve signature from AWS KMS");
  }

  // Note: In a real implementation, you would need the public key
  // associated with the KMS key to attach the signature correctly to Hedera.
  // transaction.addSignature(publicKey, Signature);
  
  return {
    signature: Buffer.from(Signature).toString('hex'),
    txId: transaction.transactionId?.toString()
  };
}
