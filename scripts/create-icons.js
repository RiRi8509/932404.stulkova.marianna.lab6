const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const outputDirectory = path.join(__dirname, '..', 'public', 'icons');

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const lengthBuffer = Buffer.alloc(4);
  const crcBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function createPng(size) {
  const rowLength = size * 4 + 1;
  const raw = Buffer.alloc(rowLength * size);
  const center = size / 2;

  function setPixel(x, y, red, green, blue, alpha = 255) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const offset = y * rowLength + 1 + x * 4;
    raw[offset] = red;
    raw[offset + 1] = green;
    raw[offset + 2] = blue;
    raw[offset + 3] = alpha;
  }

  for (let y = 0; y < size; y += 1) {
    raw[y * rowLength] = 0;

    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - center, y - center) / (size * 0.72);
      const glow = Math.max(0, 1 - distance);
      const red = Math.round(5 + glow * 20);
      const green = Math.round(5 + glow * 20);
      const blue = Math.round(7 + glow * 22);
      setPixel(x, y, red, green, blue);
    }
  }

  const safeInset = Math.round(size * 0.12);
  const coinRadius = Math.round(size * 0.31);
  const ringWidth = Math.max(5, Math.round(size * 0.035));

  for (let y = safeInset; y < size - safeInset; y += 1) {
    for (let x = safeInset; x < size - safeInset; x += 1) {
      const distance = Math.hypot(x - center, y - center);

      if (distance <= coinRadius) {
        const chrome = Math.round(68 + (1 - distance / coinRadius) * 94);
        setPixel(x, y, chrome, chrome, chrome + 4);
      }

      if (distance <= coinRadius && distance >= coinRadius - ringWidth) {
        setPixel(x, y, 238, 241, 244);
      }
    }
  }

  const white = [8, 8, 10];
  const barWidth = Math.max(6, Math.round(size * 0.045));
  const barHeight = Math.round(size * 0.26);
  const gap = Math.round(size * 0.075);
  const startX = Math.round(center - gap - barWidth * 1.5);
  const baseY = Math.round(center + barHeight * 0.55);
  const heights = [0.52, 0.76, 1];

  heights.forEach((ratio, index) => {
    const height = Math.round(barHeight * ratio);
    const xStart = startX + index * (barWidth + gap);

    for (let y = baseY - height; y <= baseY; y += 1) {
      for (let x = xStart; x < xStart + barWidth; x += 1) {
        setPixel(x, y, ...white);
      }
    }
  });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    createChunk('IHDR', ihdr),
    createChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    createChunk('IEND', Buffer.alloc(0))
  ]);
}

fs.mkdirSync(outputDirectory, { recursive: true });

[192, 512].forEach((size) => {
  const filePath = path.join(outputDirectory, `icon-${size}.png`);
  fs.writeFileSync(filePath, createPng(size));
  console.log(`Создана иконка: ${filePath}`);
});
