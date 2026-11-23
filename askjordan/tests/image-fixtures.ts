/** PNG chunks let tests retain valid pixels while exercising metadata size and animation rejection. */
export function pngChunk(kind: string, data: Buffer): Buffer {
  const typeAndData = Buffer.concat([Buffer.from(kind, "ascii"), data]);
  let crc = 0xffffffff;
  for (const byte of typeAndData) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, typeAndData, checksum]);
}
export function insertBeforePngEnd(png: Buffer, chunk: Buffer): Buffer {
  return Buffer.concat([png.subarray(0, -12), chunk, png.subarray(-12)]);
}
