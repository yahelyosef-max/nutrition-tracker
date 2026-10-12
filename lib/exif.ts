/**
 * Read the "date taken" (EXIF DateTimeOriginal, falling back to DateTime) from a JPEG.
 * Returns "YYYY-MM-DDTHH:MM:SS" as written by the camera (local wall-clock time), or null.
 */
export function exifDateTaken(buf: ArrayBuffer): string | null {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null;

  let off = 2;
  while (off + 4 <= v.byteLength) {
    const marker = v.getUint16(off);
    if ((marker & 0xff00) !== 0xff00) return null;
    const size = v.getUint16(off + 2);
    if (marker === 0xffe1 && off + 10 <= v.byteLength && v.getUint32(off + 4) === 0x45786966) {
      return readTiff(v, off + 10, Math.min(v.byteLength, off + 2 + size));
    }
    if (marker === 0xffda) return null; // start of image data: no EXIF before it
    off += 2 + size;
  }
  return null;
}

function readTiff(v: DataView, start: number, end: number): string | null {
  if (start + 8 > end) return null;
  const little = v.getUint16(start) === 0x4949;
  const u16 = (o: number) => v.getUint16(o, little);
  const u32 = (o: number) => v.getUint32(o, little);

  const ifd = (at: number) => {
    const out = new Map<number, number>();
    if (at + 2 > end) return out;
    const n = u16(at);
    for (let i = 0; i < n; i++) {
      const e = at + 2 + i * 12;
      if (e + 12 > end) break;
      out.set(u16(e), e);
    }
    return out;
  };
  const ascii = (entry: number) => {
    const count = u32(entry + 4);
    const at = count > 4 ? start + u32(entry + 8) : entry + 8;
    if (at + count > end) return null;
    let s = "";
    for (let i = 0; i < count; i++) {
      const c = v.getUint8(at + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  };
  const parse = (s: string | null) => {
    const m = s?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : null;
  };

  const ifd0 = ifd(start + u32(start + 4));
  const exifPtr = ifd0.get(0x8769);
  if (exifPtr !== undefined) {
    const original = ifd(start + u32(exifPtr + 8)).get(0x9003);
    if (original !== undefined) {
      const d = parse(ascii(original));
      if (d) return d;
    }
  }
  const dt = ifd0.get(0x0132);
  return dt !== undefined ? parse(ascii(dt)) : null;
}
