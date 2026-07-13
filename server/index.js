// 개인용 로컬 API 서버.
//  - 비밀 키(Anthropic API 키 등)를 브라우저 대신 여기서 보관/사용한다.
//  - Vite dev 서버가 /api 요청을 이 서버로 프록시한다(vite.config.ts 참고).
import "dotenv/config";
import express from "express";
import cors from "cors";
import { buildConsultingSample } from "./sample.js";
import { runConsulting } from "./consult.js";
import { createConsultingPage } from "./notion.js";
import { sendToSlack } from "./slack.js";
import { sendToGmail } from "./gmail.js";
import { listHistory, addHistory } from "./history.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT) || 3001;

/** 헬스 체크 */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY) });
});

/** [2] 테스트: Claude 없이 미리 준비된 샘플 컨설팅 결과를 반환 */
app.post("/api/consult/sample", (_req, res) => {
  res.json(buildConsultingSample());
});

/** [1] 실제: 전달받은 태스크들을 Claude로 분석해 자동화 제안을 반환 */
app.post("/api/consult", async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(400).json({
      error:
        "Anthropic API 키가 설정되지 않았습니다. 프로젝트 루트의 .env 파일에 ANTHROPIC_API_KEY 를 넣고 서버를 재시작하세요.",
    });
  }
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) {
    return res.status(400).json({ error: "분석할 태스크가 없습니다." });
  }
  try {
    const result = await runConsulting(items);
    res.json(result);
  } catch (err) {
    console.error("[/api/consult] 분석 실패:", err);
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "분석 중 오류가 발생했습니다." });
  }
});

/** 컨설팅 결과를 Notion 페이지로 내보낸다. */
app.post("/api/export/notion", async (req, res) => {
  const result = req.body?.result;
  if (!result || !Array.isArray(result.items)) {
    return res.status(400).json({ error: "내보낼 컨설팅 결과가 없습니다." });
  }
  try {
    const url = await createConsultingPage(result, req.body?.stamp);
    res.json({ url });
  } catch (err) {
    console.error("[/api/export/notion] 실패:", err);
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Notion 내보내기 실패." });
  }
});

/** 컨설팅 결과를 Slack으로 전송한다. */
app.post("/api/export/slack", async (req, res) => {
  const result = req.body?.result;
  if (!result || !Array.isArray(result.items)) {
    return res.status(400).json({ error: "전송할 컨설팅 결과가 없습니다." });
  }
  try {
    await sendToSlack(result, req.body?.stamp);
    res.json({ ok: true });
  } catch (err) {
    console.error("[/api/export/slack] 실패:", err);
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Slack 전송 실패." });
  }
});

/** 컨설팅 결과를 Gmail로 전송한다. */
app.post("/api/export/gmail", async (req, res) => {
  const result = req.body?.result;
  if (!result || !Array.isArray(result.items)) {
    return res.status(400).json({ error: "전송할 컨설팅 결과가 없습니다." });
  }
  try {
    const to = await sendToGmail(result, req.body?.stamp);
    res.json({ ok: true, to });
  } catch (err) {
    console.error("[/api/export/gmail] 실패:", err);
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Gmail 전송 실패." });
  }
});

/** 프로젝트의 컨설팅 내역 목록 */
app.get("/api/history", (req, res) => {
  const { category, project } = req.query;
  if (!category || !project) {
    return res.status(400).json({ error: "category/project 가 필요합니다." });
  }
  res.json({ records: listHistory(String(category), String(project)) });
});

/** 컨설팅 내역 1건 저장 ([1] 실제 컨설팅 성공 시) */
app.post("/api/history", (req, res) => {
  const { category, project, result } = req.body || {};
  if (!category || !project || !result || !Array.isArray(result.items)) {
    return res.status(400).json({ error: "잘못된 요청입니다." });
  }
  try {
    const record = addHistory(category, project, result);
    res.json({ record });
  } catch (err) {
    console.error("[/api/history] 저장 실패:", err);
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "내역 저장 실패." });
  }
});

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] Anthropic 키: ${process.env.ANTHROPIC_API_KEY ? "설정됨" : "미설정([1] 비활성)"}`);
});
