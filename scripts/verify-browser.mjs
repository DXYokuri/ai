import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const { PNG } = require('C:/Users/23650/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs');

const appUrl = process.env.ATLAS_URL ?? 'http://127.0.0.1:5173/';
const edgePath = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const outputDir = '.tmp/browser';
let devServer;

async function waitForServer(url, timeoutMs = 15000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((resolve) => {
        setTimeout(resolve, 250);
      });
    }
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function analyzePng(buffer) {
  const png = PNG.sync.read(buffer);
  const buckets = new Set();
  let minLuma = 255;
  let maxLuma = 0;
  let nonFlatPixels = 0;

  for (let y = 0; y < png.height; y += 12) {
    for (let x = 0; x < png.width; x += 12) {
      const index = (png.width * y + x) << 2;
      const r = png.data[index];
      const g = png.data[index + 1];
      const b = png.data[index + 2];
      const a = png.data[index + 3];
      const luma = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

      if (a > 16) {
        minLuma = Math.min(minLuma, luma);
        maxLuma = Math.max(maxLuma, luma);
        buckets.add(`${r >> 4}-${g >> 4}-${b >> 4}`);

        if (luma > 8 && luma < 248) {
          nonFlatPixels += 1;
        }
      }
    }
  }

  return {
    uniqueColorBuckets: buckets.size,
    luminanceRange: maxLuma - minLuma,
    nonFlatPixels
  };
}

async function capture(page, name) {
  const path = `${outputDir}/${name}.png`;
  const buffer = await page.screenshot({ path, fullPage: false });

  return {
    path,
    ...analyzePng(buffer)
  };
}

async function pageSummary(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const rotateLock = document.querySelector('.rotate-lock');
    const experience = document.querySelector('.atlas-experience');
    const activePlanet = document.querySelector('.planet-command.is-active span');
    const targetPlanet = document.querySelector('.target-label strong');

    return {
      title: document.title,
      hasCanvas: Boolean(canvas),
      buttonCount: document.querySelectorAll('.planet-command').length,
      hasMissionDatabase: document.body.innerText.includes('MISSION DATABASE'),
      hasAuthorityMode: document.body.innerText.includes('AUTHORITY MODE'),
      hasAccessGranted: document.body.innerText.includes('ACCESS GRANTED'),
      activePlanetLabel: activePlanet?.textContent ?? null,
      targetPlanetLabel: targetPlanet?.textContent ?? null,
      hasRotateLock: rotateLock ? getComputedStyle(rotateLock).display !== 'none' : false,
      experienceDisplay: experience ? getComputedStyle(experience).display : 'missing',
      viteOverlay: Boolean(document.querySelector('.vite-error-overlay')),
      bodyTextLength: document.body.innerText.trim().length
    };
  });
}

await mkdir(outputDir, { recursive: true });

if (process.env.ATLAS_EXTERNAL_SERVER !== '1') {
  devServer = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'],
    {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    }
  );

  devServer.stdout.on('data', (chunk) => {
    if (process.env.ATLAS_VERBOSE_SERVER === '1') {
      process.stdout.write(chunk);
    }
  });
  devServer.stderr.on('data', (chunk) => {
    if (process.env.ATLAS_VERBOSE_SERVER === '1') {
      process.stderr.write(chunk);
    }
  });

  await waitForServer(appUrl);
}

const browser = await chromium.launch({
  executablePath: edgePath,
  headless: true
});

const consoleErrors = [];
const pageErrors = [];

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const desktop = {
    summary: await pageSummary(page),
    screenshot: await capture(page, 'desktop-overview')
  };

  await page.mouse.click(606, 450);
  await page.getByText('MISSION DATABASE', { exact: true }).waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(2400);
  const planetClickDetail = {
    summary: await pageSummary(page),
    screenshot: await capture(page, 'desktop-planet-click-detail')
  };

  await page.keyboard.press('Escape');
  await page.getByText('MISSION DATABASE', { exact: true }).waitFor({ state: 'hidden', timeout: 5000 });

  const earthButton = page.getByRole('button', { name: 'EARTH', exact: true });
  if ((await earthButton.count()) !== 1) {
    throw new Error('Expected exactly one EARTH overview button.');
  }

  await earthButton.click();
  await page.getByText('MISSION DATABASE', { exact: true }).waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(2400);
  const detail = {
    summary: await pageSummary(page),
    screenshot: await capture(page, 'desktop-detail')
  };

  const positionChart = page.getByLabel('Planet position chart');
  const earthPosition = positionChart.getByLabel('EARTH position');
  const positionChartState = {
    exists: (await positionChart.count()) === 1,
    silhouetteCount: await positionChart.locator('[data-testid="planet-silhouette"]').count(),
    earthCentered: (await earthPosition.getAttribute('aria-current')) === 'true',
    hasSunReference: (await positionChart.getByLabel('Sun external reference').count()) === 1
  };

  await page.getByRole('button', { name: 'Focus PLANET INFO panel', exact: true }).click();
  await page.getByRole('dialog', { name: 'PLANET INFO expanded panel', exact: true }).waitFor({ state: 'visible' });
  const panelFocus = {
    expandedCount: await page.getByText('PLANET INFO', { exact: true }).count(),
    hasFocusedClass: await page.locator('.detail-hud').evaluate((element) => element.classList.contains('has-focused-panel')),
    screenshot: await capture(page, 'desktop-panel-focus')
  };
  await page.getByRole('dialog', { name: 'PLANET INFO expanded panel', exact: true }).click();

  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: 'Enter authority mode', exact: true }).click({ force: true });
  await page.getByText('AUTHORITY MODE', { exact: true }).waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(1400);
  const authorityMode = {
    summary: await pageSummary(page),
    screenshot: await capture(page, 'desktop-authority-mode')
  };

  await page.getByRole('button', { name: 'JUPITER', exact: true }).click();
  await page.waitForTimeout(2400);
  const authorityRailSwitch = {
    summary: await pageSummary(page),
    screenshot: await capture(page, 'desktop-authority-rail-switch')
  };

  await page.keyboard.press('Escape');
  await page.getByText('AUTHORITY MODE', { exact: true }).waitFor({ state: 'hidden', timeout: 5000 });
  await page.getByText('MISSION DATABASE', { exact: true }).waitFor({ state: 'hidden', timeout: 5000 });
  await page.waitForTimeout(2400);
  const authorityDirectReturn = {
    summary: await pageSummary(page),
    screenshot: await capture(page, 'desktop-authority-direct-return')
  };

  await page.getByRole('button', { name: 'JUPITER', exact: true }).click();
  await page.locator('.target-label strong').filter({ hasText: 'JUPITER' }).waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(2400);
  const detailRailSwitch = {
    summary: await pageSummary(page),
    screenshot: await capture(page, 'desktop-detail-rail-switch')
  };

  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: 'MARS', exact: true }).click();
  await page.locator('.target-label strong').filter({ hasText: 'MARS' }).waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(2400);
  const interruptedReturn = {
    summary: await pageSummary(page),
    screenshot: await capture(page, 'desktop-return-interrupt')
  };

  await page.keyboard.press('Escape');
  await page.getByText('MISSION DATABASE', { exact: true }).waitFor({ state: 'hidden', timeout: 5000 });
  const returned = await pageSummary(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const portrait = {
    summary: await pageSummary(page),
    screenshot: await capture(page, 'mobile-portrait')
  };

  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const mobileLandscape = {
    summary: await pageSummary(page),
    screenshot: await capture(page, 'mobile-landscape')
  };

  const fallbackContext = await browser.newContext({ viewport: { width: 1200, height: 760 } });
  await fallbackContext.route(/\.(jpg|jpeg|png|webp|tif)$/i, (route) => route.abort());
  const fallbackPage = await fallbackContext.newPage();
  await fallbackPage.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await fallbackPage.waitForTimeout(1400);
  const fallback = {
    summary: await pageSummary(fallbackPage),
    screenshot: await capture(fallbackPage, 'texture-fallback')
  };

  const report = {
    appUrl,
    desktop,
    planetClickDetail,
    detail,
    positionChartState,
    panelFocus,
    authorityMode,
    authorityRailSwitch,
    authorityDirectReturn,
    detailRailSwitch,
    interruptedReturn,
    returned,
    portrait,
    mobileLandscape,
    fallback,
    consoleErrors,
    pageErrors,
    checks: {
      desktopLoaded: desktop.summary.hasCanvas && desktop.summary.buttonCount === 9 && desktop.summary.bodyTextLength > 0,
      desktopVisualNonBlank: desktop.screenshot.uniqueColorBuckets > 20 && desktop.screenshot.luminanceRange > 80,
      planetMeshClickOpened: planetClickDetail.summary.hasMissionDatabase,
      detailOpened: detail.summary.hasMissionDatabase,
      positionChartTracksSelection:
        positionChartState.exists &&
        positionChartState.silhouetteCount === 8 &&
        positionChartState.earthCentered &&
        positionChartState.hasSunReference,
      panelFocusOpens:
        panelFocus.expandedCount === 2 &&
        panelFocus.hasFocusedClass &&
        panelFocus.screenshot.uniqueColorBuckets > 20,
      authorityModeOpens:
        authorityMode.summary.hasAuthorityMode &&
        authorityMode.summary.hasAccessGranted &&
        !authorityMode.summary.hasMissionDatabase,
      authorityRailSwitches:
        authorityRailSwitch.summary.hasAuthorityMode &&
        authorityRailSwitch.summary.activePlanetLabel === 'JUPITER' &&
        !authorityRailSwitch.summary.hasMissionDatabase,
      authorityDirectReturnSmooth:
        !authorityDirectReturn.summary.hasAuthorityMode &&
        !authorityDirectReturn.summary.hasMissionDatabase &&
        authorityDirectReturn.summary.buttonCount === 9 &&
        authorityDirectReturn.screenshot.uniqueColorBuckets > 20,
      detailRailSwitches:
        detailRailSwitch.summary.hasMissionDatabase &&
        detailRailSwitch.summary.activePlanetLabel === 'JUPITER' &&
        detailRailSwitch.summary.targetPlanetLabel === 'JUPITER',
      returnInterruptReenters:
        interruptedReturn.summary.hasMissionDatabase &&
        interruptedReturn.summary.activePlanetLabel === 'MARS' &&
        interruptedReturn.summary.targetPlanetLabel === 'MARS',
      escapeReturned: !returned.hasMissionDatabase && returned.buttonCount === 9,
      portraitLocks: portrait.summary.hasRotateLock && portrait.summary.experienceDisplay === 'none',
      landscapeShowsAtlas: !mobileLandscape.summary.hasRotateLock && mobileLandscape.summary.buttonCount === 9,
      textureFallbackRenders: fallback.summary.hasCanvas && fallback.screenshot.uniqueColorBuckets > 16
    }
  };

  const failed = Object.entries(report.checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

  console.log(JSON.stringify(report, null, 2));

  if (report.consoleErrors.length > 0 || report.pageErrors.length > 0 || failed.length > 0) {
    throw new Error(
      `Browser verification failed: ${[...failed, ...report.consoleErrors, ...report.pageErrors].join(', ')}`
    );
  }
} finally {
  await browser.close();
  devServer?.kill();
}
