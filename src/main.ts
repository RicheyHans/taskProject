import "./style.css";
import {
  fetchHierarchy,
  appendProject,
  SPREADSHEET_URL,
  type CategoryNode,
  type ProjectNode,
} from "./sheet";
import {
  openConsulting,
  confirmDialog,
  openResult,
  type TaskItem,
  type ConsultingResult,
} from "./consult";
import { renderProjectForm } from "./project-form";

const menuEl = document.getElementById("menu") as HTMLElement;
const contentEl = document.getElementById("content-body") as HTMLElement;
const stateEl = document.getElementById("state");
const appEl = document.getElementById("app") as HTMLElement;
const homeBtn = document.getElementById("home-btn");
const historyEl = document.getElementById("history") as HTMLElement;

/** 현재 선택된 프로젝트 컨텍스트 ([1] 컨설팅 분석 대상) */
let currentCtx: { category: string; project: ProjectNode } | null = null;

/** 한 프로젝트의 태스크를 분석용 평면 목록으로 만든다. */
function flattenProject(category: string, project: ProjectNode): TaskItem[] {
  return project.tasks.map((t) => ({
    category,
    project: project.project,
    task: t.task,
    description: t.description,
    issue: t.issue,
  }));
}

interface HistoryRecord {
  no: number;
  datetime: string;
  result: ConsultingResult;
}

/** 컨설팅 내역 1건을 서버에 저장한다. */
async function postHistory(
  category: string,
  project: string,
  result: ConsultingResult,
): Promise<void> {
  try {
    await fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, project, result }),
    });
  } catch (err) {
    console.error("컨설팅 내역 저장 실패:", err);
  }
}

/** 현재 프로젝트의 컨설팅 내역을 렌더한다. */
async function renderHistory(category: string, project: string): Promise<void> {
  if (!historyEl) return;
  historyEl.innerHTML = "";
  historyEl.appendChild(el("h3", "history__title", "컨설팅 내역"));

  let records: HistoryRecord[] = [];
  try {
    const res = await fetch(
      `/api/history?category=${encodeURIComponent(category)}&project=${encodeURIComponent(project)}`,
    );
    if (res.ok) records = ((await res.json()).records as HistoryRecord[]) || [];
  } catch (err) {
    console.error(err);
  }

  if (records.length === 0) {
    historyEl.appendChild(
      el(
        "p",
        "history__empty",
        "아직 저장된 컨설팅 내역이 없습니다. [자동화 컨설팅 받기]로 생성하면 여기에 기록됩니다.",
      ),
    );
    return;
  }

  const table = el("table", "history__table");
  const thead = el("thead", "");
  const htr = el("tr", "");
  htr.append(el("th", "", "NO."), el("th", "", "일시"), el("th", "", "보기"));
  thead.appendChild(htr);
  const tbody = el("tbody", "");

  // 최신이 위로
  for (const rec of [...records].reverse()) {
    const tr = el("tr", "");
    tr.appendChild(el("td", "history__no", String(rec.no)));
    tr.appendChild(
      el("td", "history__date", new Date(rec.datetime).toLocaleString("ko-KR")),
    );
    const actions = el("td", "history__actions");
    const viewBtn = el("button", "history__view", "컨설팅 내역 보기");
    viewBtn.type = "button";
    viewBtn.addEventListener("click", () => openResult(rec.result));
    actions.appendChild(viewBtn);
    tr.appendChild(actions);
    tbody.appendChild(tr);
  }
  table.append(thead, tbody);
  historyEl.appendChild(table);
}

/** 텍스트를 안전하게 담은 DOM 요소를 만든다. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 현재 선택된(강조된) 프로젝트 버튼 */
let activeProjectBtn: HTMLElement | null = null;

/** 좌측 메뉴를 시트에서 다시 불러와 새로 그린다. (실패해도 조용히 무시) */
async function refreshMenu(): Promise<void> {
  try {
    renderMenu(await fetchHierarchy());
  } catch (err) {
    console.error("메뉴 새로고침 실패:", err);
  }
}

/** HOME 화면: 히어로 + 새 프로젝트 입력 폼을 그린다. */
function renderHome(): void {
  contentEl.innerHTML = "";

  // ── 히어로 ──
  const hero = el("section", "hero");
  hero.appendChild(el("span", "hero__eyebrow", "AUTOMATION CONSULTING"));
  hero.appendChild(
    el("h1", "hero__title", "반복 업무를 자동화 기회로 바꾸세요"),
  );
  hero.appendChild(
    el(
      "p",
      "hero__lead",
      "프로젝트와 태스크를 등록하면, AI가 업무를 분석해 구체적인 자동화 방안을 제안합니다. PDF · Notion · Slack · Gmail로 바로 공유하세요.",
    ),
  );
  contentEl.appendChild(hero);

  // ── 입력 폼(별도 마운트 컨테이너: 성공 시 폼만 리셋되고 히어로는 유지) ──
  const formMount = el("div", "home-form");
  contentEl.appendChild(formMount);
  renderProjectForm(formMount, {
    onSubmit: async (data) => {
      const appended = await appendProject(data); // 실패 시 throw → 폼이 에러 표시
      // 저장 성공: 프로젝트 목록을 새로고침해 방금 추가한 프로젝트를 반영한다.
      await refreshMenu();
      return { appended };
    },
  });
}

/** HOME으로 이동한다. (펼친 카테고리는 그대로 유지) */
function goHome(): void {
  if (activeProjectBtn) {
    activeProjectBtn.classList.remove("is-active");
    activeProjectBtn.setAttribute("aria-current", "false");
    activeProjectBtn = null;
  }
  currentCtx = null;
  homeBtn?.classList.add("is-active");
  appEl.classList.remove("app--project"); // 하단 컨설팅 버튼 숨김
  renderHome();
}

/** 본문에 선택한 프로젝트의 태스크 흐름을 그린다. */
function renderTasks(category: string, project: ProjectNode): void {
  contentEl.innerHTML = "";

  // 브레드크럼: 홈으로 돌아가는 경로 표시
  const crumb = el("nav", "crumb");
  crumb.setAttribute("aria-label", "위치");
  const backBtn = el("button", "crumb__home", "← 홈");
  backBtn.type = "button";
  backBtn.addEventListener("click", goHome);
  crumb.appendChild(backBtn);
  crumb.appendChild(el("span", "crumb__sep", "/"));
  crumb.appendChild(el("span", "crumb__cat", category));
  contentEl.appendChild(crumb);

  const head = el("header", "content__head");
  head.appendChild(el("h2", "content__title", project.project));
  head.appendChild(el("p", "content__meta", `${category} · 태스크 ${project.tasks.length}개`));
  contentEl.appendChild(head);

  if (project.tasks.length === 0) {
    contentEl.appendChild(el("div", "placeholder", "태스크가 없습니다."));
    return;
  }

  const flow = el("div", "flow");
  project.tasks.forEach((t, i) => {
    // 태스크 사이마다 아래 방향 화살표를 넣는다(첫 태스크 앞에는 없음).
    if (i > 0) {
      const arrow = el("div", "flow__arrow", "↓");
      arrow.setAttribute("aria-hidden", "true");
      flow.appendChild(arrow);
    }
    const card = el("article", "task");
    card.appendChild(el("h3", "task__name", t.task));
    card.appendChild(el("p", "task__desc", t.description || "설명 없음"));
    // issue: description의 하위 항목. 값이 있을 때만 아래에 들여쓰기된 박스로 표시.
    if (t.issue) {
      const issue = el("div", "task__issue");
      issue.appendChild(el("span", "task__issue-label", "이슈"));
      issue.appendChild(el("p", "task__issue-text", t.issue));
      card.appendChild(issue);
    }
    flow.appendChild(card);
  });
  contentEl.appendChild(flow);
}

/** 프로젝트 선택: 강조 표시를 옮기고 본문을 갱신한다. */
function selectProject(
  btn: HTMLElement,
  category: string,
  project: ProjectNode,
): void {
  if (activeProjectBtn && activeProjectBtn !== btn) {
    activeProjectBtn.classList.remove("is-active");
    activeProjectBtn.setAttribute("aria-current", "false");
  }
  btn.classList.add("is-active");
  btn.setAttribute("aria-current", "true");
  activeProjectBtn = btn;
  currentCtx = { category, project };
  homeBtn?.classList.remove("is-active");
  appEl.classList.add("app--project"); // 하단 컨설팅 버튼 노출
  renderTasks(category, project);
  void renderHistory(category, project.project);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/** 카테고리 하나(토글 + 프로젝트 목록)를 만든다. */
function renderCategory(node: CategoryNode): HTMLElement {
  const cat = el("div", "cat");

  const toggle = el("button", "cat__toggle");
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.append(
    el("span", "cat__label", node.category),
    el("span", "cat__caret", "▸"),
  );

  // 접힘/펼침 애니메이션을 위한 grid 0fr↔1fr 구조(inner 필요).
  const projects = el("div", "cat__projects");
  const inner = el("div", "cat__projects-inner");

  if (node.projects.length === 0) {
    inner.appendChild(el("div", "cat__empty", "프로젝트 없음"));
  } else {
    for (const project of node.projects) {
      const pbtn = el("button", "proj");
      pbtn.type = "button";
      pbtn.appendChild(el("span", "proj__label", project.project));
      pbtn.addEventListener("click", () =>
        selectProject(pbtn, node.category, project),
      );
      inner.appendChild(pbtn);
    }
  }
  projects.appendChild(inner);

  // 여러 카테고리를 동시에 열어둘 수 있도록 각자 독립 토글한다.
  toggle.addEventListener("click", () => {
    const open = cat.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  cat.append(toggle, projects);
  return cat;
}

/** 좌측 메뉴를 그린다. */
function renderMenu(data: CategoryNode[]): void {
  menuEl.innerHTML = "";
  if (data.length === 0) {
    menuEl.appendChild(el("div", "state", "표시할 카테고리가 없습니다."));
    return;
  }
  for (const node of data) {
    menuEl.appendChild(renderCategory(node));
  }
}

function showError(message: string): void {
  menuEl.innerHTML = "";
  const box = el("div", "state state--error");
  box.appendChild(el("div", "state__title", "데이터를 불러오지 못했습니다"));
  box.appendChild(el("div", "state__detail", message));
  box.appendChild(
    el(
      "div",
      "state__hint",
      "스프레드시트가 '링크가 있는 모든 사용자에게 공개'로 설정되어 있는지 확인하세요.",
    ),
  );
  menuEl.appendChild(box);
}

/** 하단 자동화 컨설팅 버튼을 연결한다. */
function wireConsultButtons(): void {
  const consultBtn = document.getElementById("btn-consult");
  const testBtn = document.getElementById("btn-consult-test");

  // [1] 실제: 현재 프로젝트의 태스크를 Claude로 분석 (Anthropic 키가 있어야 활성)
  consultBtn?.addEventListener("click", async () => {
    // 클릭 시 무조건 토큰 소모 확인 팝업(커스텀)을 띄운다.
    const ok = await confirmDialog(
      "컨설팅을 받으면 API 토큰이 소모됩니다.\n진행하시겠습니까?",
    );
    if (!ok) return; // 취소: 아무 동작 안 함

    if (!currentCtx || currentCtx.project.tasks.length === 0) {
      window.alert(
        "이 프로젝트에는 분석할 태스크가 없습니다.\n태스크가 있는 프로젝트를 선택한 뒤 다시 시도해 주세요.",
      );
      return;
    }
    const ctx = currentCtx;
    const result = await openConsulting(
      "real",
      flattenProject(ctx.category, ctx.project),
    );
    // 성공 시 내역 저장 후, 같은 프로젝트를 보고 있으면 내역 갱신
    if (result) {
      await postHistory(ctx.category, ctx.project.project, result);
      if (currentCtx && currentCtx.project === ctx.project) {
        void renderHistory(ctx.category, ctx.project.project);
      }
    }
  });

  // [2] 테스트: 샘플 결과를 동일한 방식으로 표시 (커넥터 테스트용)
  testBtn?.addEventListener("click", () => {
    void openConsulting("sample");
  });

  // HOME 버튼 / 브랜드 로고: 언제든 홈으로 복귀. 초기 상태도 HOME.
  homeBtn?.addEventListener("click", goHome);
  homeBtn?.classList.add("is-active");
  document.getElementById("brand-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    goHome();
  });

  // 프로젝트 입력: 원본 스프레드시트를 새 탭으로 연다.
  document.getElementById("sheet-btn")?.addEventListener("click", () => {
    window.open(SPREADSHEET_URL, "_blank", "noopener");
  });
}

async function init(): Promise<void> {
  try {
    const data = await fetchHierarchy();
    renderMenu(data);
  } catch (err) {
    console.error(err);
    showError(err instanceof Error ? err.message : String(err));
  } finally {
    stateEl?.remove();
  }
}

wireConsultButtons();
renderHome(); // 초기 HOME 화면 = 새 프로젝트 입력 폼
init();
