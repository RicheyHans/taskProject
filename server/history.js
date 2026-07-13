// 프로젝트별 컨설팅 내역을 로컬 JSON 파일에 저장한다.
// (API로 생성한 [1] 실제 컨설팅 결과가 사라지지 않도록 영구 보관)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const FILE = join(dirname(fileURLToPath(import.meta.url)), "history.json");

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
  writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
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
