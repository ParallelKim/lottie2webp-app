import { useState, useRef, useCallback, useEffect } from "react";
import { DotLottie } from "@lottiefiles/dotlottie-web";
import RangeSliderInput from "react-range-slider-input";
import "react-range-slider-input/style.css";
import {
  convert,
  DEFAULT_OPTIONS,
  PRESET_DESCRIPTIONS,
  type ConvertOptions,
  type ExportFormat,
} from "./converter";
import "./App.css";

// ESM/CJS 호환 처리
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RangeSlider = (RangeSliderInput as any).default || RangeSliderInput;

function LottieConverter() {
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
        setError("유효한 Lottie JSON 파일이 아닙니다.");
        setAnimData(null);
        setAnimInfo(null);
      }
    };
    reader.readAsText(f);
  }, []);

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
      setError(`변환 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setConverting(false);
    }
  }, [animData, options]);

  const updateOption = <K extends keyof ConvertOptions>(key: K, value: ConvertOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const ext = options.format;
  const fileName = file?.name.replace(/\.json$/, `.${ext}`) ?? `animation.${ext}`;
  const totalFrames = animInfo?.frames ?? 0;
  const frameEnd = options.frameEnd < 0 ? totalFrames : options.frameEnd;

  return (
    <div className="app">
      <h1>Lottie → Animated Image</h1>
      <p className="subtitle">Lottie JSON을 WebP / GIF / APNG로 변환</p>

      <div className="upload-area">
        <label className="upload-label">
          <input type="file" accept=".json" onChange={handleFileChange} className="file-input" />
          <span>{file ? file.name : "Lottie JSON 파일 선택"}</span>
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
                <span className="trim-label">구간: {options.frameStart} ~ {frameEnd}</span>
                <div className="trim-buttons">
                  <button className="trim-btn" onClick={() => {
                    if (currentFrame < frameEnd) {
                      updateOption("frameStart", currentFrame);
                    }
                  }}>
                    시작 ←
                  </button>
                  <button className="trim-btn" onClick={() => {
                    if (currentFrame > options.frameStart) {
                      updateOption("frameEnd", currentFrame);
                    }
                  }}>
                    → 끝
                  </button>
                  <button className="trim-btn" onClick={() => {
                    setOptions((prev) => ({ ...prev, frameStart: 0, frameEnd: totalFrames }));
                  }}>
                    초기화
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
              원본: {animInfo.width}×{animInfo.height} · {animInfo.frames}프레임 · {animInfo.fps}fps
            </div>
          </div>

          <div className="right-panel">
            <h3>변환 옵션</h3>

            {/* 포맷 */}
            <div className="option-group">
              <label>포맷</label>
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
                {options.format === "webp" && "투명 배경, 작은 파일 크기"}
                {options.format === "gif" && "호환성 최고, 256색 제한"}
                {options.format === "apng" && "PNG 기반, 투명 배경, 무손실"}
              </span>
            </div>

            {/* 배경색 */}
            <div className="option-group">
              <label>배경색</label>
              <div className="bg-buttons">
                {supportsTransparency && (
                  <button className={`bg-btn ${options.backgroundColor === "transparent" ? "active" : ""}`}
                    onClick={() => updateOption("backgroundColor", "transparent")}>
                    <span className="bg-swatch transparent-swatch" />투명
                  </button>
                )}
                <button className={`bg-btn ${options.backgroundColor === "black" ? "active" : ""}`}
                  onClick={() => updateOption("backgroundColor", "black")}>
                  <span className="bg-swatch" style={{ background: "#000" }} />검정
                </button>
                <button className={`bg-btn ${options.backgroundColor === "white" ? "active" : ""}`}
                  onClick={() => updateOption("backgroundColor", "white")}>
                  <span className="bg-swatch" style={{ background: "#fff" }} />흰색
                </button>
                <label className="bg-btn bg-custom">
                  <input type="color"
                    value={options.backgroundColor.startsWith("#") ? options.backgroundColor : "#333333"}
                    onChange={(e) => updateOption("backgroundColor", e.target.value)} />
                  <span className="bg-swatch" style={{ background: options.backgroundColor.startsWith("#") ? options.backgroundColor : "#333" }} />
                  커스텀
                </label>
              </div>
            </div>

            {/* 크기 */}
            <div className="option-group">
              <label>크기 (px)</label>
              <div className="size-inputs">
                <input type="number" value={options.width} onChange={(e) => updateOption("width", Number(e.target.value))} min={1} max={4096} />
                <span>×</span>
                <input type="number" value={options.height} onChange={(e) => updateOption("height", Number(e.target.value))} min={1} max={4096} />
              </div>
            </div>

            {/* 속도 */}
            <div className="option-group">
              <label>속도: {options.speed}x</label>
              <input type="range" min={0.25} max={3} step={0.25} value={options.speed}
                onChange={(e) => updateOption("speed", Number(e.target.value))} />
              <span className="option-hint">출력 FPS: {Math.round(options.fps * options.speed)}</span>
            </div>

            {/* FPS */}
            <div className="option-group">
              <label>원본 FPS</label>
              <input type="number" value={options.fps} onChange={(e) => updateOption("fps", Number(e.target.value))} min={1} max={120} />
            </div>

            {/* 루프 */}
            <div className="option-group">
              <label>루프</label>
              <select value={options.loop} onChange={(e) => updateOption("loop", Number(e.target.value))}>
                <option value={0}>무한 반복</option>
                <option value={1}>1회 재생</option>
                <option value={2}>2회 반복</option>
                <option value={3}>3회 반복</option>
                <option value={5}>5회 반복</option>
              </select>
            </div>

            {/* 무손실 */}
            <div className={`option-group ${!isWebP ? "disabled" : ""}`}>
              <label className="checkbox-label">
                <input type="checkbox" checked={options.lossless}
                  onChange={(e) => updateOption("lossless", e.target.checked)} disabled={!isWebP} />
                무손실 (Lossless)
              </label>
              {!isWebP && <span className="option-hint">WebP에서만 사용 가능</span>}
            </div>

            {/* 품질 */}
            <div className={`option-group ${!isWebP || options.lossless ? "disabled" : ""}`}>
              <label>품질: {options.quality}</label>
              <input type="range" min={0} max={100} value={options.quality}
                onChange={(e) => updateOption("quality", Number(e.target.value))} disabled={!isWebP || options.lossless} />
              <span className="option-hint">
                {!isWebP ? "WebP에서만 사용 가능" : options.lossless ? "손실 모드에서만 사용 가능" : "0 = 최소 크기 / 100 = 최고 품질"}
              </span>
            </div>

            {/* 프리셋 */}
            <div className={`option-group ${!isWebP ? "disabled" : ""}`}>
              <label>프리셋</label>
              <select value={options.preset} onChange={(e) => updateOption("preset", e.target.value as ConvertOptions["preset"])} disabled={!isWebP}>
                {Object.keys(PRESET_DESCRIPTIONS).map((key) => (
                  <option key={key} value={key}>{key.charAt(0).toUpperCase() + key.slice(1)}</option>
                ))}
              </select>
              <span className="option-hint">{!isWebP ? "WebP에서만 사용 가능" : PRESET_DESCRIPTIONS[options.preset]}</span>
            </div>

            {/* 압축 레벨 */}
            <div className={`option-group ${!isWebP ? "disabled" : ""}`}>
              <label>압축 레벨: {options.compressionLevel}</label>
              <input type="range" min={0} max={6} value={options.compressionLevel}
                onChange={(e) => updateOption("compressionLevel", Number(e.target.value))} disabled={!isWebP} />
              <span className="option-hint">{!isWebP ? "WebP에서만 사용 가능" : "높을수록 느리지만 파일 크기 감소"}</span>
            </div>
          </div>
        </div>
      )}

      {animData && (
        <div className="actions">
          <button className="convert-btn" onClick={handleConvert} disabled={converting}>
            {converting ? stage || "변환 중..." : `${options.format.toUpperCase()}로 변환`}
          </button>
          {converting && <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>}
          {downloadUrl && (
            <div className="result">
              <img src={downloadUrl} alt="변환 결과" className="result-preview" />
              <a href={downloadUrl} download={fileName} className="download-btn">
                ⬇ {fileName} 다운로드{resultSize && <span className="file-size"> ({(resultSize / 1024).toFixed(1)} KB)</span>}
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
  // 1. 초기 상태 결정 시점에 리다이렉트 동기 처리
  const [currentPath, setCurrentPath] = useState(() => {
    const path = window.location.pathname;
    if (path === "/") {
      window.history.replaceState({}, "", "/lottie");
      return "/lottie";
    }
    return path;
  });

  useEffect(() => {
    // 2. 이펙트는 순수하게 외부 브라우저 이벤트(popstate)만 구독
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // 2. 패스에 따른 조건부 렌더링
  if (currentPath === "/lottie") {
    return <LottieConverter />;
  }

  // 향후 다른 유틸리티가 추가되면 이곳에 분기 추가 가능
  // else if (currentPath === "/another-tool") { ... }

  return (
    <div style={{ padding: "4rem 2rem", textAlign: "center", color: "#aaa", fontFamily: "sans-serif" }}>
      페이지를 찾을 수 없거나 이동 중입니다...
    </div>
  );
}

export default App;
