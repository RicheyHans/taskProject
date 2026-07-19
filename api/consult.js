// Vercel 서버리스 함수: [1] 실제 Claude 분석. → POST /api/consult
import { runConsulting } from "../server/consult.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(400).json({
      error:
        "Anthropic API 키가 설정되지 않았습니다. Vercel 프로젝트의 Environment Variables 에 ANTHROPIC_API_KEY 를 추가하고 재배포하세요.",
    });
  }
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) {
    return res.status(400).json({ error: "분석할 태스크가 없습니다." });
  }
  try {
    res.json(await runConsulting(items));
  } catch (err) {
    console.error("[/api/consult] 분석 실패:", err);
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "분석 중 오류가 발생했습니다." });
  }
}
