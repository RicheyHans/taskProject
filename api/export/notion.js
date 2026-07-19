// Vercel 서버리스 함수: 컨설팅 결과를 Notion 페이지로 내보낸다. → POST /api/export/notion
import { createConsultingPage } from "../../server/notion.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
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
}
