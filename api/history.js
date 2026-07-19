// Vercel 서버리스 함수: 컨설팅 내역 조회/저장. → GET·POST /api/history
//  ⚠️ 서버리스 환경에서는 파일 저장(history.js)이 인스턴스별 임시 저장(/tmp)이라
//     영구 보관되지 않는다(재배포·콜드스타트 시 초기화). 영구 보관하려면 외부 저장소 필요.
import { listHistory, addHistory } from "../server/history.js";

export default function handler(req, res) {
  if (req.method === "GET") {
    const { category, project } = req.query || {};
    if (!category || !project) {
      return res.status(400).json({ error: "category/project 가 필요합니다." });
    }
    return res.json({ records: listHistory(String(category), String(project)) });
  }

  if (req.method === "POST") {
    const { category, project, result } = req.body || {};
    if (!category || !project || !result || !Array.isArray(result.items)) {
      return res.status(400).json({ error: "잘못된 요청입니다." });
    }
    try {
      const record = addHistory(category, project, result);
      return res.json({ record });
    } catch (err) {
      console.error("[/api/history] 저장 실패:", err);
      return res
        .status(500)
        .json({ error: err instanceof Error ? err.message : "내역 저장 실패." });
    }
  }

  res.status(405).json({ error: "Method Not Allowed" });
}
