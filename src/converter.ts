import { DotLottie } from "@lottiefiles/dotlottie-web";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

export type ExportFormat = "webp" | "gif" | "apng";
export type BackgroundColor = "transparent" | "black" | "white" | string;

export interface ConvertOptions {
  width: number;
  height: number;
  fps: number;
  quality: number;
  lossless: boolean;
  loop: number;
  preset: "default" | "picture" | "photo" | "drawing" | "icon" | "text";
  compressionLevel: number;
  format: ExportFormat;
  backgroundColor: BackgroundColor;
  speed: number; // 0.5 ~ 3
  frameStart: number;
  frameEnd: number;
}

export const DEFAULT_OPTIONS: ConvertOptions = {
  width: 512,
  height: 512,
  fps: 30,
  quality: 90,
  lossless: true,
  loop: 0,
  preset: "default",
  compressionLevel: 4,
  format: "webp",
  backgroundColor: "transparent",
  speed: 1,
  frameStart: 0,
  frameEnd: -1, // -1 = 마지막 프레임
};

export const PRESET_DESCRIPTIONS: Record<ConvertOptions["preset"], string> = {
  default: "일반적인 용도에 적합",
  picture: "사진처럼 디테일이 많은 이미지에 적합",
  photo: "풍경처럼 색이 부드럽게 변하는 이미지에 적합",
  drawing: "일러스트처럼 선이 뚜렷한 이미지에 적합",
  icon: "작고 색이 선명한 이미지에 적합",
  text: "글자가 포함된 이미지에 적합",
};

function parseBgColor(bg: BackgroundColor): [number, number, number] | null {
  if (bg === "transparent") return null;
  if (bg === "black") return [0, 0, 0];
  if (bg === "white") return [255, 255, 255];
  // hex color (#RRGGBB)
  const match = bg.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (match) return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
  return [0, 0, 0];
}

let ffmpegInstance: FFmpeg | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  const ffmpeg = new FFmpeg();
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });
  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

export async function convert(
  animationData: object,
  options: ConvertOptions,
  onProgress?: (percent: number, stage: string) => void
): Promise<Blob> {
  onProgress?.(0, "FFmpeg 로딩 중...");
  const ffmpeg = await getFFmpeg();

  onProgress?.(5, "렌더러 초기화 중...");

  const canvas = new OffscreenCanvas(options.width, options.height);
  const ctx = canvas.getContext("2d")!;

  const dotLottie = new DotLottie({
    canvas: { width: options.width, height: options.height },
    data: animationData as Record<string, unknown>,
    autoplay: false,
    loop: false,
    useFrameInterpolation: false,
    renderConfig: { devicePixelRatio: 1, freezeOnOffscreen: false },
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("로드 타임아웃")), 15000);
    dotLottie.addEventListener("load", () => { clearTimeout(timeout); resolve(); });
    dotLottie.addEventListener("loadError", (e) => { clearTimeout(timeout); reject(e.error); });
  });

  const totalFrames = dotLottie.totalFrames;
  const startFrame = Math.max(0, options.frameStart);
  const endFrame = options.frameEnd < 0 ? totalFrames : Math.min(options.frameEnd, totalFrames);
  const frameCount = endFrame - startFrame;

  if (frameCount <= 0) throw new Error("유효한 프레임 구간이 아닙니다");

  // 속도에 따른 출력 FPS 계산
  const outputFps = Math.round(options.fps * options.speed);

  onProgress?.(10, `${frameCount}개 프레임 추출 중...`);

  // 배경색 결정: GIF는 투명 불가 → 강제 불투명
  const needsOpaqueBg = options.format === "gif" || options.backgroundColor !== "transparent";
  const bgColor = needsOpaqueBg
    ? (parseBgColor(options.backgroundColor) ?? [0, 0, 0])
    : null;

  for (let i = 0; i < frameCount; i++) {
    dotLottie.setFrame(startFrame + i);

    const pixelBuffer = dotLottie.buffer;
    if (!pixelBuffer) throw new Error(`프레임 ${startFrame + i} 렌더링 실패`);

    const clampedArray = new Uint8ClampedArray(pixelBuffer.length);
    clampedArray.set(pixelBuffer);

    // 배경색 합성
    if (bgColor) {
      const [bgR, bgG, bgB] = bgColor;
      for (let j = 0; j < clampedArray.length; j += 4) {
        const a = clampedArray[j + 3] / 255;
        clampedArray[j] = Math.round(clampedArray[j] * a + bgR * (1 - a));
        clampedArray[j + 1] = Math.round(clampedArray[j + 1] * a + bgG * (1 - a));
        clampedArray[j + 2] = Math.round(clampedArray[j + 2] * a + bgB * (1 - a));
        clampedArray[j + 3] = 255;
      }
    }

    const imageData = new ImageData(clampedArray, options.width, options.height);
    ctx.putImageData(imageData, 0, 0);

    const blob = await canvas.convertToBlob({ type: "image/png" });
    const buffer = new Uint8Array(await blob.arrayBuffer());
    await ffmpeg.writeFile(`frame${String(i + 1).padStart(4, "0")}.png`, buffer);

    onProgress?.(10 + (i / frameCount) * 60, `프레임 추출 중 (${i + 1}/${frameCount})`);
  }

  dotLottie.destroy();
  onProgress?.(70, "인코딩 중...");

  const outputFile = `output.${options.format === "apng" ? "png" : options.format}`;

  if (options.format === "gif") {
    await ffmpeg.exec([
      "-framerate", String(outputFps),
      "-i", "frame%04d.png",
      "-vf", "palettegen=stats_mode=diff",
      "-y", "palette.png",
    ]);
    await ffmpeg.exec([
      "-framerate", String(outputFps),
      "-i", "frame%04d.png",
      "-i", "palette.png",
      "-lavfi", "paletteuse=dither=sierra2_4a",
      "-loop", String(options.loop),
      "-y", outputFile,
    ]);
    await ffmpeg.deleteFile("palette.png");
  } else {
    const args = buildFFmpegArgs(options, outputFile, outputFps);
    await ffmpeg.exec(args);
  }

  onProgress?.(90, "파일 생성 중...");

  const data = await ffmpeg.readFile(outputFile);
  const finalBytes = new Uint8Array(data as Uint8Array);

  if (options.format === "webp") {
    patchWebPFlags(finalBytes);
  }

  for (let i = 0; i < frameCount; i++) {
    await ffmpeg.deleteFile(`frame${String(i + 1).padStart(4, "0")}.png`);
  }
  await ffmpeg.deleteFile(outputFile);

  onProgress?.(100, "완료!");

  const mimeTypes: Record<ExportFormat, string> = {
    webp: "image/webp",
    gif: "image/gif",
    apng: "image/png",
  };
  return new Blob([finalBytes], { type: mimeTypes[options.format] });
}

function buildFFmpegArgs(options: ConvertOptions, outputFile: string, outputFps: number): string[] {
  const base = ["-framerate", String(outputFps), "-i", "frame%04d.png"];

  switch (options.format) {
    case "webp":
      return [
        ...base,
        "-vcodec", "libwebp",
        "-lossless", options.lossless ? "1" : "0",
        "-loop", String(options.loop),
        "-quality", String(options.quality),
        "-preset", options.preset,
        "-compression_level", String(options.compressionLevel),
        "-pix_fmt", "yuva420p",
        "-y", outputFile,
      ];
    case "gif":
      return [...base, "-y", outputFile];
    case "apng":
      return [
        ...base,
        "-plays", String(options.loop),
        "-f", "apng",
        "-y", outputFile,
      ];
  }
}

function patchWebPFlags(data: Uint8Array): void {
  let pos = 12;
  while (pos < data.length - 8) {
    const chunkId = String.fromCharCode(data[pos], data[pos + 1], data[pos + 2], data[pos + 3]);
    const chunkSize = data[pos + 4] | (data[pos + 5] << 8) | (data[pos + 6] << 16) | (data[pos + 7] << 24);
    if (chunkId === "ANIM") {
      data[pos + 8] = 0; data[pos + 9] = 0; data[pos + 10] = 0; data[pos + 11] = 0;
    } else if (chunkId === "ANMF") {
      data[pos + 8 + 15] = (data[pos + 8 + 15] & 0xFC) | 0x02;
    }
    pos += 8 + chunkSize + (chunkSize % 2);
  }
}
