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

> ⚠️ `.env` 값을 바꾼 뒤에는 **API 서버를 재시작**하세요(시작 시 로드됨).
> `.env`에는 비밀 키가 들어가므로 절대 공유하지 마세요.

## 데이터 소스 (구글 시트)

- 기본값은 공개된 예시 시트를 gviz CSV로 읽습니다(보기 전용, 키 불필요).
- **본인 시트로 바꾸려면** `src/sheet.ts`의 `SPREADSHEET_ID` / `SHEET_GID`를 수정하세요.
  - 시트는 "링크가 있는 모든 사용자에게 공개(보기)" 여야 합니다.
  - 열 구성: `category`, `project`, `task`, `description`, `issue`
- 좌측 메뉴의 **[프로젝트 입력]** 버튼으로 원본 시트를 새 탭에서 열 수 있습니다.

## 테스트 (선택)

```bash
npx playwright install    # 최초 1회 브라우저 설치
npm test
```

## 빌드

```bash
npm run build
```

## 참고

- 컨설팅 내역은 `server/history.json`에 **프로젝트별로 로컬 저장**됩니다(각 실행 환경마다 별도).
- 각 사용자는 본인 키/토큰을 사용하며, 서로의 키는 공유되지 않습니다.
