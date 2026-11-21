# 🗂️ VocaQuest - 영어단어 플래시카드 & 맞추기 게임

> 단어장 사진/이미지를 업로드하면 자동으로 단어장을 생성하고, 연상 이미지와 함께 3D 플래시카드 및 다양한 미니게임으로 재미있게 암기하는 반응형 웹 애플리케이션입니다.

---

## 🌟 주요 기능

### 1. 📷 단어장 이미지 읽기 (OCR) & 스마트 파서
- **이미지 업로드**: 단어장 책, 유인물, 캡처 사진을 드래그 앤 드롭하면 영단어와 한국어 뜻을 자동 추출합니다 (`Tesseract.js`).
- **텍스트 대량 입력**: `apple : 사과`, `banana - 바나나` 등 다양한 형식의 텍스트를 복사/붙여넣기하여 한 번에 단어장으로 변환합니다.
- **연상 이미지 연동**: 단어 뜻에 맞는 무료 고화질 스톡 이미지를 매칭하여 시각적 기억을 강화합니다.

### 2. 🗂️ 3D 플립 플래시카드 & 라이트너 암기 시스템
- 카드를 클릭하거나 **Spacebar**를 눌러 앞면(영단어/발음기호)과 뒷면(한국어 뜻/예문/연상 이미지)을 3D로 뒤집습니다.
- **Web Speech API 원어민 발음(TTS)** 듣기 지원.
- `외움(3)` / `헷갈림(2)` / `모름(1)` 상태를 평가하여, 틀린 단어는 **오답노트**에 자동 분류되어 집중 복습할 수 있습니다.
- 키보드 단축키 지원 (Space: 뒤집기, ←/→: 이전/다음 단어, 1/2/3: 평가).

### 3. 🎮 4가지 영어단어 맞추기 게임 모드
1. **⚡ 사지선다 스피드 퀴즈 (Speed Quiz)**: 제한시간 10초 내에 올바른 보기 선택! 연속 정답 시 콤보 보너스 점수 획득. (영어➔뜻 / 뜻➔영어 모드 지원)
2. **🧩 카드 짝맞추기 (Memory Match)**: 뒤집힌 12장의 카드 속에서 [영단어]와 [한국어 뜻] 쌍을 찾는 두뇌 트레이닝 기억 게임.
3. **🔤 스펠링 맞추기 (Word Scramble)**: 뜻과 힌트 이미지를 보고 뒤섞인 알파벳 블록을 클릭/타이핑하여 올바른 단어를 조합하는 철자 학습 게임.
4. **☄️ 단어 낙하 디펜스 (Speed Drop)**: 하늘에서 떨어지는 단어가 바닥에 닿기 전에 영단어를 타이핑하여 격추하는 아케이드 디펜스 게임.

### 4. 💾 로컬 저장소 & 데이터 백업
- 브라우저 `LocalStorage`를 기반으로 작동하여 로그인이나 별도 서버 없이도 단어장과 학습 기록이 영구 보관됩니다.
- 단어장 데이터를 **JSON 파일로 내보내기/가져오기**가 가능하여 다른 기기와 손쉽게 공유할 수 있습니다.

---

## 🚀 GitHub Pages 배포 방법

이 프로젝트는 순수 정적 웹 기술(Vanilla HTML5, Modern ES6+ Modules, Tailwind CSS)로 제작되어 **GitHub Pages에 푸시하는 즉시 무료로 호스팅**됩니다.

### 단계 1: GitHub 원격 저장소 생성 및 푸시
```bash
# 1. git 초기화 및 커밋
git init
git add .
git commit -m "feat: 영단어 플래시카드 및 맞추기 게임 초기 릴리즈"

# 2. 본인의 GitHub 리포지토리 연결
git remote add origin https://github.com/<사용자명>/<저장소명>.git
git branch -M main
git push -u origin main
```

### 단계 2: GitHub Pages 활성화
1. GitHub 리포지토리 페이지에서 **Settings** 탭으로 이동합니다.
2. 좌측 메뉴에서 **Pages**를 클릭합니다.
3. **Build and deployment > Source** 옵션에서 **GitHub Actions**를 선택합니다.
   - 프로젝트에 내장된 `.github/workflows/deploy.yml` 파일에 의해 자동으로 배포가 시작됩니다.
   - (또는 **Deploy from a branch** 선택 후 `Branch: main / (root)`를 지정하셔도 즉시 배포됩니다.)
4. 약 1분 후 제공되는 URL (`https://<사용자명>.github.io/<저장소명>/`)에 접속하면 전 세계 어디서나 웹앱을 이용하실 수 있습니다!

---

## 💻 로컬에서 실행하기

별도의 Node.js 설치 없이 Python 내장 서버로 즉시 테스트할 수 있습니다:

```bash
# FlashCard 프로젝트 디렉토리에서 실행
python3 -m http.server 3000
```
브라우저에서 `http://localhost:3000`으로 접속하세요.

---

## 📁 프로젝트 구조

```
├── index.html                 # 메인 웹앱 엔트리포인트 (반응형 UI)
├── css/
│   └── style.css              # 3D 카드 플립 애니메이션 및 커스텀 스타일
├── js/
│   ├── app.js                 # 메인 라우터 & 탭 컨트롤러
│   ├── storage.js             # LocalStorage 단어 저장소 및 JSON 백업
│   ├── tts.js                 # Web Speech API 원어민 발음 및 AudioContext 효과음
│   ├── ocr.js                 # Tesseract.js 이미지 단어 파서 & 스마트 텍스트 파서
│   ├── wordManager.js         # 단어장 CRUD 및 이미지 업로드 모달 UI
│   ├── data/
│   │   └── defaultWords.js    # 고화질 연상 이미지와 예문이 포함된 기본 단어 세트
│   └── games/
│       ├── flashcard.js       # 3D 플립 플래시카드 & 라이트너 복습 시스템
│       ├── quiz.js            # 사지선다 스피드 퀴즈 (타이머 & 콤보)
│       ├── match.js           # 카드 짝맞추기 메모리 게임
│       ├── scramble.js        # 스펠링 스크램블 글자 맞추기
│       └── speed-drop.js      # 단어 낙하 디펜스 타이핑 게임
└── .github/
    └── workflows/
        └── deploy.yml         # GitHub Actions 자동 배포 워크플로우
```
