// 자동화 컨설팅 모달: 서버(/api)에서 결과를 받아 "컨설팅 문서" 스타일로 보여주고,
// 하단에서 PDF/Notion/Slack/Gmail 로 내보낸다. (현재 PDF만 배선됨)

export interface ConsultingItem {
  category: string;
  project: string;
  task: string;
  summary: string;
  issue: string;
  proposals: string[];
  effect: string;
  difficulty: string;
  priority: string;
}

export interface ConsultingResult {
  title: string;
  sample: boolean;
  intro: string;
  items: ConsultingItem[];
}

export interface TaskItem {
  category: string;
  project: string;
  task: string;
  description: string;
  issue: string;
}

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

/**
 * 커스텀 확인 다이얼로그(기본 confirm 대체). 확인=true, 취소/닫기=false.
 * 유료 동작이므로 기본 포커스는 '취소'에 둔다(실수 방지).
 */
export function confirmDialog(
  message: string,
  opts: { confirmText?: string; cancelText?: string } = {},
): Promise<boolean> {
  const { confirmText = "확인", cancelText = "취소" } = opts;
  return new Promise((resolve) => {
    const ov = el("div", "dialog-overlay");
    const box = el("div", "dialog");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");

    const icon = el("div", "dialog__icon");
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML =
      '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16.4h.01"/></svg>';

    const msg = el("p", "dialog__msg", message);
    const actions = el("div", "dialog__actions");
    const cancel = el("button", "dialog__btn dialog__btn--cancel", cancelText);
    const confirm = el("button", "dialog__btn dialog__btn--confirm", confirmText);
    cancel.type = "button";
    confirm.type = "button";

    let done = false;
    const close = (v: boolean): void => {
      if (done) return;
      done = true;
      document.removeEventListener("keydown", onKey);
      ov.remove();
      resolve(v);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") close(false);
    };

    cancel.addEventListener("click", () => close(false));
    confirm.addEventListener("click", () => close(true));
    ov.addEventListener("click", (e) => {
      if (e.target === ov) close(false);
    });
    document.addEventListener("keydown", onKey);

    actions.append(cancel, confirm);
    box.append(icon, msg, actions);
    ov.appendChild(box);
    document.body.appendChild(ov);
    cancel.focus(); // 유료 동작: 기본 포커스는 취소
  });
}

let overlay: HTMLElement | null = null;

function closeModal(): void {
  overlay?.remove();
  overlay = null;
  document.removeEventListener("keydown", onKeydown);
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === "Escape") closeModal();
}

/** 모달 뼈대(오버레이 + 문서 영역 + 액션)를 만들어 body 에 붙인다. */
function openShell(): { body: HTMLElement } {
  closeModal();
  overlay = el("div", "modal-overlay");
  const modal = el("div", "modal");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  const close = el("button", "modal__close", "×");
  close.type = "button";
  close.setAttribute("aria-label", "닫기");
  close.addEventListener("click", closeModal);

  const body = el("div", "modal__body");

  modal.append(close, body);
  overlay.appendChild(modal);
  // 오버레이 바깥(문서 영역 밖) 클릭 시 닫기
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  document.body.appendChild(overlay);
  document.addEventListener("keydown", onKeydown);
  return { body };
}

/** 로딩 화면(스피너 + 진행률 바 + 퍼센트)을 그리고 제어 핸들을 반환한다. */
function renderLoading(body: HTMLElement): { stop: () => void; finish: () => void } {
  body.innerHTML = "";
  const wrap = el("div", "loading");
  const spinner = el("div", "loading__spinner");
  spinner.setAttribute("aria-hidden", "true");
  const title = el("p", "loading__title", "Claude가 분석 중입니다…");
  const bar = el("div", "loading__bar");
  const fill = el("div", "loading__bar-fill");
  bar.appendChild(fill);
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  const pct = el("div", "loading__pct", "0%");
  wrap.append(spinner, title, bar, pct);
  body.appendChild(wrap);

  let value = 0;
  const setValue = (v: number) => {
    value = v;
    fill.style.width = v.toFixed(1) + "%";
    pct.textContent = Math.round(v) + "%";
    bar.setAttribute("aria-valuenow", String(Math.round(v)));
  };
  setValue(0);

  // 실제 진행률을 알 수 없으므로 92%까지 점근하며 증가(활동 표시).
  const timer = window.setInterval(() => {
    if (!fill.isConnected) {
      window.clearInterval(timer);
      return;
    }
    const target = 92;
    const next = value + Math.max(0.4, (target - value) * 0.06);
    setValue(next > target ? target : next);
  }, 180);

  return {
    stop: () => window.clearInterval(timer),
    finish: () => {
      window.clearInterval(timer);
      setValue(100);
    },
  };
}

function renderError(body: HTMLElement, message: string): void {
  body.innerHTML = "";
  const box = el("div", "modal__state modal__state--error");
  box.appendChild(el("div", "modal__state-title", "요청을 처리하지 못했습니다"));
  box.appendChild(el("div", "modal__state-detail", message));
  body.appendChild(box);
}

/** 현재 컨설팅 결과를 Notion 페이지로 내보낸다. 성공 시 생성된 페이지 URL 반환. */
async function exportToNotion(
  btn: HTMLButtonElement,
  result: ConsultingResult,
): Promise<string | null> {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Notion으로 보내는 중…";
  try {
    const res = await fetch("/api/export/notion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result, stamp: new Date().toLocaleString("ko-KR") }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `요청 실패 (HTTP ${res.status})`);
    // 성공: 버튼을 "열기" 링크로 바꾸고 새 탭으로 연다.
    btn.disabled = false;
    btn.textContent = "Notion에서 열기 ↗";
    window.open(data.url, "_blank", "noopener");
    return data.url as string;
  } catch (err) {
    btn.disabled = false;
    btn.textContent = original;
    window.alert(`Notion 전송 실패:\n${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/** 현재 컨설팅 결과를 Slack으로 전송한다. */
async function exportToSlack(btn: HTMLButtonElement, result: ConsultingResult): Promise<void> {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Slack으로 보내는 중…";
  try {
    const res = await fetch("/api/export/slack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result, stamp: new Date().toLocaleString("ko-KR") }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `요청 실패 (HTTP ${res.status})`);
    btn.disabled = false;
    btn.textContent = "Slack 전송 완료 ✓";
  } catch (err) {
    btn.disabled = false;
    btn.textContent = original;
    window.alert(`Slack 전송 실패:\n${err instanceof Error ? err.message : String(err)}`);
  }
}

/** 현재 컨설팅 결과를 Gmail로 전송한다. */
async function exportToGmail(btn: HTMLButtonElement, result: ConsultingResult): Promise<void> {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "메일 보내는 중…";
  try {
    const res = await fetch("/api/export/gmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result, stamp: new Date().toLocaleString("ko-KR") }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `요청 실패 (HTTP ${res.status})`);
    btn.disabled = false;
    btn.textContent = "메일 전송 완료 ✓";
  } catch (err) {
    btn.disabled = false;
    btn.textContent = original;
    window.alert(`Gmail 전송 실패:\n${err instanceof Error ? err.message : String(err)}`);
  }
}

/** 결과를 컨설팅 문서 + 액션 버튼으로 렌더 */
function renderResult(body: HTMLElement, result: ConsultingResult): void {
  body.innerHTML = "";

  const doc = el("article", "doc");

  const head = el("header", "doc__head");
  const titleRow = el("div", "doc__title-row");
  titleRow.appendChild(el("h1", "doc__title", result.title));
  if (result.sample) titleRow.appendChild(el("span", "doc__badge", "SAMPLE"));
  head.appendChild(titleRow);
  if (result.intro) head.appendChild(el("p", "doc__intro", result.intro));
  doc.appendChild(head);

  for (const item of result.items) {
    const sec = el("section", "doc__item");
    const itemHead = el("div", "doc__item-head");
    itemHead.appendChild(el("span", "doc__crumb", `${item.category} › ${item.project}`));
    itemHead.appendChild(el("h2", "doc__task", item.task));
    sec.appendChild(itemHead);

    const summary = el("div", "doc__field");
    summary.appendChild(el("h3", "doc__field-label", "설명 요약"));
    summary.appendChild(el("p", "doc__field-text", item.summary));
    sec.appendChild(summary);

    const issue = el("div", "doc__field doc__field--issue");
    issue.appendChild(el("h3", "doc__field-label", "이슈"));
    issue.appendChild(el("p", "doc__field-text", item.issue));
    sec.appendChild(issue);

    const proposal = el("div", "doc__field doc__field--proposal");
    proposal.appendChild(el("h3", "doc__field-label", "💡 자동화 제안"));
    const ul = el("ul", "doc__proposals");
    for (const p of item.proposals) ul.appendChild(el("li", "doc__proposal", p));
    proposal.appendChild(ul);
    sec.appendChild(proposal);

    const meta = el("div", "doc__meta");
    meta.appendChild(el("span", "doc__chip", `기대 효과 · ${item.effect}`));
    meta.appendChild(el("span", "doc__chip", `난이도 · ${item.difficulty}`));
    meta.appendChild(el("span", "doc__chip doc__chip--priority", `우선순위 · ${item.priority}`));
    sec.appendChild(meta);

    doc.appendChild(sec);
  }
  body.appendChild(doc);

  // ── 하단 액션 ──
  const actions = el("footer", "modal__actions");

  // 내보내기 전 공통 확인 팝업
  const confirmExport = () => confirmDialog("컨설팅 내용을 외부로 보내겠습니까?");

  const pdfBtn = el("button", "modal__action modal__action--primary", "PDF로 받기");
  pdfBtn.type = "button";
  pdfBtn.addEventListener("click", async () => {
    if (await confirmExport()) window.print();
  });
  actions.appendChild(pdfBtn);

  // Notion — 실제 전송 (배선 완료). 성공 후에는 클릭 시 생성된 페이지 열기.
  const notionBtn = el("button", "modal__action modal__action--notion", "Notion으로 받기");
  notionBtn.type = "button";
  let notionUrl: string | null = null;
  notionBtn.addEventListener("click", async () => {
    if (notionUrl) {
      window.open(notionUrl, "_blank", "noopener");
      return;
    }
    if (!(await confirmExport())) return;
    notionUrl = await exportToNotion(notionBtn, result);
  });
  actions.appendChild(notionBtn);

  // Slack — 실제 전송 (배선 완료)
  const slackBtn = el("button", "modal__action modal__action--slack", "Slack으로 보내기");
  slackBtn.type = "button";
  slackBtn.addEventListener("click", async () => {
    if (await confirmExport()) void exportToSlack(slackBtn, result);
  });
  actions.appendChild(slackBtn);

  // Gmail — 실제 전송 (배선 완료)
  const gmailBtn = el("button", "modal__action modal__action--gmail", "Gmail로 보내기");
  gmailBtn.type = "button";
  gmailBtn.addEventListener("click", async () => {
    if (await confirmExport()) void exportToGmail(gmailBtn, result);
  });
  actions.appendChild(gmailBtn);

  body.appendChild(actions);
}

/**
 * 컨설팅 모달을 연다.
 * @param mode "sample" = [2] 테스트, "real" = [1] 실제 Claude 분석
 * @param items real 모드에서 분석할 태스크 목록
 */
export async function openConsulting(
  mode: "sample" | "real",
  items: TaskItem[] = [],
): Promise<ConsultingResult | null> {
  const { body } = openShell();
  const loading = renderLoading(body);

  const url = mode === "sample" ? "/api/consult/sample" : "/api/consult";
  const payload = mode === "sample" ? {} : { items };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      loading.stop();
      renderError(body, data.error || `요청 실패 (HTTP ${res.status})`);
      return null;
    }
    // 100%까지 채운 뒤 잠깐 보여주고 결과로 전환
    loading.finish();
    await new Promise((r) => setTimeout(r, 300));
    if (!body.isConnected) return null; // 로딩 중 모달을 닫았으면 중단
    const result = data as ConsultingResult;
    renderResult(body, result);
    return result;
  } catch (err) {
    loading.stop();
    renderError(
      body,
      `서버에 연결하지 못했습니다. 로컬 API 서버가 실행 중인지 확인하세요 (npm run server). ${
        err instanceof Error ? err.message : ""
      }`,
    );
    return null;
  }
}

/** 저장된 컨설팅 결과를 (fetch 없이) 모달로 다시 연다. (내역의 '컨설팅 내역 보기') */
export function openResult(result: ConsultingResult): void {
  const { body } = openShell();
  renderResult(body, result);
}
