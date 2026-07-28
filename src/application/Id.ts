const BASE32_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ID_LENGTH = 26;

/**
 * Creates a 128-bit, URL-safe base32 ID. The entity type already exists in
 * `leif-type`, so the ID carries no prefix. Falls back to Math.random when
 * crypto.getRandomValues is unavailable.
 */
export function createLeifId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  let id = "";
  let bitBuffer = 0;
  let bitCount = 0;
  for (let index = 0; index < bytes.length && id.length < ID_LENGTH; index += 1) {
    bitBuffer = (bitBuffer << 8) | bytes[index];
    bitCount += 8;
    while (bitCount >= 5 && id.length < ID_LENGTH) {
      bitCount -= 5;
      id += BASE32_ALPHABET[(bitBuffer >> bitCount) & 31];
    }
  }
  return id;
}
