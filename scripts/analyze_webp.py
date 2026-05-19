#!/usr/bin/env python3
"""WebP 파일 분석 및 레퍼런스 비교 스크립트"""

import struct
import sys
import os
import numpy as np
from PIL import Image
from rlottie_python import LottieAnimation


def parse_webp_binary(path: str) -> dict:
    """WebP 바이너리를 직접 파싱해서 ANMF 프레임 정보 추출"""
    with open(path, "rb") as f:
        data = f.read()

    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        return {"error": "Not a WebP file"}

    result = {"frames": [], "loop": None, "bg": None}
    pos = 12

    while pos < len(data):
        chunk_id = data[pos : pos + 4]
        if len(chunk_id) < 4:
            break
        chunk_size = struct.unpack("<I", data[pos + 4 : pos + 8])[0]

        if chunk_id == b"ANMF":
            duration_bytes = data[pos + 8 + 12 : pos + 8 + 15]
            if len(duration_bytes) >= 3:
                dur = (
                    duration_bytes[0]
                    | (duration_bytes[1] << 8)
                    | (duration_bytes[2] << 16)
                )
                result["frames"].append(dur)
        elif chunk_id == b"ANIM":
            result["bg"] = struct.unpack("<I", data[pos + 8 : pos + 12])[0]
            result["loop"] = struct.unpack("<H", data[pos + 12 : pos + 14])[0]

        pos += 8 + chunk_size + (chunk_size % 2)

    return result


def analyze_webp(path: str, label: str = ""):
    """WebP 파일 상세 분석"""
    print(f"\n{'=' * 50}")
    print(f"  {label or path}")
    print(f"{'=' * 50}")

    im = Image.open(path)
    file_size = os.path.getsize(path)

    print(f"  크기: {im.size}")
    print(f"  프레임 수: {im.n_frames}")
    print(f"  애니메이션: {im.is_animated}")
    print(f"  모드: {im.mode}")
    print(f"  파일 크기: {file_size / 1024:.1f} KB")

    # 바이너리 파싱
    parsed = parse_webp_binary(path)
    if parsed["bg"] is not None:
        bg = parsed["bg"]
        print(f"  배경색: 0x{bg:08X} ({'투명' if bg == 0 else '흰색' if bg == 0xFFFFFFFF else '기타'})")
    print(f"  루프: {parsed['loop']}")

    if parsed["frames"]:
        durations = parsed["frames"]
        print(f"  프레임 duration 범위: {min(durations)}~{max(durations)}ms")
        print(f"  고유 duration 값: {sorted(set(durations))}")
        total_ms = sum(durations)
        print(f"  총 재생 시간: {total_ms}ms ({total_ms/1000:.2f}s)")

    # 프레임 내용 분석
    im.seek(0)
    arr = np.array(im.convert("RGBA"))
    non_transparent = np.count_nonzero(arr[:, :, 3])
    print(f"  첫 프레임 비투명 픽셀: {non_transparent}/{arr.shape[0]*arr.shape[1]}")

    return parsed


def generate_reference(lottie_path: str, output_path: str):
    """rlottie-python으로 레퍼런스 WebP 생성"""
    print(f"\n레퍼런스 생성: {lottie_path} → {output_path}")

    anim = LottieAnimation.from_file(lottie_path)
    fps = anim.lottie_animation_get_framerate()
    duration = anim.lottie_animation_get_duration()
    total = anim.lottie_animation_get_totalframe()
    w, h = anim.lottie_animation_get_size()

    print(f"  소스: {w}x{h}, {total}프레임, {fps}fps, {duration}s")

    anim.save_animation(output_path)
    print(f"  저장 완료: {os.path.getsize(output_path) / 1024:.1f} KB")
    return output_path


def compare(ref_path: str, test_path: str):
    """두 WebP 파일 비교"""
    print(f"\n{'#' * 50}")
    print(f"  비교 분석")
    print(f"{'#' * 50}")

    ref_info = analyze_webp(ref_path, "레퍼런스 (rlottie-python)")
    test_info = analyze_webp(test_path, "테스트 (웹앱)")

    print(f"\n--- 차이점 ---")
    ref_frames = len(ref_info["frames"])
    test_frames = len(test_info["frames"])
    print(f"  프레임 수: {ref_frames} vs {test_frames}")
    print(f"  배경색: 0x{ref_info['bg']:08X} vs 0x{test_info['bg']:08X}")

    ref_total = sum(ref_info["frames"]) if ref_info["frames"] else 0
    test_total = sum(test_info["frames"]) if test_info["frames"] else 0
    print(f"  총 재생 시간: {ref_total}ms vs {test_total}ms")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("사용법:")
        print("  분석:    python3 analyze_webp.py <webp_file>")
        print("  비교:    python3 analyze_webp.py --compare <ref.webp> <test.webp>")
        print("  레퍼런스: python3 analyze_webp.py --ref <lottie.json> [output.webp]")
        sys.exit(1)

    if sys.argv[1] == "--compare" and len(sys.argv) >= 4:
        compare(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == "--ref" and len(sys.argv) >= 3:
        lottie_path = sys.argv[2]
        output_path = sys.argv[3] if len(sys.argv) > 3 else "/tmp/reference.webp"
        ref = generate_reference(lottie_path, output_path)
        analyze_webp(ref, "생성된 레퍼런스")
    else:
        analyze_webp(sys.argv[1])
