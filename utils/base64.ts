/** Bytes ↔ base64, for files written through Android's folder access (it takes base64). */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const LUT = (() => { const l = new Uint8Array(256); for (let i = 0; i < B64.length; i++) l[B64.charCodeAt(i)] = i; return l })()

export function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = []
  const CHUNK = 0x6000   // a multiple of 3: chunks join without padding in between
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const end = Math.min(bytes.length, i + CHUNK)
    let s = ''
    for (let j = i; j < end; j += 3) {
      const a = bytes[j], b = j + 1 < end ? bytes[j + 1] : 0, c = j + 2 < end ? bytes[j + 2] : 0
      const n = (a << 16) | (b << 8) | c
      s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (j + 1 < end ? B64[(n >> 6) & 63] : '=') + (j + 2 < end ? B64[n & 63] : '=')
    }
    parts.push(s)
  }
  return parts.join('')
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '')
  const n = Math.floor((clean.length * 3) / 4)
  const out = new Uint8Array(n)
  let o = 0
  for (let i = 0; i < clean.length; i += 4) {
    const a = LUT[clean.charCodeAt(i)], b = LUT[clean.charCodeAt(i + 1)]
    const c = i + 2 < clean.length ? LUT[clean.charCodeAt(i + 2)] : 0
    const d = i + 3 < clean.length ? LUT[clean.charCodeAt(i + 3)] : 0
    const v = (a << 18) | (b << 12) | (c << 6) | d
    if (o < n) out[o++] = (v >> 16) & 255
    if (o < n && i + 2 < clean.length) out[o++] = (v >> 8) & 255
    if (o < n && i + 3 < clean.length) out[o++] = v & 255
  }
  return out.subarray(0, o)
}
