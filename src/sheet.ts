/**
 * Google Spreadsheet를 데이터베이스로 사용하는 데이터 레이어.
 *
 * 공개된 시트의 gviz CSV 엔드포인트를 사용한다. 이 엔드포인트는
 * 요청 Origin에 대해 CORS(Access-Control-Allow-Origin)를 허용하므로
 * 별도의 서버/API 키 없이 브라우저에서 직접 fetch 할 수 있다.
 */

/** 스프레드시트 문서 ID */
export const SPREADSHEET_ID = "1L_Xvr_mow0olekd8mAE11rETtARNW-89vVDR8mFK2uY";

/** 읽어올 시트 gid (첫 번째 시트 = 0) */
export const SHEET_GID = "0";

/** 원본 스프레드시트 편집 URL ('프로젝트 입력' 메뉴에서 새 탭으로 연다) */
export const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit?gid=${SHEET_GID}`;

/** category -> project -> task[] 계층 구조 */
export interface CategoryNode {
  category: string;
  projects: ProjectNode[];
}

export interface ProjectNode {
  project: string;
  tasks: TaskNode[];
}

/** 태스크 한 건: 이름 + 설명(description) + 이슈(issue, description의 하위) */
export interface TaskNode {
  task: string;
  description: string;
  issue: string;
}

/** gviz CSV 엔드포인트 URL을 만든다. (매 호출마다 캐시 무효화 파라미터 부여) */
function buildCsvUrl(): string {
  const base = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq`;
  const params = new URLSearchParams({ tqx: "out:csv", gid: SHEET_GID });
  // 시트에 값을 추가한 직후 새로고침할 때 옛 데이터가 캐시되지 않도록 유니크 값을 붙인다.
  params.set("_", String(Date.now()));
  return `${base}?${params.toString()}`;
}

/** HOME 폼에서 입력한 태스크들 */
export interface NewTaskInput {
  task: string;
  description: string;
  issue: string;
}

/**
 * 새 프로젝트(카테고리·프로젝트 + 태스크들)를 로컬 API 서버를 통해
 * 시트에 추가한다. 성공 시 추가된 행 수를 반환한다.
 */
export async function appendProject(payload: {
  category: string;
  project: string;
  tasks: NewTaskInput[];
}): Promise<number> {
  const res = await fetch("/api/sheet/append", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `요청 실패 (HTTP ${res.status})`);
  }
  return Number(data.appended) || payload.tasks.length;
}

/**
 * 아주 작은 CSV 파서. RFC 4180 스타일의 따옴표/이스케이프("")와
 * 줄바꿈을 처리한다. gviz의 출력 형식에 맞춰져 있다.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++; // 이스케이프된 따옴표
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      // \r\n 은 \r 에서 필드/행을 마감하고 \n 은 건너뛴다.
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else {
      field += char;
    }
  }

  // 마지막 필드/행 마감 (파일 끝에 개행이 없을 때)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * CSV 행들을 category > project > task 계층 구조로 변환한다.
 * 중복된 category/project 는 하나로 합쳐진다(요구사항: 중복 표시 X).
 */
export function buildHierarchy(rows: string[][]): CategoryNode[] {
  if (rows.length === 0) return [];

  // 헤더에서 각 열의 인덱스를 찾는다(열 순서가 바뀌어도 안전하게).
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const catIdx = indexOf(header, "category", 0);
  const projIdx = indexOf(header, "project", 1);
  const taskIdx = indexOf(header, "task", 2);
  const descIdx = indexOf(header, "description", 3);
  const issueIdx = indexOf(header, "issue", 4);

  const categoryOrder: string[] = [];
  // category -> project -> (taskName -> {description, issue}). 중첩 Map 으로 삽입 순서와 dedup 을 함께 처리한다.
  const categoryMap = new Map<
    string,
    Map<string, Map<string, { description: string; issue: string }>>
  >();

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const category = (cells[catIdx] ?? "").trim();
    const project = (cells[projIdx] ?? "").trim();
    const task = (cells[taskIdx] ?? "").trim();
    const description = (cells[descIdx] ?? "").trim();
    const issue = (cells[issueIdx] ?? "").trim();

    if (!category) continue; // 빈 행 무시

    if (!categoryMap.has(category)) {
      categoryMap.set(category, new Map());
      categoryOrder.push(category);
    }
    const projectMap = categoryMap.get(category)!;

    if (project) {
      if (!projectMap.has(project)) projectMap.set(project, new Map());
      const taskMap = projectMap.get(project)!;
      // 같은 task 이름이 중복되면 첫 값을 유지한다.
      if (task && !taskMap.has(task)) taskMap.set(task, { description, issue });
    }
  }

  return categoryOrder.map((category) => {
    const projectMap = categoryMap.get(category)!;
    const projects: ProjectNode[] = [];
    for (const [project, taskMap] of projectMap) {
      const tasks: TaskNode[] = [];
      for (const [task, meta] of taskMap) {
        tasks.push({ task, description: meta.description, issue: meta.issue });
      }
      projects.push({ project, tasks });
    }
    return { category, projects };
  });
}

function indexOf(header: string[], name: string, fallback: number): number {
  const idx = header.indexOf(name);
  return idx === -1 ? fallback : idx;
}

/** 시트를 가져와 계층 구조로 반환한다. */
export async function fetchHierarchy(): Promise<CategoryNode[]> {
  const res = await fetch(buildCsvUrl(), { redirect: "follow", cache: "no-store" });
  if (!res.ok) {
    throw new Error(`시트를 불러오지 못했습니다 (HTTP ${res.status}).`);
  }
  const csv = await res.text();
  return buildHierarchy(parseCsv(csv));
}
