// Vercel 서버리스 함수: HOME 입력 폼 → 새 프로젝트(태스크들)를 시트에 append. → POST /api/sheet/append
import { appendRows } from "../../server/sheet-write.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const { category, project, tasks } = req.body || {};
  const cat = typeof category === "string" ? category.trim() : "";
  const proj = typeof project === "string" ? project.trim() : "";
  if (!cat || !proj) {
    return res.status(400).json({ error: "카테고리와 프로젝트 이름을 입력하세요." });
  }
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: "최소 1개의 태스크가 필요합니다." });
  }
  const rows = tasks.map((t) => [
    cat,
    proj,
    typeof t?.task === "string" ? t.task.trim() : "",
    typeof t?.description === "string" ? t.description.trim() : "",
    typeof t?.issue === "string" ? t.issue.trim() : "",
  ]);
  if (rows.some((r) => !r[2])) {
    return res.status(400).json({ error: "모든 태스크에는 이름이 필요합니다." });
  }
  try {
    const { appended } = await appendRows(rows);
    res.json({ ok: true, appended });
  } catch (err) {
    console.error("[/api/sheet/append] 실패:", err);
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "시트 저장 실패." });
  }
}
