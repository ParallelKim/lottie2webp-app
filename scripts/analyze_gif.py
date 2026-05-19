#!/usr/bin/env python3
"""GIF/APNG 파일 분석 및 레퍼런스 비교 스크립트"""

import sys
import os
import numpy as np
from PIL import Image
from rlottie_python import LottieAnimation


def analyze(path: str, label: str = ""):
    """GIF/APNG 파일 상세 분석"""
    print(f"\n{'=' * 50}")
    print(f"  {label or path}")
    print(f"{'=' * 50}")

    im = Image.open(path)
    file_size = os.path.getsize(path)
    ext = os.path.splitext(path)[1].lower()

    print(f"  포맷: {im.format} ({ext})")
    print(f"  크기: {im.size}")
    print(f"  프레임 수: {im.n_frames}")
    print(f"  애니메이션: {im.is_animated}")
    print(f"  모드: {im.mode}")
    print(f"  파일 크기: {file_size / 1024:.1f} KB")

    # 프레임별 분석
    print(f"\n  프레임 샘플:")
    sample_indices = [0, im.n_frames // 4, im.n_frames // 2, im.n_frames * 3 // 4, im.n_frames - 1]
    for i in sorted(set(sample_indices)):
        if i >= im.n_frames:
            continue
        im.seek(i)
        arr = np.array(im.convert("RGBA"))
        non_transparent = np.count_nonzero(arr[:, :, 3])
        non_black = np.count_nonzero(np.any(arr[:, :, :3] > 10, axis=2))
        duration = im.info.get("duration", "N/A")
        disposal = getattr(im, "disposal_method", "N/A") if ext == ".gif" else "N/A"
        print(f"    frame {i:3d}: 비투명={non_transparent:6d}, 비검정={non_black:6d}, duration={duration}ms, disposal={disposal}")

    return {
        "size": im.size,
        "frames": im.n_frames,
        "file_size": file_size,
    }


def generate_reference(lottie_path: str, output_path: str):
    """rlottie-python으로 레퍼런스 생성"""
    ext = os.path.splitext(output_path)[1].lower()
    print(f"\n레퍼런스 생성: {lottie_path} → {output_path}")

    anim = LottieAnimation.from_file(lottie_path)
    fps = anim.lottie_animation_get_framerate()
    duration = anim.lottie_animation_get_duration()
    w, h = anim.lottie_animation_get_size()
    print(f"  소스: {w}x{h}, {fps}fps, {duration}s")

    if ext == ".gif":
        anim.save_animation(output_path)
    elif ext == ".png":
        anim.save_animation(output_path)
    else:
        anim.save_animation(output_path)

    print(f"  저장 완료: {os.path.getsize(output_path) / 1024:.1f} KB")
    return output_path


def compare(ref_path: str, test_path: str):
    """두 파일 비교"""
    print(f"\n{'#' * 50}")
    print(f"  비교 분석")
    print(f"{'#' * 50}")

    ref_info = analyze(ref_path, "레퍼런스 (rlottie-python)")
    test_info = analyze(test_path, "테스트 (웹앱)")

    print(f"\n--- 차이점 ---")
    print(f"  프레임 수: {ref_info['frames']} vs {test_info['frames']}")
    print(f"  파일 크기: {ref_info['file_size']/1024:.1f}KB vs {test_info['file_size']/1024:.1f}KB")

    # 첫 프레임 비투명 픽셀 비교
    ref_im = Image.open(ref_path)
    test_im = Image.open(test_path)
    ref_im.seek(0)
    test_im.seek(0)
    ref_arr = np.array(ref_im.convert("RGBA"))
    test_arr = np.array(test_im.convert("RGBA"))
    ref_nt = np.count_nonzero(ref_arr[:, :, 3])
    test_nt = np.count_nonzero(test_arr[:, :, 3])
    print(f"  첫 프레임 비투명: {ref_nt} vs {test_nt}")

    ratio = test_nt / max(ref_nt, 1)
    if ratio < 0.5:
        print(f"  ⚠️  테스트 결과의 비투명 픽셀이 레퍼런스의 {ratio:.0%}밖에 안 됨 — 렌더링 문제 의심")
    elif ratio > 0.8:
        print(f"  ✓ 비투명 픽셀 비율 정상 ({ratio:.0%})")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("사용법:")
        print("  분석:    python3 analyze_gif.py <gif_or_apng_file>")
        print("  비교:    python3 analyze_gif.py --compare <ref> <test>")
        print("  레퍼런스: python3 analyze_gif.py --ref <lottie.json> <output.gif|png>")
        sys.exit(1)

    if sys.argv[1] == "--compare" and len(sys.argv) >= 4:
        compare(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == "--ref" and len(sys.argv) >= 4:
        lottie_path = sys.argv[2]
        output_path = sys.argv[3]
        generate_reference(lottie_path, output_path)
        analyze(output_path, "생성된 레퍼런스")
    else:
        analyze(sys.argv[1])
