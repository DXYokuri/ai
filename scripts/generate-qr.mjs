import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const QRCode = require('../.tools/node/node_modules/npm/node_modules/qrcode-terminal/vendor/QRCode');
const QRErrorCorrectLevel = require(
  '../.tools/node/node_modules/npm/node_modules/qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel'
);
const { PNG } = require('C:/Users/23650/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs');

const targetUrl = process.argv[2] ?? 'https://future-ui-solar-system-atlas.vercel.app';
const outputPath = path.resolve(process.argv[3] ?? 'artifacts/future-ui-solar-system-atlas-qr.png');
const qr = new QRCode(-1, QRErrorCorrectLevel.H);
qr.addData(targetUrl);
qr.make();

const quietZone = 4;
const scale = 20;
const moduleCount = qr.getModuleCount();
const size = (moduleCount + quietZone * 2) * scale;
const png = new PNG({ width: size, height: size });

for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) {
    const moduleX = Math.floor(x / scale) - quietZone;
    const moduleY = Math.floor(y / scale) - quietZone;
    const dark =
      moduleX >= 0 &&
      moduleY >= 0 &&
      moduleX < moduleCount &&
      moduleY < moduleCount &&
      qr.isDark(moduleY, moduleX);
    const offset = (y * size + x) * 4;
    const channel = dark ? 0 : 255;
    png.data[offset] = channel;
    png.data[offset + 1] = channel;
    png.data[offset + 2] = channel;
    png.data[offset + 3] = 255;
  }
}

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, PNG.sync.write(png));
console.log(`QR code written to ${outputPath}`);
console.log(`Target: ${targetUrl}`);
