// 프로젝트별 컨설팅 내역을 로컬 JSON 파일에 저장한다.
// (API로 생성한 [1] 실제 컨설팅 결과가 사라지지 않도록 영구 보관)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// 로컬(Express)에서는 server/history.json 에 영구 저장.
// Vercel 서버리스에서는 프로젝트 파일시스템이 읽기 전용이므로 쓰기 가능한 /tmp 사용
// (인스턴스별 임시 저장 — 영구 보관되지 않음).
const FILE = process.env.VERCEL
  ? "/tmp/history.json"
  : join(dirname(fileURLToPath(import.meta.url)), "history.json");

/** 프로젝트 식별 키 */
function keyOf(category, project) {
  return `${category}|||${project}`;
}

function loadAll() {
  try {
    return JSON.parse(readFileSync(FILE, "utf8"));
  } catch {
    return {}; // 파일 없음/파싱 실패 시 빈 저장소
  }
}

function saveAll(data) {
  try {
    writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    // 읽기 전용 FS 등에서 저장 실패해도 요청 자체는 성공 처리(내역만 미보관).
    console.error("[history] 저장 실패(무시):", err instanceof Error ? err.message : err);
  }
}

/** 한 프로젝트의 내역 목록(오래된→최신) */
export function listHistory(category, project) {
  const all = loadAll();
  return all[keyOf(category, project)] || [];
}

/** 한 프로젝트에 컨설팅 결과 1건 추가. NO는 1부터 증가, 일시는 서버 기준. */
export function addHistory(category, project, result) {
  const all = loadAll();
  const k = keyOf(category, project);
  const list = all[k] || [];
  const no = list.reduce((max, r) => Math.max(max, r.no || 0), 0) + 1;
  const record = { no, datetime: new Date().toISOString(), result };
  list.push(record);
  all[k] = list;
  saveAll(all);
  return record;
}
