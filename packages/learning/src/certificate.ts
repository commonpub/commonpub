import type { CertificateData } from './types.js';

/** Generate a unique verification code */
export function generateVerificationCode(prefix = 'SNAP'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = randomHex(8);
  return `${prefix}-${timestamp}-${random}`;
}

/** Format certificate data for display */
export function formatCertificateData(
  pathTitle: string,
  earnerName: string,
  issuedAt: Date,
  verificationCode: string,
): CertificateData {
  return {
    pathTitle,
    earnerName,
    issuedAt,
    verificationCode,
    formattedDate: formatDate(issuedAt),
  };
}

/** Build a full verification URL */
export function buildVerificationUrl(baseUrl: string, code: string): string {
  const normalized = baseUrl.replace(/\/+$/, '');
  return `${normalized}/certificates/${code}`;
}

// --- Helpers ---

function randomHex(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, length);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
