const { ethers } = require("ethers");

const base64Key = "MFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAEcd8caZj1kKNTESh4jvYOQoJehjYROuxTfkhGtCRcTe9Laf0CrE9RdA8TwmRuSbUL8GhcVH/jySz+yhPcg3Y2+w==";
const rawBytes = Buffer.from(base64Key, 'base64');

// For SECP256K1, the raw key is usually the last 65 bytes (0x04 + X + Y)
// DER Header length varies but for P-256K1 it's usually 23 bytes or so.
// Let's inspect bytes to find 0x04.
// 0x30... (Sequence)
// ...
// 0x04 ... (Key)

// Find the index of the key start (0x04)
// Usually at offset 23 for this curve oid
const keyBytes = rawBytes.slice(rawBytes.length - 65);

console.log("Raw Key (Hex):", keyBytes.toString('hex'));

try {
    // Ethers v6
    const address = ethers.computeAddress("0x" + keyBytes.toString('hex'));
    console.log("Calculated EVM Address:", address);
} catch (e) {
    // Fallback for v5
    try {
        const address = ethers.utils.computeAddress("0x" + keyBytes.toString('hex'));
        console.log("Calculated EVM Address:", address);
    } catch (err) {
        console.error("Error computing address:", err);
    }
}
