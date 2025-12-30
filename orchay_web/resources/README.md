# App Icons

이 폴더에 앱 아이콘 파일을 추가하세요:

## 필요한 파일

- `icon.ico` - Windows용 (256x256 권장)
- `icon.icns` - macOS용
- `icon.png` - Linux용 (512x512 권장)

## 아이콘 생성 도구

1. **electron-icon-maker**: npm 패키지로 하나의 PNG에서 모든 포맷 생성
   ```bash
   npx electron-icon-maker --input=source-icon.png --output=./resources
   ```

2. **online tools**:
   - https://icoconvert.com/ (PNG → ICO)
   - https://cloudconvert.com/png-to-icns (PNG → ICNS)

## 권장 소스 이미지

- 최소 1024x1024 PNG
- 투명 배경 권장
- 단순하고 인식하기 쉬운 디자인
