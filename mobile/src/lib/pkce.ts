import * as Crypto from "expo-crypto";

// PKCE (RFC 7636) for the Google sign-in handoff: the app keeps the verifier
// and sends only its S256 challenge, so a code caught by another app is
// useless without the verifier.

export function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export async function createPkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = toBase64Url(bytesToBase64(Crypto.getRandomBytes(32)));
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 });
  return { verifier, challenge: toBase64Url(digest) };
}
