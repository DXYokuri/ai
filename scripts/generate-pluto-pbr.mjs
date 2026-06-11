import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sourcePath = path.resolve('public/textures/pluto/pluto-source-new-horizons.jpg');
const outputDir = path.resolve('public/textures/pluto');
const sourceData = await readFile(sourcePath);
const sourceUrl = `data:image/jpeg;base64,${sourceData.toString('base64')}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await mkdir(outputDir, { recursive: true });
await page.setContent(`<img id="source" src="${sourceUrl}" alt="">`);
await page.locator('#source').evaluate((image) => image.decode());

await page.evaluate(() => {
  const width = 8192;
  const height = 4096;
  const source = document.querySelector('#source');
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const colorContext = colorCanvas.getContext('2d', { willReadFrequently: true });
  colorContext.imageSmoothingEnabled = true;
  colorContext.imageSmoothingQuality = 'high';
  colorContext.drawImage(source, 0, 0, width, height);
  window.plutoPbr = { colorCanvas, colorContext, height, width };
});

async function saveCanvas(fileName, type, quality) {
  const dataUrl = await page.evaluate(
    ({ outputType, outputQuality }) => window.plutoPbr.colorCanvas.toDataURL(outputType, outputQuality),
    { outputType: type, outputQuality: quality }
  );
  await writeFile(path.join(outputDir, fileName), Buffer.from(dataUrl.split(',')[1], 'base64'));
}

await saveCanvas('pluto-color-8k.jpg', 'image/jpeg', 0.94);

const normalDataUrl = await page.evaluate(() => {
  const { colorCanvas, colorContext, height, width } = window.plutoPbr;
  const source = colorContext.getImageData(0, 0, width, height);
  const output = colorContext.createImageData(width, height);
  const luma = new Float32Array(width * height);

  for (let pixel = 0; pixel < luma.length; pixel += 1) {
    const offset = pixel * 4;
    luma[pixel] = source.data[offset] * 0.2126 + source.data[offset + 1] * 0.7152 + source.data[offset + 2] * 0.0722;
  }

  for (let y = 0; y < height; y += 1) {
    const up = Math.max(0, y - 2);
    const down = Math.min(height - 1, y + 2);
    for (let x = 0; x < width; x += 1) {
      const left = (x - 2 + width) % width;
      const right = (x + 2) % width;
      const dx = (luma[y * width + right] - luma[y * width + left]) / 255;
      const dy = (luma[down * width + x] - luma[up * width + x]) / 255;
      const length = Math.hypot(dx * 2.2, dy * 2.2, 1);
      const offset = (y * width + x) * 4;
      output.data[offset] = Math.round(((-dx * 2.2) / length * 0.5 + 0.5) * 255);
      output.data[offset + 1] = Math.round(((dy * 2.2) / length * 0.5 + 0.5) * 255);
      output.data[offset + 2] = Math.round((1 / length * 0.5 + 0.5) * 255);
      output.data[offset + 3] = 255;
    }
  }

  colorContext.putImageData(output, 0, 0);
  return colorCanvas.toDataURL('image/jpeg', 0.9);
});
await writeFile(path.join(outputDir, 'pluto-normal-8k.jpg'), Buffer.from(normalDataUrl.split(',')[1], 'base64'));

const roughnessDataUrl = await page.evaluate(() => {
  const { colorCanvas, colorContext, height, width } = window.plutoPbr;
  const source = colorContext.getImageData(0, 0, width, height);
  const output = colorContext.createImageData(width, height);

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 4;
    const normalVariation = Math.abs(source.data[offset] - 128) + Math.abs(source.data[offset + 1] - 128);
    const roughness = Math.max(112, Math.min(244, 206 - normalVariation * 0.42));
    output.data[offset] = roughness;
    output.data[offset + 1] = roughness;
    output.data[offset + 2] = roughness;
    output.data[offset + 3] = 255;
  }

  colorContext.putImageData(output, 0, 0);
  return colorCanvas.toDataURL('image/jpeg', 0.86);
});
await writeFile(path.join(outputDir, 'pluto-roughness-8k.jpg'), Buffer.from(roughnessDataUrl.split(',')[1], 'base64'));

await browser.close();
