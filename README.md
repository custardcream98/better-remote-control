# brc

모바일에서 로컬 터미널 쓰는 CLI 도구.

Claude Code Remote Control이 너무 불안정해서 만들었음. Cloudflare Tunnel로 로컬 터미널을 모바일 브라우저에 노출하는 방식. Claude Code뿐 아니라 아무 CLI 도구나 쓸 수 있음.

## 설치 & 실행

```bash
git clone https://github.com/custardcream98/better-remote-control.git
cd better-remote-control
pnpm install && pnpm run build
pnpm start
```

QR 코드 뜨면 모바일로 스캔. 비밀번호 입력하면 터미널 나옴.

## 옵션

```bash
# Claude Code 자동 실행
brc --command "claude --dangerously-skip-permissions"

# 특정 디렉토리에서 시작
brc --cwd ~/my-project

# 터널 없이 로컬만
brc --no-tunnel

# 비밀번호 직접 지정
brc --password mypassword
```

전체 옵션은 `brc --help` 참고.

## 주요 기능

- **멀티 세션** — 탭으로 여러 터미널 동시 사용, 세션별 디렉토리/자동 명령어
- **모바일 특수키** — Ctrl, Alt, Tab, Esc, 방향키, Opt+Enter 등. 길게 누르면 반복
- **이미지 업로드** — 카메라/갤러리에서 이미지 선택 → 서버 업로드 → 경로 자동 삽입 (Claude Code에 이미지 넘길 때 유용)
- **sleep 방지** — caffeinate로 맥북 덮어도 계속 실행 (전원 연결 필요)
- **재연결 복원** — 네트워크 끊겼다 붙으면 터미널 히스토리 자동 복원
- **인증** — 비밀번호 + rate limiting + CSRF + timing-safe 비교

## 사전 요구사항

- Node.js >= 18
- pnpm
- cloudflared (`brew install cloudflared`, 터널 쓸 때만)

## 스택

서버: Express + WebSocket + node-pty / 클라이언트: React + Tailwind + shadcn/ui + xterm.js / 터널: Cloudflare Quick Tunnel (무료)

## 개발

```bash
pnpm run dev:client    # 클라이언트 HMR
pnpm run dev:server    # 서버 watch
pnpm run build         # 전체 빌드
pnpm run lint          # 린트
cd client && pnpm run storybook  # 스토리북
```

## 라이선스

MIT
