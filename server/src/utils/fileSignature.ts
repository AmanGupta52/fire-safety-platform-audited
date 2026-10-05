/**
 * Identifies a file by its leading "magic bytes" instead of trusting the client-supplied Content-Type or file
 * name. Deliberately tiny and dependency-free: it only knows the five formats this app accepts.
 */
export interface DetectedFile {
  mime: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf';
  /** Extension to store the file under. Always derived from the content, never from the uploaded name. */
  ext: 'jpg' | 'png' | 'gif' | 'webp' | 'pdf';
}

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

export function detectFileType(buf: Buffer): DetectedFile | null {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: 'jpg' };
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: 'image/png', ext: 'png' };
  // "GIF87a" or "GIF89a"
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || startsWith(buf, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) {
    return { mime: 'image/gif', ext: 'gif' };
  }
  // "RIFF" .... "WEBP"
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  // "%PDF-" must be the very first bytes (no leading junk), which also blocks HTML/PDF polyglots.
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: 'application/pdf', ext: 'pdf' };
  return null;
}
