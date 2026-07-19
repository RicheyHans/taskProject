// Vercel 서버리스 함수: 컨설팅 결과를 Slack으로 전송한다. → POST /api/export/slack
import { sendToSlack } from "../../server/slack.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
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
}
