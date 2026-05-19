import { useState, useRef, useCallback, useEffect } from "react";
import { DotLottie } from "@lottiefiles/dotlottie-web";
import RangeSliderInput from "react-range-slider-input";
import "react-range-slider-input/style.css";
import {
  convert,
  DEFAULT_OPTIONS,
  type ConvertOptions,
  type ExportFormat,
} from "./converter";
import "./App.css";

// ESM/CJS 호환 처리
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RangeSlider = (RangeSliderInput as any).default || RangeSliderInput;

type Lang = "ko" | "en";

interface LottieConverterProps {
  lang?: Lang;
}

const TRANSLATIONS = {
  ko: {
    title: "Lottie → Animated Image",
    subtitle: "Lottie JSON을 WebP / GIF / APNG로 변환",
    selectFile: "Lottie JSON 파일 선택",
    invalidFile: "유효한 Lottie JSON 파일이 아닙니다.",
    convertFailed: "변환 실패",
    range: "구간",
    start: "시작 ←",
    end: "→ 끝",
    reset: "초기화",
    original: "원본",
    frames: "프레임",
    convertOptions: "변환 옵션",
    format: "포맷",
    webpDesc: "투명 배경, 작은 파일 크기",
    gifDesc: "호환성 최고, 256색 제한",
    apngDesc: "PNG 기반, 투명 배경, 무손실",
    backgroundColor: "배경색",
    transparent: "투명",
    black: "검정",
    white: "흰색",
    custom: "커스텀",
    size: "크기 (px)",
    speed: "속도",
    outputFps: "출력 FPS",
    originalFps: "원본 FPS",
    loop: "루프",
    infinite: "무한 반복",
    playOnce: "1회 재생",
    playTimes: "회 반복",
    lossless: "무손실 (Lossless)",
    onlyWebp: "WebP에서만 사용 가능",
    quality: "품질",
    onlyLossy: "손실 모드에서만 사용 가능",
    qualityHint: "0 = 최소 크기 / 100 = 최고 품질",
    preset: "프리셋",
    compression: "압축 레벨",
    compressionHint: "높을수록 느리지만 파일 크기 감소",
    converting: "변환 중...",
    convertTo: "로 변환",
    resultPreview: "변환 결과",
    download: "다운로드",
    downloadFailed: "다운로드 실패",
  },
  en: {
    title: "Lottie → Animated Image",
    subtitle: "Convert Lottie JSON to WebP / GIF / APNG",
    selectFile: "Choose Lottie JSON file",
    invalidFile: "Not a valid Lottie JSON file.",
    convertFailed: "Conversion failed",
    range: "Range",
    start: "Start ←",
    end: "→ End",
    reset: "Reset",
    original: "Original",
    frames: "frames",
    convertOptions: "Convert Options",
    format: "Format",
    webpDesc: "Transparent background, small file size",
    gifDesc: "Best compatibility, 256 colors limit",
    apngDesc: "PNG-based, transparent, lossless",
    backgroundColor: "Background",
    transparent: "Transparent",
    black: "Black",
    white: "White",
    custom: "Custom",
    size: "Size (px)",
    speed: "Speed",
    outputFps: "Output FPS",
    originalFps: "Original FPS",
    loop: "Loop",
    infinite: "Infinite Loop",
    playOnce: "Play Once",
    playTimes: " repetitions",
    lossless: "Lossless",
    onlyWebp: "Only available in WebP",
    quality: "Quality",
    onlyLossy: "Only available in Lossy mode",
    qualityHint: "0 = min size / 100 = max quality",
    preset: "Preset",
    compression: "Compression Level",
    compressionHint: "Higher is slower but reduces file size",
    converting: "Converting...",
    convertTo: "Convert to",
    resultPreview: "Result Preview",
    download: "Download",
    downloadFailed: "Download failed",
  }
};

const PRESET_DESCRIPTIONS_I18N = {
  ko: {
    default: "일반적인 용도에 적합",
    picture: "사진처럼 디테일이 많은 이미지에 적합",
    photo: "풍경처럼 색이 부드럽게 변하는 이미지에 적합",
    drawing: "일러스트처럼 선이 뚜렷한 이미지에 적합",
    icon: "작고 색이 선명한 이미지에 적합",
    text: "글자가 포함된 이미지에 적합",
  },
  en: {
    default: "Suitable for general use",
    picture: "Suitable for detailed, picture-like images",
    photo: "Suitable for soft color gradients, like landscapes",
    drawing: "Suitable for illustrations with sharp lines",
    icon: "Suitable for small, vibrant color icons",
    text: "Suitable for images containing text",
  }
};

const getStageText = (rawStage: string, lang: Lang) => {
  if (lang === "ko") return rawStage;
  if (!rawStage) return "";

  if (rawStage.startsWith("FFmpeg 로딩 중")) return "Loading FFmpeg...";
  if (rawStage.startsWith("렌더러 초기화 중")) return "Initializing Renderer...";
  if (rawStage.includes("개 프레임 추출 중")) return "Extracting frames...";
  if (rawStage.includes("프레임 추출 중")) {
    const match = rawStage.match(/\((\d+\/\d+)\)/);
    return `Extracting frames ${match ? `(${match[1]})` : ""}`;
  }
  if (rawStage === "인코딩 중...") return "Encoding...";
  if (rawStage === "파일 생성 중...") return "Generating file...";
  if (rawStage === "완료!") return "Done!";
  return rawStage;
};

function LottieConverter({ lang = "ko" }: LottieConverterProps) {
  const t = TRANSLATIONS[lang];
  const presetDesc = PRESET_DESCRIPTIONS_I18N[lang];

  const [file, setFile] = useState<File | null>(null);
  const [animData, setAnimData] = useState<Record<string, unknown> | null>(null);
  const [animInfo, setAnimInfo] = useState<{ frames: number; fps: number; width: number; height: number } | null>(null);
  const [options, setOptions] = useState<ConvertOptions>(DEFAULT_OPTIONS);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 프리뷰 상태
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const currentFrameRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotLottieRef = useRef<DotLottie | null>(null);
  const frameIntervalRef = useRef<number | null>(null);

  const isWebP = options.format === "webp";
  const supportsTransparency = options.format !== "gif";

  // dotlottie 인스턴스 생성 (정지 상태로)
  useEffect(() => {
    if (!animData || !canvasRef.current) return;
    if (dotLottieRef.current) { dotLottieRef.current.destroy(); dotLottieRef.current = null; }

    const instance = new DotLottie({
      canvas: canvasRef.current,
      data: animData,
      autoplay: false,
      loop: false,
      renderConfig: { devicePixelRatio: window.devicePixelRatio, autoResize: true },
    });
    dotLottieRef.current = instance;
    setIsPlaying(false);
    setCurrentFrame(0);

    return () => { instance.destroy(); dotLottieRef.current = null; };
  }, [animData]);

  // 재생/정지 제어
  useEffect(() => {
    if (!dotLottieRef.current || !animInfo) return;

    if (isPlaying) {
      const fps = animInfo.fps;
      const start = options.frameStart;
      const end = options.frameEnd < 0 ? animInfo.frames : options.frameEnd;
      let frame = currentFrameRef.current < start || currentFrameRef.current >= end ? start : currentFrameRef.current;

      frameIntervalRef.current = window.setInterval(() => {
        frame++;
        if (frame >= end) frame = start;
        dotLottieRef.current?.setFrame(frame);
        currentFrameRef.current = frame;
        setCurrentFrame(frame);
      }, 1000 / fps);
    } else {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
    }

    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
    };
  }, [isPlaying, animInfo, options.frameStart, options.frameEnd]);

  // playhead 이동
  const seekToFrame = useCallback((frame: number) => {
    if (!dotLottieRef.current) return;
    setIsPlaying(false);
    dotLottieRef.current.setFrame(frame);
    currentFrameRef.current = frame;
    setCurrentFrame(frame);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setDownloadUrl(null);
    setError(null);
    setResultSize(null);
    setIsPlaying(false);
    setCurrentFrame(0);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        setAnimData(json);
        const fps = json.fr || 30;
        const frames = (json.op || 0) - (json.ip || 0);
        const width = json.w || 512;
        const height = json.h || 512;
        setAnimInfo({ frames, fps, width, height });
        setOptions((prev) => ({ ...prev, width, height, fps, frameStart: 0, frameEnd: frames }));
      } catch {
        setError(t.invalidFile);
        setAnimData(null);
        setAnimInfo(null);
      }
    };
    reader.readAsText(f);
  }, [t.invalidFile]);

  const handleConvert = useCallback(async () => {
    if (!animData) return;
    setConverting(true);
    setProgress(0);
    setStage("");
    setError(null);
    setDownloadUrl(null);
    setResultSize(null);
    try {
      const blob = await convert(animData, options, (p, s) => { setProgress(p); setStage(s); });
      setDownloadUrl(URL.createObjectURL(blob));
      setResultSize(blob.size);
    } catch (err) {
      setError(`${t.convertFailed}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setConverting(false);
    }
  }, [animData, options, t.convertFailed]);

  const updateOption = <K extends keyof ConvertOptions>(key: K, value: ConvertOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const ext = options.format;
  const fileName = file?.name.replace(/\.json$/, `.${ext}`) ?? `animation.${ext}`;
  const totalFrames = animInfo?.frames ?? 0;
  const frameEnd = options.frameEnd < 0 ? totalFrames : options.frameEnd;

  return (
    <div className="app">
      <h1>{t.title}</h1>
      <p className="subtitle">{t.subtitle}</p>

      <div className="upload-area">
        <label className="upload-label">
          <input type="file" accept=".json" onChange={handleFileChange} className="file-input" />
          <span>{file ? file.name : t.selectFile}</span>
        </label>
      </div>

      {animData && animInfo && (
        <div className="content">
          <div className="left-panel">
            <div className="preview-wrapper" style={{
              backgroundColor: options.backgroundColor === "transparent"
                ? undefined
                : options.backgroundColor === "black" ? "#000"
                : options.backgroundColor === "white" ? "#fff"
                : options.backgroundColor,
              backgroundImage: options.backgroundColor === "transparent"
                ? "repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%)"
                : undefined,
              backgroundSize: options.backgroundColor === "transparent"
                ? "16px 16px"
                : undefined,
            }}>
              <canvas ref={canvasRef} className="preview-canvas" width={256} height={256} />
            </div>

            {/* 재생 컨트롤 */}
            <div className="playback-controls">
              <button className="play-btn" onClick={() => setIsPlaying(!isPlaying)}>
                {isPlaying ? "⏸" : "▶"}
              </button>
              <span className="frame-display">{currentFrame} / {totalFrames}</span>
            </div>

            {/* Playhead 슬라이더 */}
            <div className="playhead">
              <input
                type="range" min={0} max={totalFrames - 1} value={currentFrame}
                onChange={(e) => seekToFrame(Number(e.target.value))}
                className="playhead-slider"
              />
            </div>

            {/* 구간 선택 */}
            <div className="trim-section">
              <div className="trim-header">
                <span className="trim-label">{t.range}: {options.frameStart} ~ {frameEnd}</span>
                <div className="trim-buttons">
                  <button className="trim-btn" onClick={() => {
                    if (currentFrame < frameEnd) {
                      updateOption("frameStart", currentFrame);
                    }
                  }}>
                    {t.start}
                  </button>
                  <button className="trim-btn" onClick={() => {
                    if (currentFrame > options.frameStart) {
                      updateOption("frameEnd", currentFrame);
                    }
                  }}>
                    {t.end}
                  </button>
                  <button className="trim-btn" onClick={() => {
                    setOptions((prev) => ({ ...prev, frameStart: 0, frameEnd: totalFrames }));
                  }}>
                    {t.reset}
                  </button>
                </div>
              </div>
              <RangeSlider
                min={0}
                max={totalFrames}
                value={[options.frameStart, frameEnd]}
                onInput={(value: number[]) => {
                  updateOption("frameStart", value[0]);
                  updateOption("frameEnd", value[1]);
                }}
                className="trim-slider"
              />
            </div>

            <div className="info">
              {t.original}: {animInfo.width}×{animInfo.height} · {animInfo.frames}{t.frames} · {animInfo.fps}fps
            </div>
          </div>

          <div className="right-panel">
            <h3>{t.convertOptions}</h3>

            {/* 포맷 */}
            <div className="option-group">
              <label>{t.format}</label>
              <div className="format-buttons">
                {(["webp", "gif", "apng"] as ExportFormat[]).map((fmt) => (
                  <button key={fmt} className={`format-btn ${options.format === fmt ? "active" : ""}`}
                    onClick={() => {
                      updateOption("format", fmt);
                      if (fmt === "gif" && options.backgroundColor === "transparent") {
                        updateOption("backgroundColor", "black");
                      }
                    }}>
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
              <span className="option-hint">
                {options.format === "webp" && t.webpDesc}
                {options.format === "gif" && t.gifDesc}
                {options.format === "apng" && t.apngDesc}
              </span>
            </div>

            {/* 배경색 */}
            <div className="option-group">
              <label>{t.backgroundColor}</label>
              <div className="bg-buttons">
                {supportsTransparency && (
                  <button className={`bg-btn ${options.backgroundColor === "transparent" ? "active" : ""}`}
                    onClick={() => updateOption("backgroundColor", "transparent")}>
                    <span className="bg-swatch transparent-swatch" />{t.transparent}
                  </button>
                )}
                <button className={`bg-btn ${options.backgroundColor === "black" ? "active" : ""}`}
                  onClick={() => updateOption("backgroundColor", "black")}>
                  <span className="bg-swatch" style={{ background: "#000" }} />{t.black}
                </button>
                <button className={`bg-btn ${options.backgroundColor === "white" ? "active" : ""}`}
                  onClick={() => updateOption("backgroundColor", "white")}>
                  <span className="bg-swatch" style={{ background: "#fff" }} />{t.white}
                </button>
                <label className="bg-btn bg-custom">
                  <input type="color"
                    value={options.backgroundColor.startsWith("#") ? options.backgroundColor : "#333333"}
                    onChange={(e) => updateOption("backgroundColor", e.target.value)} />
                  <span className="bg-swatch" style={{ background: options.backgroundColor.startsWith("#") ? options.backgroundColor : "#333" }} />
                  {t.custom}
                </label>
              </div>
            </div>

            {/* 크기 */}
            <div className="option-group">
              <label>{t.size}</label>
              <div className="size-inputs">
                <input type="number" value={options.width} onChange={(e) => updateOption("width", Number(e.target.value))} min={1} max={4096} />
                <span>×</span>
                <input type="number" value={options.height} onChange={(e) => updateOption("height", Number(e.target.value))} min={1} max={4096} />
              </div>
            </div>

            {/* 속도 */}
            <div className="option-group">
              <label>{t.speed}: {options.speed}x</label>
              <input type="range" min={0.25} max={3} step={0.25} value={options.speed}
                onChange={(e) => updateOption("speed", Number(e.target.value))} />
              <span className="option-hint">{t.outputFps}: {Math.round(options.fps * options.speed)}</span>
            </div>

            {/* FPS */}
            <div className="option-group">
              <label>{t.originalFps}</label>
              <input type="number" value={options.fps} onChange={(e) => updateOption("fps", Number(e.target.value))} min={1} max={120} />
            </div>

            {/* 루프 */}
            <div className="option-group">
              <label>{t.loop}</label>
              <select value={options.loop} onChange={(e) => updateOption("loop", Number(e.target.value))}>
                <option value={0}>{t.infinite}</option>
                <option value={1}>{t.playOnce}</option>
                <option value={2}>2{t.playTimes}</option>
                <option value={3}>3{t.playTimes}</option>
                <option value={5}>5{t.playTimes}</option>
              </select>
            </div>

            {/* 무손실 */}
            <div className={`option-group ${!isWebP ? "disabled" : ""}`}>
              <label className="checkbox-label">
                <input type="checkbox" checked={options.lossless}
                  onChange={(e) => updateOption("lossless", e.target.checked)} disabled={!isWebP} />
                {t.lossless}
              </label>
              {!isWebP && <span className="option-hint">{t.onlyWebp}</span>}
            </div>

            {/* 품질 */}
            <div className={`option-group ${!isWebP || options.lossless ? "disabled" : ""}`}>
              <label>{t.quality}: {options.quality}</label>
              <input type="range" min={0} max={100} value={options.quality}
                onChange={(e) => updateOption("quality", Number(e.target.value))} disabled={!isWebP || options.lossless} />
              <span className="option-hint">
                {!isWebP ? t.onlyWebp : options.lossless ? t.onlyLossy : t.qualityHint}
              </span>
            </div>

            {/* 프리셋 */}
            <div className={`option-group ${!isWebP ? "disabled" : ""}`}>
              <label>{t.preset}</label>
              <select value={options.preset} onChange={(e) => updateOption("preset", e.target.value as ConvertOptions["preset"])} disabled={!isWebP}>
                {Object.keys(presetDesc).map((key) => (
                  <option key={key} value={key}>{key.charAt(0).toUpperCase() + key.slice(1)}</option>
                ))}
              </select>
              <span className="option-hint">{!isWebP ? t.onlyWebp : presetDesc[options.preset as keyof typeof presetDesc]}</span>
            </div>

            {/* 압축 레벨 */}
            <div className={`option-group ${!isWebP ? "disabled" : ""}`}>
              <label>{t.compression}: {options.compressionLevel}</label>
              <input type="range" min={0} max={6} value={options.compressionLevel}
                onChange={(e) => updateOption("compressionLevel", Number(e.target.value))} disabled={!isWebP} />
              <span className="option-hint">{!isWebP ? t.onlyWebp : t.compressionHint}</span>
            </div>
          </div>
        </div>
      )}

      {animData && (
        <div className="actions">
          <button className="convert-btn" onClick={handleConvert} disabled={converting}>
            {converting ? getStageText(stage, lang) || t.converting : `${t.convertTo} ${options.format.toUpperCase()}`}
          </button>
          {converting && <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>}
          {downloadUrl && (
            <div className="result">
              <img src={downloadUrl} alt={t.resultPreview} className="result-preview" />
              <a href={downloadUrl} download={fileName} className="download-btn">
                ⬇ {t.download} {fileName} {resultSize && <span className="file-size"> ({(resultSize / 1024).toFixed(1)} KB)</span>}
              </a>
            </div>
          )}
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function App() {
  const [currentPath, setCurrentPath] = useState(() => {
    const path = window.location.pathname;
    if (path === "/") {
      // 브라우저 언어 설정을 감지하여 영어 사용자는 /en/lottie, 그 외(한국어)는 /lottie로 자동 리다이렉트
      const isKorean = navigator.language.startsWith("ko");
      const defaultLang = isKorean ? "/lottie" : "/en/lottie";
      window.history.replaceState({}, "", defaultLang);
      return defaultLang;
    }
    return path;
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  if (currentPath === "/lottie") {
    return <LottieConverter lang="ko" />;
  }

  if (currentPath === "/en/lottie") {
    return <LottieConverter lang="en" />;
  }

  return (
    <div style={{ padding: "4rem 2rem", textAlign: "center", color: "#aaa", fontFamily: "sans-serif" }}>
      Page not found or redirecting...
    </div>
  );
}

export default App;
