// HOME 화면의 "새 프로젝트 입력" 폼.
//  - 카테고리 / 프로젝트 이름을 한 번 입력하고,
//  - 태스크(이름 + 설명 + 이슈)를 1개 이상 입력한다(설명·이슈는 선택).
//  - "태스크 추가"로 원하는 만큼 늘릴 수 있다.
//  - 제출하면 onSubmit(입력값)이 호출되고, 성공하면 폼을 초기화한다.
import type { NewTaskInput } from "./sheet";

export interface ProjectFormData {
  category: string;
  project: string;
  tasks: NewTaskInput[];
}

/** onSubmit: 저장 로직. 성공 시 resolve, 실패 시 throw(에러 메시지 표시). */
export interface ProjectFormOptions {
  onSubmit: (data: ProjectFormData) => Promise<{ appended: number }>;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 라벨 + 컨트롤 한 줄(field)을 만든다. */
function field(
  labelText: string,
  control: HTMLElement,
  hint?: string,
): HTMLElement {
  const wrap = el("div", "pf__field");
  const label = el("label", "pf__label", labelText);
  label.htmlFor = (control as HTMLInputElement).id;
  wrap.appendChild(label);
  if (hint) wrap.appendChild(el("span", "pf__hint", hint));
  wrap.appendChild(control);
  return wrap;
}

let taskSeq = 0;

/** 태스크 카드 한 개를 만든다. remove 콜백은 카드가 2개 이상일 때만 노출. */
function makeTaskCard(index: number, onRemove: (card: HTMLElement) => void): HTMLElement {
  const id = `pf-task-${++taskSeq}`;
  const card = el("div", "pf-task");
  card.dataset.taskCard = "1";

  const head = el("div", "pf-task__head");
  head.appendChild(el("span", "pf-task__num", `태스크 ${index}`));
  const removeBtn = el("button", "pf-task__remove", "삭제");
  removeBtn.type = "button";
  removeBtn.addEventListener("click", () => onRemove(card));
  head.appendChild(removeBtn);
  card.appendChild(head);

  const name = el("input", "pf__control", undefined) as HTMLInputElement;
  name.type = "text";
  name.id = `${id}-name`;
  name.placeholder = "예: 주간 보고서 작성";
  name.dataset.role = "task";
  card.appendChild(field("태스크 이름 *", name));

  const desc = el("textarea", "pf__control pf__control--area") as HTMLTextAreaElement;
  desc.id = `${id}-desc`;
  desc.rows = 2;
  desc.placeholder = "이 태스크가 무엇인지 설명 (선택)";
  desc.dataset.role = "description";
  card.appendChild(field("설명", desc, "선택 입력"));

  const issue = el("textarea", "pf__control pf__control--area") as HTMLTextAreaElement;
  issue.id = `${id}-issue`;
  issue.rows = 2;
  issue.placeholder = "현재 겪는 이슈/불편 (선택)";
  issue.dataset.role = "issue";
  card.appendChild(field("이슈", issue, "선택 입력"));

  return card;
}

/** 폼을 container 안에 렌더한다. */
export function renderProjectForm(
  container: HTMLElement,
  opts: ProjectFormOptions,
): void {
  container.innerHTML = "";
  taskSeq = 0;

  const form = el("form", "pf");
  form.setAttribute("novalidate", "");

  const head = el("div", "pf__head");
  head.appendChild(el("h2", "pf__title", "새 프로젝트 등록"));
  head.appendChild(
    el(
      "p",
      "pf__subtitle",
      "카테고리와 프로젝트 이름을 정하고 태스크를 추가하세요. 등록하면 자동화 컨설팅 대상 목록에 추가됩니다.",
    ),
  );
  form.appendChild(head);

  // ── 카테고리 / 프로젝트 ──
  const meta = el("div", "pf__meta");
  const category = el("input", "pf__control") as HTMLInputElement;
  category.type = "text";
  category.id = "pf-category";
  category.placeholder = "예: 관리 업무";
  const project = el("input", "pf__control") as HTMLInputElement;
  project.type = "text";
  project.id = "pf-project";
  project.placeholder = "예: 프로젝트 일정표 작성";
  meta.appendChild(field("카테고리 *", category));
  meta.appendChild(field("프로젝트 *", project));
  form.appendChild(meta);

  // ── 태스크 목록 ──
  const tasksWrap = el("div", "pf__tasks");
  const tasksHead = el("div", "pf__tasks-head");
  tasksHead.appendChild(el("h3", "pf__tasks-title", "태스크"));
  tasksWrap.appendChild(tasksHead);
  const tasksList = el("div", "pf__tasks-list");
  tasksWrap.appendChild(tasksList);
  form.appendChild(tasksWrap);

  // 태스크 카드가 1개면 삭제 버튼을 숨긴다(최소 1개 유지) + 번호 다시 매김.
  const refreshTasks = (): void => {
    const cards = Array.from(
      tasksList.querySelectorAll<HTMLElement>("[data-task-card]"),
    );
    cards.forEach((card, i) => {
      const num = card.querySelector<HTMLElement>(".pf-task__num");
      if (num) num.textContent = `태스크 ${i + 1}`;
      const removeBtn = card.querySelector<HTMLButtonElement>(".pf-task__remove");
      if (removeBtn) removeBtn.style.display = cards.length > 1 ? "" : "none";
    });
  };

  const removeCard = (card: HTMLElement): void => {
    if (tasksList.querySelectorAll("[data-task-card]").length <= 1) return;
    card.remove();
    refreshTasks();
  };

  const addCard = (): HTMLElement => {
    const count = tasksList.querySelectorAll("[data-task-card]").length;
    const card = makeTaskCard(count + 1, removeCard);
    tasksList.appendChild(card);
    refreshTasks();
    return card;
  };

  // 기본 1개
  addCard();

  const addBtn = el("button", "pf__add", "+ 태스크 추가");
  addBtn.type = "button";
  addBtn.addEventListener("click", () => {
    const card = addCard();
    card.querySelector<HTMLInputElement>("input[data-role='task']")?.focus();
  });
  tasksWrap.appendChild(addBtn);

  // ── 상태 메시지 + 제출 ──
  const message = el("div", "pf__message");
  message.setAttribute("role", "status");
  form.appendChild(message);

  const actions = el("div", "pf__actions");
  const submit = el("button", "pf__submit", "입력 완료");
  submit.type = "submit";
  actions.appendChild(submit);
  form.appendChild(actions);

  const setMessage = (text: string, kind: "" | "error" | "success"): void => {
    message.textContent = text;
    message.className = "pf__message" + (kind ? ` pf__message--${kind}` : "");
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMessage("", "");

    const cat = category.value.trim();
    const proj = project.value.trim();
    if (!cat) {
      setMessage("카테고리 이름을 입력하세요.", "error");
      category.focus();
      return;
    }
    if (!proj) {
      setMessage("프로젝트 이름을 입력하세요.", "error");
      project.focus();
      return;
    }

    const cards = Array.from(
      tasksList.querySelectorAll<HTMLElement>("[data-task-card]"),
    );
    const tasks: NewTaskInput[] = [];
    for (const card of cards) {
      const name = card.querySelector<HTMLInputElement>("input[data-role='task']");
      const desc = card.querySelector<HTMLTextAreaElement>("textarea[data-role='description']");
      const issue = card.querySelector<HTMLTextAreaElement>("textarea[data-role='issue']");
      const taskName = (name?.value || "").trim();
      const description = (desc?.value || "").trim();
      const issueText = (issue?.value || "").trim();

      // 이름 없이 설명/이슈만 있으면 실수일 가능성 → 알린다.
      if (!taskName && (description || issueText)) {
        setMessage("설명/이슈를 입력한 태스크에는 이름이 필요합니다.", "error");
        name?.focus();
        return;
      }
      if (taskName) tasks.push({ task: taskName, description, issue: issueText });
    }

    if (tasks.length === 0) {
      setMessage("최소 1개의 태스크 이름을 입력하세요.", "error");
      cards[0]?.querySelector<HTMLInputElement>("input[data-role='task']")?.focus();
      return;
    }

    submit.disabled = true;
    addBtn.disabled = true;
    const original = submit.textContent;
    submit.textContent = "저장 중…";
    try {
      const { appended } = await opts.onSubmit({ category: cat, project: proj, tasks });
      // 성공: 폼 리셋(다시 그리기)
      renderProjectForm(container, opts);
      const freshMsg = container.querySelector<HTMLElement>(".pf__message");
      if (freshMsg) {
        freshMsg.textContent = `저장 완료! "${proj}"에 태스크 ${appended}개를 시트에 추가했습니다.`;
        freshMsg.className = "pf__message pf__message--success";
      }
    } catch (err) {
      submit.disabled = false;
      addBtn.disabled = false;
      submit.textContent = original;
      setMessage(err instanceof Error ? err.message : String(err), "error");
    }
  });

  container.appendChild(form);
}
