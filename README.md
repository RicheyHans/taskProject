# 업무 대시보드 (자동화 컨설팅)

구글 스프레드시트를 데이터베이스로 사용하는 업무 · 프로젝트 · 태스크 대시보드입니다.
프로젝트별로 Claude 자동화 컨설팅을 받아 **PDF / Notion / Slack / Gmail**로 내보내고,
컨설팅 내역을 저장합니다.

## 요구사항

- **Node.js v20 이상** (개발 환경: v20.11)

## 설치

```bash
npm install
```

## 실행

```bash
npm run dev:all       # 웹 + API 서버 동시 실행 (권장)
```

- 웹: http://localhost:5173 (자동으로 열림)
- API 서버: http://localhost:3001
- 따로 실행하려면 두 터미널에서 `npm run server` 와 `npm run dev`

> 대시보드 보기 / [2] 테스트 / PDF 받기는 **키 없이도** 동작합니다.

## 환경 변수 (.env) — 실제 컨설팅 · 전송 기능용

`.env.example`을 복사해 `.env`를 만들고 **본인 계정의 값**을 채우세요.

```bash
# Windows
copy .env.example .env
# macOS / Linux
cp .env.example .env
```

| 변수 | 필요한 기능 | 발급/설정 방법 |
|---|---|---|
| `ANTHROPIC_API_KEY` | [1] 자동화 컨설팅(실제 분석) | https://console.anthropic.com (사용량 과금) |
| `ANTHROPIC_MODEL` | (선택) 사용할 모델, 기본 `claude-sonnet-5` | — |
| `NOTION_TOKEN`, `NOTION_PARENT_PAGE_ID` | Notion 내보내기 | Notion 내부 integration 토큰 + 대상 페이지를 integration에 "연결" |
| `SLACK_WEBHOOK_URL` | Slack 전송 | Slack 앱 → Incoming Webhook URL |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_TO` | Gmail 전송 | Gmail 2단계 인증 후 앱 비밀번호(16자리) |
| `SHEET_WEBAPP_URL` | HOME "새 프로젝트 입력" 저장 | 시트에 연결된 Apps Script 웹앱 배포 → [apps-script/README.md](apps-script/README.md) |

> ⚠️ `.env` 값을 바꾼 뒤에는 **API 서버를 재시작**하세요(시작 시 로드됨).
> `.env`에는 비밀 키가 들어가므로 절대 공유하지 마세요.

## 데이터 소스 (구글 시트)

- 기본값은 공개된 예시 시트를 gviz CSV로 읽습니다(보기 전용, 키 불필요).
- **본인 시트로 바꾸려면** `src/sheet.ts`의 `SPREADSHEET_ID` / `SHEET_GID`를 수정하세요.
  - 시트는 "링크가 있는 모든 사용자에게 공개(보기)" 여야 합니다.
  - 열 구성: `category`, `project`, `task`, `description`, `issue`
- 좌측 메뉴의 **[프로젝트 입력]** 버튼으로 원본 시트를 새 탭에서 열 수 있습니다.

### HOME 화면에서 직접 입력 (앱 → 시트 쓰기)

- **HOME** 화면의 **새 프로젝트 입력** 폼에서 카테고리·프로젝트 이름과 태스크(설명·이슈)를
  입력하고 **입력 완료**를 누르면, 값이 위 시트 맨 아래에 행 단위로 쌓입니다.
- 태스크는 최소 1개(기본 1칸)이며 **+ 태스크 추가**로 원하는 만큼 늘릴 수 있습니다(설명·이슈는 선택).
- 이 "쓰기" 기능은 시트에 연결된 Apps Script 웹앱이 필요합니다 → [apps-script/README.md](apps-script/README.md)
  참고 후 `SHEET_WEBAPP_URL`을 `.env`에 설정하세요. (설정 전에는 저장 시 안내 메시지가 표시됩니다)

## 테스트 (선택)

```bash
npx playwright install    # 최초 1회 브라우저 설치
npm test
```

## 빌드

```bash
npm run build
```

## Vercel 배포

프론트엔드(Vite)와 백엔드가 함께 배포됩니다.

- **백엔드는 `/api` 서버리스 함수**로 동작합니다(`api/*.js` → 실제 로직은 `server/*.js` 재사용).
  로컬 개발(`npm run dev:all`)은 기존 Express 서버를 그대로 사용합니다.
- Vercel 프로젝트 설정에서 **Environment Variables**에 아래 값을 등록하세요(로컬 `.env`와 동일, `PORT` 제외):
  `ANTHROPIC_API_KEY`, (선택) `ANTHROPIC_MODEL`, `SHEET_WEBAPP_URL`,
  `NOTION_TOKEN`, `NOTION_PARENT_PAGE_ID`, `SLACK_WEBHOOK_URL`,
  `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_TO`.
- 프리셋 **Vite** / Build `npm run build` / Output `dist` (기본값 그대로).
- ⚠️ 컨설팅 **내역(history)** 은 서버리스에서 임시 저장(`/tmp`)이라 **영구 보관되지 않습니다**
  (재배포·콜드스타트 시 초기화). 영구 보관하려면 외부 저장소(예: Vercel KV/Postgres) 연동이 필요합니다.

## 참고

- 컨설팅 내역은 로컬에서는 `server/history.json`에 **프로젝트별로 로컬 저장**됩니다(각 실행 환경마다 별도).
- 각 사용자는 본인 키/토큰을 사용하며, 서로의 키는 공유되지 않습니다.
