import { test } from "node:test";
import assert from "node:assert/strict";
import { exifDateTaken } from "./exif.ts";

/** Minimal big-endian JPEG: SOI, APP1/Exif with IFD0 → ExifIFD → DateTimeOriginal, then SOS. */
function jpegWithDate(date: string, little = false): ArrayBuffer {
  const str = date + "\0"; // 20 bytes
  const tiff: number[] = [];
  const p16 = (n: number) => (little ? tiff.push(n & 255, n >> 8) : tiff.push(n >> 8, n & 255));
  const p32 = (n: number) =>
    little ? tiff.push(n & 255, (n >> 8) & 255, (n >> 16) & 255, n >>> 24) : tiff.push(n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255);
  // header
  tiff.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]));
  p16(42);
  p32(8); // IFD0 at 8
  // IFD0: 1 entry → ExifIFD pointer
  p16(1);
  p16(0x8769); p16(4); p32(1); p32(26); // ExifIFD at 26
  p32(0);
  // ExifIFD at 26: 1 entry → DateTimeOriginal (ASCII, 20) at 44
  p16(1);
  p16(0x9003); p16(2); p32(20); p32(44);
  p32(0);
  for (const ch of str) tiff.push(ch.charCodeAt(0));

  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const bytes = [0xff, 0xd8, 0xff, 0xe1, (app1.length + 2) >> 8, (app1.length + 2) & 255, ...app1, 0xff, 0xda, 0, 2];
  return new Uint8Array(bytes).buffer;
}

test("reads DateTimeOriginal (big and little endian)", () => {
  assert.equal(exifDateTaken(jpegWithDate("2026:10:12 13:05:44")), "2026-10-12T13:05:44");
  assert.equal(exifDateTaken(jpegWithDate("2026:10:11 20:41:02", true)), "2026-10-11T20:41:02");
});

test("returns null for non-JPEG or no EXIF", () => {
  assert.equal(exifDateTaken(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer), null);
  assert.equal(exifDateTaken(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer), null);
  assert.equal(exifDateTaken(new Uint8Array([]).buffer), null);
});
