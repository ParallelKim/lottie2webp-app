#!/usr/bin/env node
/**
 * E2E 변환 테스트: puppeteer로 웹앱에서 Lottie → WebP 변환 후 결과물 검증
 * 
 * 사용법: node scripts/e2e_convert_test.mjs [lottie.json] [--port 5174]
 */

import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
let lottieFile = path.join(PROJECT_ROOT, 'public/Surface (1).json');
let port = 5174;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port') port = parseInt(args[++i]);
  else if (!args[i].startsWith('--')) lottieFile = path.resolve(args[i]);
}

if (!fs.existsSync(lottieFile)) {
  console.error(`파일 없음: ${lottieFile}`);
  process.exit(1);
}

const OUTPUT_PATH = path.join(PROJECT_ROOT, 'test_output.webp');
const BASE_URL = `http://localhost:${port}`;

async function runTest() {
  console.log(`\n🧪 E2E 변환 테스트`);
  console.log(`   입력: ${path.basename(lottieFile)}`);
  console.log(`   서버: ${BASE_URL}\n`);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // 콘솔 로그 캡처
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`   [브라우저 에러] ${msg.text()}`);
  });
  page.on('pageerror', err => console.log(`   [페이지 에러] ${err.message}`));

  let allPassed = true;

  // WebP 테스트
  console.log('--- WebP 테스트 ---');
  const webpResult = await convertAndDownload(page, lottieFile, 'webp');
  if (webpResult) {
    const webpChecks = verifyWebP(webpResult);
    webpChecks.forEach(c => console.log(`   ${c.pass ? '✓' : '✗'} ${c.name}: ${c.detail}`));
    if (!webpChecks.every(c => c.pass)) allPassed = false;
  } else {
    allPassed = false;
  }

  // GIF 테스트
  console.log('\n--- GIF 테스트 ---');
  const gifResult = await convertFormat(page, 'gif');
  if (gifResult) {
    const gifChecks = verifyGIF(gifResult);
    gifChecks.forEach(c => console.log(`   ${c.pass ? '✓' : '✗'} ${c.name}: ${c.detail}`));
    if (!gifChecks.every(c => c.pass)) allPassed = false;
  } else {
    allPassed = false;
  }

  await browser.close();

  // Python 분석
  if (webpResult) {
    fs.writeFileSync(OUTPUT_PATH, Buffer.from(webpResult));
    console.log('\n📊 WebP 레퍼런스 비교:');
    try {
      const analysisResult = execSync(
        `python3 scripts/analyze_webp.py --compare /tmp/ref.webp "${OUTPUT_PATH}"`,
        { cwd: PROJECT_ROOT, encoding: 'utf-8', timeout: 30000 }
      );
      console.log(analysisResult);
    } catch (e) {
      execSync(`python3 scripts/analyze_webp.py --ref "${lottieFile}" /tmp/ref.webp`, { cwd: PROJECT_ROOT, encoding: 'utf-8' });
      const analysisResult = execSync(
        `python3 scripts/analyze_webp.py --compare /tmp/ref.webp "${OUTPUT_PATH}"`,
        { cwd: PROJECT_ROOT, encoding: 'utf-8' }
      );
      console.log(analysisResult);
    }
    if (fs.existsSync(OUTPUT_PATH)) fs.unlinkSync(OUTPUT_PATH);
  }

  console.log(`\n${allPassed ? '✅ 모든 검증 통과' : '❌ 검증 실패'}\n`);
  process.exit(allPassed ? 0 : 1);
}

async function convertAndDownload(page, lottieFile, format) {
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 15000 });
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(lottieFile);
    await page.waitForSelector('canvas.preview-canvas', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));
    console.log('   ✓ 파일 업로드 완료');

    // 포맷 선택
    if (format !== 'webp') {
      await page.click(`.format-btn:nth-child(${format === 'gif' ? 2 : 3})`);
      await new Promise(r => setTimeout(r, 300));
    }

    const convertBtn = await page.$('.convert-btn');
    await convertBtn.click();
    console.log('   ⏳ 변환 중...');

    const result = await Promise.race([
      page.waitForSelector('.download-btn', { timeout: 120000 }).then(() => 'success'),
      page.waitForSelector('.error', { timeout: 120000 }).then(() => 'error'),
    ]);

    if (result === 'error') {
      const errorText = await page.$eval('.error', el => el.textContent);
      console.log(`   ✗ 변환 실패: ${errorText}`);
      return null;
    }

    const blobData = await page.evaluate(async () => {
      const link = document.querySelector('.download-btn');
      const response = await fetch(link.href);
      const buffer = await response.arrayBuffer();
      return Array.from(new Uint8Array(buffer));
    });

    console.log(`   ✓ 변환 완료 (${(blobData.length / 1024).toFixed(1)} KB)`);
    return blobData;
  } catch (err) {
    console.log(`   ✗ 에러: ${err.message}`);
    return null;
  }
}

async function convertFormat(page, format) {
  try {
    // 이미 파일이 로드된 상태에서 포맷만 변경
    const formatIndex = format === 'gif' ? 2 : 3;
    await page.click(`.format-btn:nth-child(${formatIndex})`);
    await new Promise(r => setTimeout(r, 300));

    const convertBtn = await page.$('.convert-btn');
    await convertBtn.click();
    console.log('   ⏳ 변환 중...');

    const result = await Promise.race([
      page.waitForSelector('.download-btn', { timeout: 120000 }).then(() => 'success'),
      page.waitForSelector('.error', { timeout: 120000 }).then(() => 'error'),
    ]);

    if (result === 'error') {
      const errorText = await page.$eval('.error', el => el.textContent);
      console.log(`   ✗ 변환 실패: ${errorText}`);
      return null;
    }

    const blobData = await page.evaluate(async () => {
      const link = document.querySelector('.download-btn');
      const response = await fetch(link.href);
      const buffer = await response.arrayBuffer();
      return Array.from(new Uint8Array(buffer));
    });

    console.log(`   ✓ 변환 완료 (${(blobData.length / 1024).toFixed(1)} KB)`);
    return blobData;
  } catch (err) {
    console.log(`   ✗ 에러: ${err.message}`);
    return null;
  }
}

function verifyWebP(blobData) {
  const data = Buffer.from(blobData);
  const checks = [];

  const isWebP = data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46
    && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50;
  checks.push({ name: '유효한 WebP', pass: isWebP, detail: isWebP ? 'RIFF/WEBP 헤더 확인' : '잘못된 파일 형식' });
  if (!isWebP) return checks;

  let pos = 12;
  let hasAnim = false;
  let animBg = null;
  let frameCount = 0;
  let durations = [];
  let blendFlags = new Set();

  while (pos < data.length - 8) {
    const chunkId = String.fromCharCode(data[pos], data[pos+1], data[pos+2], data[pos+3]);
    const chunkSize = data[pos+4] | (data[pos+5] << 8) | (data[pos+6] << 16) | (data[pos+7] << 24);

    if (chunkId === 'ANIM') {
      hasAnim = true;
      animBg = data[pos+8] | (data[pos+9] << 8) | (data[pos+10] << 16) | (data[pos+11] << 24);
    } else if (chunkId === 'ANMF') {
      frameCount++;
      const dur = data[pos+8+12] | (data[pos+8+13] << 8) | (data[pos+8+14] << 16);
      durations.push(dur);
      const flags = data[pos + 8 + 15];
      blendFlags.add((flags >> 1) & 1);
    }

    pos += 8 + chunkSize + (chunkSize % 2);
  }

  checks.push({ name: '애니메이션', pass: hasAnim && frameCount > 1, detail: `${frameCount}프레임` });
  checks.push({ name: '투명 배경', pass: animBg === 0, detail: `0x${(animBg ?? 0).toString(16).padStart(8, '0')}` });
  const hasDuration = durations.length > 0 && durations.every(d => d > 0);
  checks.push({ name: '프레임 duration', pass: hasDuration, detail: hasDuration ? `${durations[0]}~${durations[durations.length-1]}ms` : 'duration 없음' });
  checks.push({ name: '파일 크기', pass: data.length > 10240, detail: `${(data.length / 1024).toFixed(1)} KB` });
  const blendOk = blendFlags.has(1) && !blendFlags.has(0);
  checks.push({ name: 'blend=overwrite', pass: blendOk, detail: `blend값: ${[...blendFlags].join(',')} (1=overwrite 필요)` });

  return checks;
}

function verifyGIF(blobData) {
  const data = Buffer.from(blobData);
  const checks = [];

  // GIF 헤더 확인
  const header = String.fromCharCode(data[0], data[1], data[2]);
  const isGIF = header === 'GIF';
  checks.push({ name: '유효한 GIF', pass: isGIF, detail: isGIF ? `${String.fromCharCode(...data.slice(0, 6))}` : '잘못된 파일 형식' });

  // 파일 크기
  checks.push({ name: '파일 크기', pass: data.length > 5000, detail: `${(data.length / 1024).toFixed(1)} KB` });

  // 프레임 수 (GCE 블록 카운트)
  let frameCount = 0;
  for (let i = 0; i < data.length - 3; i++) {
    if (data[i] === 0x21 && data[i+1] === 0xF9 && data[i+2] === 0x04) {
      frameCount++;
    }
  }
  checks.push({ name: '프레임 수', pass: frameCount > 1, detail: `${frameCount}프레임` });

  // 크기가 합리적 (빈 프레임만 있으면 매우 작음)
  const sizePerFrame = data.length / Math.max(frameCount, 1);
  checks.push({ name: '프레임당 크기', pass: sizePerFrame > 100, detail: `${sizePerFrame.toFixed(0)} bytes/frame (100+ 필요)` });

  return checks;
}

runTest().catch(err => {
  console.error('테스트 실패:', err.message);
  process.exit(1);
});
