// Vercel 서버리스 함수: [2] 테스트 샘플 컨설팅 결과. → POST /api/consult/sample
import { buildConsultingSample } from "../../server/sample.js";

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  res.json(buildConsultingSample());
}
