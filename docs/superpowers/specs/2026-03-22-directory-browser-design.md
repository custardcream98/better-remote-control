# Directory Browser & Navigation Redesign

## Overview

BRC(Better Remote Control) 앱의 초기 화면을 터미널 직접 진입에서 디렉토리 탐색 기반 세션 관리로 개선한다. 모바일에서 `cd` 명령어로 경로를 이동하는 불편함을 해소하기 위해, UI로 경로를 선택한 뒤 터미널을 여는 흐름을 도입한다.

## Motivation

- 모바일에서 경로를 타이핑하기 불편함
- 앱 접속 시 터미널이 즉시 열려 경로 선택 기회가 없음
- 세션 관리가 탭 UI에 의존하여 직관적이지 않음

## Architecture

### Routing

- **TanStack Router** (파일 기반 라우팅)
- 라우트 3개: `/`, `/browse`, `/terminal/$sessionId`
- 공통 레이아웃: Config Bar (상단)

### State Management

WebSocket 연결과 세션 상태는 **루트 레이아웃**(`__root.tsx`)에서 관리한다.

- `useSocket` 훅을 루트 레이아웃에서 호출하여 WebSocket 연결 유지
- 세션 목록, `send` 함수, 연결 상태를 **React Context**로 하위 라우트에 제공
- 별도 상태 관리 라이브러리 없이 Context + useState로 충분 (상태가 단순)

```
__root.tsx (루트 레이아웃)
├── SocketProvider (useSocket + sessions state)
│   ├── ConfigBar (공통)
│   └── <Outlet />
│       ├── index.tsx (홈) — useSessionContext()로 세션 목록 접근
│       ├── browse.tsx (탐색기) — useSessionContext()로 send 접근
│       └── terminal.$sessionId.tsx — useSessionContext()로 send/sessions 접근
```

### Screen Flow

```
앱 접속 → 홈(/) → "새 세션" 클릭 → 탐색기(/browse) → "터미널 열기" 클릭 → 터미널(/terminal/$sessionId)
                 → 세션 카드 클릭 → 터미널(/terminal/$sessionId)
```

### Browser History

- 탐색기에서 디렉토리 진입 시 search param(`?path=...`)으로 경로 관리 → 브라우저 뒤로가기로 상위 디렉토리 이동 가능
- 터미널에서 뒤로가기 → 홈으로 이동

## Screens

### 1. Home (`/`)

**목적**: 기존 세션 관리 및 새 세션 생성 진입점

**구성요소**:

- Config Bar (상단, 공통)
- 세션 카드 목록
  - 각 카드: 세션 이름, cwd, 상태(활성/종료)
  - 카드 클릭 → `/terminal/$sessionId`로 이동
  - X 버튼으로 세션 닫기
- 세션이 없을 때: 빈 상태 안내 텍스트
- "새 세션 시작" 버튼 → `/browse`로 이동

**기존 대비 변경**:

- SessionTabs 컴포넌트 제거 (홈 화면이 대체)
- NewSessionDialog 제거 (탐색기 화면이 대체)
- 서버의 세션 자동 생성 로직 제거

### 2. Browser (`/browse`)

**목적**: 서버 파일시스템의 디렉토리를 탐색하여 터미널 시작 경로 선택

**구성요소**:

- Config Bar (상단, 공통)
- Breadcrumb 네비게이션
  - 현재 경로를 세그먼트별로 표시, 각 세그먼트 클릭 가능
  - 모바일 대응: 가로 스크롤 가능하게 처리 (overflow-x-auto), 마지막 세그먼트가 보이도록 자동 스크롤
- 디렉토리 리스트
  - `..` 항목 (상위 디렉토리 이동)
  - 하위 디렉토리 목록 (클릭하여 진입)
  - 디렉토리만 표시 (파일 미표시)
  - 숨김 디렉토리(`.`으로 시작)는 기본적으로 숨김 처리
  - 로딩 중: 스켈레톤 표시
  - 빈 디렉토리: "하위 디렉토리 없음" 안내
  - API 실패: 에러 메시지 + 재시도 버튼
- 하단 고정 "여기서 터미널 열기" 버튼

**시작 경로**: 서버 `--cwd` 옵션값 (기본 `$HOME`), `GET /api/config`의 `defaultCwd`에서 가져옴

**데이터 소스**: 새 서버 API `GET /api/dirs?path=<absolute_path>`

**경로 상태**: search param으로 관리 (`/browse?path=/Users/shiwoo/dev`)

**세션 생성 흐름**:

1. "여기서 터미널 열기" 클릭 → 버튼 비활성화 + 로딩 표시
2. WebSocket으로 `{ type: "create", cwd, command }` 전송 (command는 localStorage에서 읽음, 없으면 생략)
3. 서버에서 `created` 메시지 수신 → `sessionId` 확보
4. `/terminal/$sessionId`로 이동
5. 실패 시 버튼 복원 + 에러 토스트 표시

### 3. Terminal (`/terminal/$sessionId`)

**목적**: 기존 터미널 기능 유지

**구성요소**:

- Config Bar (상단, 공통) + 홈으로 돌아가는 버튼
- TerminalPane (xterm.js, 기존 유지)
- QuickKeys (모바일 단축키, 기존 유지 — 터미널 화면에서만 렌더링)

**기존 대비 변경**:

- SessionTabs 제거
- Config Bar에 홈 버튼 추가

**TerminalPane 라이프사이클**:

- 라우트 전환 시 xterm 인스턴스는 파괴/재생성됨
- 서버의 output buffer(50KB)로 출력 복원 — 스크롤 위치 등 로컬 상태는 유실됨 (수용 가능)

**잘못된 sessionId 처리**:

- 라우트 진입 시 세션 목록에서 해당 sessionId 확인
- 존재하지 않으면 홈(`/`)으로 리다이렉트
- 세션이 종료(`exited`)된 경우: "[Session ended]" 표시 + "홈으로 돌아가기" 버튼

### 4. Config Bar (공통 레이아웃)

**목적**: 모든 화면에서 접근 가능한 설정 영역

**구성요소**:

- 앱 타이틀 또는 현재 화면 컨텍스트
- 설정 버튼 → 설정 다이얼로그
  - "새 터미널 열 때 자동으로 입력할 명령어" 설정
  - **localStorage에 저장** (클라이언트 전용, 서버 `--command` 옵션보다 우선)
- 연결 상태 표시 (기존 StatusBadge를 인라인 요소로 리팩토링하여 ConfigBar 내에 배치)

## Server Changes

### New API: `GET /api/dirs`

**Query Parameters**:

- `path` (string, required): 조회할 디렉토리의 절대 경로

**Validation**:

- `path` 필수, 미제공 시 400
- 절대 경로만 허용 (`/`로 시작), 상대 경로 거부 → 400
- null byte 포함 시 거부 → 400
- 경로 길이 4096자 초과 시 거부 → 400

**Response** (200):

```json
{
  "path": "/Users/shiwoo/dev",
  "dirs": [{ "name": "better-remote-control" }, { "name": "other-project" }]
}
```

- 숨김 디렉토리(`.`으로 시작)도 포함하여 반환 (필터링은 클라이언트에서 처리)
- 이름순 정렬

**Error** (400/404):

```json
{ "error": "Directory not found" }
```

**보안**:

- 인증 필수 (기존 `authMiddleware` 적용)
- 전체 파일시스템 접근 허용 (로컬 머신 원격 제어 도구)

### Session Auto-creation Removal

- 현재: WebSocket 연결 시 세션이 없으면 자동 생성
- 변경: 자동 생성 제거, 홈에서 빈 상태로 시작

### SPA Fallback Route

- 모든 non-API, non-static GET 요청에 대해 인증된 경우 `index.html` 반환
- TanStack Router가 클라이언트에서 라우팅 처리

### Config API

- `GET /api/config`는 이미 `defaultCwd`와 `defaultCommand`를 반환 중 — 변경 불필요

### Reconnection Behavior

- WebSocket 재연결 시 서버는 기존대로 세션 목록 + 버퍼 전송
- 클라이언트는 수신한 세션 목록으로 Context 상태 갱신
- 현재 `/terminal/$sessionId`에 있는데 해당 세션이 목록에 없으면 홈으로 리다이렉트

## Design Quality

- web-design-guidelines 스킬을 적용하여 전체 UI를 모던하게 개선
- 기존 다크 테마 기조 유지하되 촌스러운 느낌 개선
- 모바일 최적화 유지 (터치 타겟 크기, safe area 등)

## Components to Add

| Component        | Location      | Purpose                              |
| ---------------- | ------------- | ------------------------------------ |
| `ConfigBar`      | 공통 레이아웃 | 상단 바 + 설정                       |
| `SettingsDialog` | Config Bar 내 | 자동 실행 명령어 설정 (localStorage) |
| `SessionCard`    | 홈            | 세션 정보 표시 + 선택/닫기           |
| `DirectoryList`  | 탐색기        | 디렉토리 목록                        |
| `Breadcrumb`     | 탐색기        | 경로 표시 + 네비게이션 (가로 스크롤) |
| `SocketProvider` | 루트 레이아웃 | WebSocket + 세션 상태 Context        |

## Components to Remove

| Component          | Reason                                                     |
| ------------------ | ---------------------------------------------------------- |
| `SessionTabs`      | 홈 화면으로 대체                                           |
| `NewSessionDialog` | 탐색기 화면으로 대체                                       |
| `RenameDialog`     | 홈 화면 세션카드에서 rename 기능 제거 (향후 필요시 재추가) |

## Dependencies to Add

| Package                           | Purpose                          |
| --------------------------------- | -------------------------------- |
| `@tanstack/react-router`          | 파일 기반 라우팅                 |
| `@tanstack/react-router-devtools` | 개발용 (devDependency)           |
| `@tanstack/router-plugin`         | Vite 플러그인 (파일 기반 라우팅) |

## Out of Scope

- 즐겨찾기/최근 경로 기능 (향후 추가 예정)
- 파일 표시 (디렉토리만 표시)
- 숨김 디렉토리 표시 토글 (클라이언트에서 기본 숨김 처리, 향후 토글 추가 가능)
