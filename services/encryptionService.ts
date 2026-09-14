
/**
 * Encryption Service
 * Implements AES-GCM 256-bit encryption (Military Grade)
 * for data persistence in the browser.
 */

const ENCRYPTION_KEY_NAME = 'almakhzoun_secure_key';

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const CHUNK_SIZE = 0x8000; // 32768
  for (let i = 0; i < len; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export class EncryptionService {
  private static cachedKey: CryptoKey | null = null;

  private static async getSecretKey(): Promise<CryptoKey> {
    if (this.cachedKey) return this.cachedKey;

    let rawKey = localStorage.getItem(ENCRYPTION_KEY_NAME);
    if (!rawKey) {
      // Generate a new key if not exists
      const key = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      const exported = await window.crypto.subtle.exportKey('jwk', key);
      localStorage.setItem(ENCRYPTION_KEY_NAME, JSON.stringify(exported));
      this.cachedKey = key;
      return key;
    }

    try {
      const key = await window.crypto.subtle.importKey(
        'jwk',
        JSON.parse(rawKey),
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      this.cachedKey = key;
      return key;
    } catch (err) {
      console.warn('Failed to import existing encryption key, regenerating:', err);
      const key = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      const exported = await window.crypto.subtle.exportKey('jwk', key);
      localStorage.setItem(ENCRYPTION_KEY_NAME, JSON.stringify(exported));
      this.cachedKey = key;
      return key;
    }
  }

  static async encrypt(data: string): Promise<string> {
    if (!data) return '';
    if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
      console.warn('Crypto APIs are not available in this environment. Running in clear persistence mode.');
      return data;
    }
    try {
      const key = await this.getSecretKey();
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(data);
      
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoded
      );

      const combined = new Uint8Array(iv.length + ciphertext.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(ciphertext), iv.length);

      return uint8ArrayToBase64(combined);
    } catch (error) {
      console.error('Encryption failed:', error);
      return data; // Fallback to raw data
    }
  }

  static async decrypt(encryptedData: string): Promise<string> {
    if (!encryptedData) return '';
    if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
      return encryptedData;
    }

    const trimmed = encryptedData.trim().replace(/^\uFEFF/, '');
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return encryptedData; // Fast path: raw unencrypted JSON
    }

    try {
      const key = await this.getSecretKey();
      const combined = base64ToUint8Array(trimmed);

      if (combined.length <= 12) {
        return encryptedData;
      }

      const iv = new Uint8Array(combined.buffer, combined.byteOffset, 12);
      const ciphertext = new Uint8Array(combined.buffer, combined.byteOffset + 12, combined.byteLength - 12);

      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        key,
        ciphertext as unknown as BufferSource
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.warn('Decryption skipped or failed (returning raw input):', error);
      return encryptedData;
    }
  }
}
