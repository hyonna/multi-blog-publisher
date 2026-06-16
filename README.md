# Multi Blog Publisher

마크다운으로 글을 작성하고 **티스토리**와 **벨로그**에 동시 발행하는 macOS 데스크탑 앱입니다.

## 주요 기능

- **마크다운 에디터** — 실시간 라이브 프리뷰 (split-pane)
- **자동 저장** — 타이핑 후 1.5초 뒤 로컬 자동 저장
- **글 목록 관리** — 사이드바에서 글 작성·선택·삭제
- **멀티 플랫폼 발행** — 티스토리 / 벨로그 선택 발행 또는 동시 발행
- **태그 관리** — 태그 입력 후 Enter로 추가, 발행 시 각 플랫폼에 자동 입력
- **발행 상태 표시** — 발행된 플랫폼 뱃지 및 결과 URL 표시

## 기술 스택

| 영역 | 기술 |
|---|---|
| 런타임 | Electron 28 |
| 빌드 도구 | electron-vite 2 |
| UI 프레임워크 | React 18 + TypeScript |
| 마크다운 에디터 | @uiw/react-md-editor |
| 상태 관리 | Zustand |
| 로컬 저장소 | electron-store |
| HTTP 클라이언트 | Axios |
| 마크다운 변환 | marked (MD → HTML, 티스토리용) |
| 스타일링 | Tailwind CSS |
| 패키지 매니저 | pnpm |

## 프로젝트 구조

```
multi-blog-publisher/
├── src/
│   ├── main/                      # Electron 메인 프로세스
│   │   ├── index.ts               # 앱 진입점, BrowserWindow 생성
│   │   ├── ipc.ts                 # IPC 핸들러 (post, settings, tistory)
│   │   ├── store.ts               # electron-store 래퍼 (글·설정 영속화)
│   │   └── publishers/
│   │       ├── tistory.ts         # 티스토리 BrowserWindow 자동화
│   │       └── velog.ts           # 벨로그 BrowserWindow 자동화
│   ├── preload/
│   │   └── index.ts               # contextBridge IPC 브리지
│   └── renderer/                  # React 앱
│       ├── index.html
│       └── src/
│           ├── App.tsx            # 레이아웃, 자동저장 로직
│           ├── index.css          # Tailwind + 글로벌 스타일
│           ├── types/index.ts     # 공유 타입 정의 + window.electron 타입
│           ├── stores/useStore.ts # Zustand 전역 상태
│           └── components/
│               ├── Sidebar.tsx    # 글 목록, 새 글 버튼
│               ├── Editor.tsx     # 마크다운 에디터 + 프리뷰
│               ├── PublishBar.tsx # 하단 발행 바 (플랫폼·태그·버튼)
│               └── SettingsModal.tsx # 플랫폼 설정 모달
├── electron.vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
└── package.json
```

## 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    Renderer Process                      │
│  React 18 + Zustand                                     │
│  ┌───────────┐  ┌────────────────┐  ┌───────────────┐  │
│  │  Sidebar  │  │    Editor      │  │  PublishBar   │  │
│  │ (글 목록)  │  │ (MD + 프리뷰)  │  │(플랫폼·태그)  │  │
│  └───────────┘  └────────────────┘  └───────────────┘  │
└─────────────────────────┬───────────────────────────────┘
                          │ contextBridge (IPC)
                          │ preload/index.ts
┌─────────────────────────▼───────────────────────────────┐
│                     Main Process                         │
│  ┌──────────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │    ipc.ts    │  │ store.ts  │  │   publishers/    │  │
│  │ (핸들러 등록) │  │ (영속화)  │  │  tistory.ts      │  │
│  └──────────────┘  └───────────┘  │  velog.ts        │  │
│                                   └──────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### IPC 채널

| 채널 | 설명 |
|---|---|
| `post:getAll` | 전체 글 목록 조회 |
| `post:save` | 글 저장 (신규 / 수정) |
| `post:delete` | 글 삭제 |
| `post:publish` | 선택 플랫폼에 발행 |
| `settings:get` | 설정 조회 |
| `settings:save` | 설정 저장 |
| `tistory:login` | 티스토리 로그인 창 열기 (쿠키 캡처) |

## 플랫폼 연동 방식

### 티스토리

> 2023년 Open API 서비스 종료로 인해 **BrowserWindow 자동화** 방식을 사용합니다.

**연결 방법**
1. 앱 설정 → 티스토리 탭 → **티스토리 로그인** 클릭
2. 열리는 창에서 카카오 또는 이메일로 로그인
3. 로그인 완료 시 세션 쿠키 자동 저장 및 창 닫힘

**발행 흐름**
1. 발행하기 클릭 → `{blogname}.tistory.com/manage/newpost/` 창 열림
2. 제목 · 본문 · 태그 자동 입력 (마크다운/HTML 모드 자동 감지)
3. 사용자가 직접 **발행** 버튼 클릭
4. 포스트 URL 또는 관리 페이지 이동 시 성공 처리

---

### 벨로그

> GraphQL API 인증 제한으로 인해 **BrowserWindow 자동화** 방식을 사용합니다.

**연결 방법**
1. [velog.io](https://velog.io) 로그인
2. 개발자 도구(F12) → Application → Cookies → `https://velog.io`
3. `access_token` 값 복사 → 앱 설정 → 벨로그 탭 → access_token 필드에 붙여넣기
4. `refresh_token` 값 복사 → refresh_token 필드에 붙여넣기

**발행 흐름**
1. 발행하기 클릭 → `velog.io/write` 창 열림 (세션에 쿠키 등록)
2. 제목 · 본문(CodeMirror) · 태그 자동 입력
3. 사용자가 직접 **출간하기** 클릭
4. 포스트 URL 이동 시 성공 처리

> ⚠️ `access_token`은 **24시간마다 만료**됩니다. 만료 시 DevTools에서 다시 복사해 주세요.

## 시작하기

### 요구사항

- Node.js 18+
- pnpm 8+
- macOS

### 설치 및 실행

```bash
git clone https://github.com/hyonna/multi-blog-publisher.git
cd multi-blog-publisher

pnpm install
```

```bash
# 개발 모드 실행
pnpm dev

# 프로덕션 빌드
pnpm build

# macOS 앱 패키징 (.dmg)
pnpm build:mac
```

### 주의사항

- 최초 실행 시 `node_modules/electron/install.js`가 Electron 바이너리를 다운로드합니다.
- pnpm v10 환경에서 Electron 빌드 스크립트가 비활성화된 경우 아래 명령으로 수동 다운로드합니다.

```bash
node node_modules/electron/install.js
```

## 데이터 저장 위치

글과 설정은 macOS 사용자 데이터 디렉토리에 JSON 형식으로 저장됩니다.

```
~/Library/Application Support/multi-blog-publisher/
```

## 라이선스

MIT
