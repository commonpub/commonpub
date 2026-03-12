import { generateKeyPair, exportSPKI, exportPKCS8, importSPKI } from 'jose';

export interface ActorKeypair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

/** Generate an RSA 2048 keypair for HTTP Signatures */
export async function generateKeypair(): Promise<ActorKeypair> {
  const { publicKey, privateKey } = await generateKeyPair('RS256', {
    modulusLength: 2048,
    extractable: true,
  });
  return { publicKey, privateKey };
}

/** Export public key as SPKI PEM */
export async function exportPublicKeyPem(keypair: ActorKeypair): Promise<string> {
  return exportSPKI(keypair.publicKey);
}

/** Export private key as PKCS8 PEM */
export async function exportPrivateKeyPem(keypair: ActorKeypair): Promise<string> {
  return exportPKCS8(keypair.privateKey);
}

/** Build the Key ID URI for an actor's public key */
export function buildKeyId(domain: string, username: string): string {
  return `https://${domain}/users/${username}#main-key`;
}

/** Verify an HTTP Signature on an incoming ActivityPub request.
 *  Returns true if the signature is valid, false otherwise.
 *  Returns false if no Signature header is present.
 */
export async function verifyHttpSignature(
  request: Request,
  publicKeyPem: string,
): Promise<boolean> {
  const signatureHeader = request.headers.get('signature');
  if (!signatureHeader) return false;

  try {
    // Parse the Signature header
    const parts: Record<string, string> = {};
    for (const part of signatureHeader.split(',')) {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) continue;
      const key = part.slice(0, eqIdx).trim();
      const value = part.slice(eqIdx + 1).trim().replace(/^"|"$/g, '');
      parts[key] = value;
    }

    const headers = (parts.headers ?? '(request-target) host date').split(' ');
    const signature = parts.signature;

    if (!signature) return false;

    const url = new URL(request.url);

    // Build the signing string
    const signingLines: string[] = [];
    for (const header of headers) {
      if (header === '(request-target)') {
        signingLines.push(`(request-target): ${request.method.toLowerCase()} ${url.pathname}`);
      } else if (header === 'host') {
        signingLines.push(`host: ${request.headers.get('host') ?? url.host}`);
      } else if (header === 'date') {
        signingLines.push(`date: ${request.headers.get('date') ?? ''}`);
      } else if (header === 'digest') {
        signingLines.push(`digest: ${request.headers.get('digest') ?? ''}`);
      } else {
        const val = request.headers.get(header);
        if (val !== null) {
          signingLines.push(`${header}: ${val}`);
        }
      }
    }

    const signingString = signingLines.join('\n');

    // Import the public key using jose
    const publicKey = await importSPKI(publicKeyPem, 'RS256');

    // Decode base64 signature
    const sigBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));

    // Encode signing string
    const encoder = new TextEncoder();
    const data = encoder.encode(signingString);

    // Verify using Web Crypto API
    return await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      publicKey as CryptoKey,
      sigBytes,
      data,
    );
  } catch {
    return false;
  }
}
