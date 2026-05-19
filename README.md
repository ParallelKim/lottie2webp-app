# Lottie → WebP / GIF / APNG Converter

Lottie JSON 파일을 브라우저에서 **WebP, GIF, APNG** 이미지로 변환해 주는 정적 웹 사이트입니다. 모든 렌더링과 인코딩 처리는 서버를 거치지 않고 사용자의 브라우저(클라이언트) 내에서 이루어집니다.

## EN

A static web application that converts Lottie JSON files into **WebP, GIF, and APNG** animated images directly in your browser. All rendering and encoding processes are performed client-side (entirely in your browser), ensuring no file data is ever sent to a server.

🔗 **Live Demo**: [asset-utils.web.app](https://asset-utils.web.app)

---

## 💡 배경 (Background)

* **필요성:** 기존 웹 기반의 Lottie 변환기 중 품질이나 편의성 면에서 제대로 쓸 만한 도구가 없어 직접 변환기를 개발할 필요가 있었습니다.
* **이식 및 정적 웹 구현:** 로컬 CLI 도구 중 안정적으로 작동하던 Python 패키지인 [rlottie-python](https://github.com/laggykiller/rlottie-python)을 참고하여, 이를 **JavaScript/Web 환경으로 마이그레이션**했습니다.
* **결과:** 사용자가 파이썬 개발 환경이나 별도의 로컬 툴을 설치할 필요 없이, 브라우저 접속만으로 간편하게 변환 작업을 수행할 수 있도록 정적 웹 페이지 형태로 제작되었습니다.

### EN
* **The Need:** Since there were no web-based Lottie converters that offered reliable quality and usability, we felt the need to develop our own tool.
* **Porting to Web:** We referenced [rlottie-python](https://github.com/laggykiller/rlottie-python) (a local Python CLI tool that worked reliably) and **ported its logic to the JavaScript/Web environment**.
* **The Result:** Built entirely as a static web application, it allows users to perform conversions directly by visiting the site in a web browser without having to set up a Python environment or install any local CLI tools.

---

## ✨ 주요 기능 (Key Features)

### 한국어
* **3가지 포맷 변환:** WebP (투명 배경 지원), GIF, APNG (애니메이션 PNG)
* **프레임 트리밍:** 슬라이더를 통해 변환하고 싶은 시작/끝 프레임 구간을 지정
* **실시간 재생 컨트롤:** 실시간 미리보기 및 프레임 단위 정밀 탐색(Playhead)
* **배경색 설정:** 투명 배경 또는 원하는 배경 컬러 합성
* **세부 옵션 조정:** 배율 속도 조절, 반복 횟수(Loop), WebP 품질 및 압축 레벨 설정

### English
* **3 Export Formats:** WebP (with transparency support), GIF, and APNG (Animated PNG).
* **Frame Trimming:** Set precise start and end frames for conversion using an intuitive slider.
* **Real-time Player:** Real-time preview player with custom frame-by-frame playhead seek control.
* **Background Customization:** Render with transparency or overlay the animation onto a custom background color.
* **Detailed Controls:** Adjust playback speed multiplier, loop counts, WebP encoding quality, and compression levels.

---

## 📄 License
MIT
