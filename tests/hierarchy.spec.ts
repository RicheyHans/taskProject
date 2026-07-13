import { test, expect } from "@playwright/test";

// 데이터 소스(구글 시트)는 사용자가 자유롭게 편집하므로, 테스트는 특정 항목 이름이 아니라
// 구조와 동작(중복 없음, 토글, 태스크/설명/화살표 렌더, 모달)을 검증한다.

test.describe("업무 대시보드", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".cat").first()).toBeVisible();
  });

  test("좌측 메뉴에 category가 중복 없이 표시된다", async ({ page }) => {
    const labels = await page.locator(".cat__label").allTextContents();
    expect(labels.length).toBeGreaterThan(0);
    // 중복 없음(요구사항)
    expect(new Set(labels).size).toBe(labels.length);
  });

  test("기본 상태: 본문에 안내가 뜨고 project는 숨겨져 있다", async ({ page }) => {
    await expect(page.locator("#placeholder")).toBeVisible();
    await expect(page.locator(".proj").first()).toBeHidden();
  });

  test("category 클릭 시 project가 토글된다", async ({ page }) => {
    const firstCat = page.locator(".cat").first();
    const firstProj = firstCat.locator(".proj").first();

    await expect(firstProj).toBeHidden();
    await firstCat.locator(".cat__toggle").click();
    await expect(firstProj).toBeVisible();
    await firstCat.locator(".cat__toggle").click();
    await expect(firstProj).toBeHidden();
  });

  test("여러 category를 동시에 펼칠 수 있다", async ({ page }) => {
    const cats = page.locator(".cat");
    const count = await cats.count();
    test.skip(count < 2, "카테고리가 2개 미만이라 생략");

    await cats.nth(0).locator(".cat__toggle").click();
    await cats.nth(1).locator(".cat__toggle").click();
    await expect(cats.nth(0).locator(".proj").first()).toBeVisible();
    await expect(cats.nth(1).locator(".proj").first()).toBeVisible();
  });

  test("project 클릭 시 본문에 task/description/화살표가 표시된다", async ({
    page,
  }) => {
    const firstCat = page.locator(".cat").first();
    await firstCat.locator(".cat__toggle").click();
    await firstCat.locator(".proj").first().click();

    const content = page.locator("#content");
    const names = content.locator(".task__name");
    const n = await names.count();
    expect(n).toBeGreaterThan(0);

    // 각 task마다 description 박스
    await expect(content.locator(".task__desc")).toHaveCount(n);
    await expect(content.locator(".task__desc").first()).not.toBeEmpty();
    // task 사이 화살표 = (task 수 - 1)
    await expect(content.locator(".flow__arrow")).toHaveCount(Math.max(0, n - 1));
  });

  test("HOME: 기본은 안내+버튼 숨김, 프로젝트 선택 시 버튼 노출, HOME 클릭 시 복귀", async ({
    page,
  }) => {
    const homeBtn = page.locator("#home-btn");
    const consultBtn = page.locator("#btn-consult");

    // 초기(HOME): 안내 표시, HOME 활성, 컨설팅 버튼 숨김
    await expect(homeBtn).toBeVisible();
    await expect(homeBtn).toHaveClass(/is-active/);
    await expect(page.locator("#placeholder")).toBeVisible();
    await expect(consultBtn).toBeHidden();

    // 프로젝트 선택 → 태스크 표시, 버튼 노출, HOME 비활성
    const firstCat = page.locator(".cat").first();
    await firstCat.locator(".cat__toggle").click();
    await firstCat.locator(".proj").first().click();
    await expect(page.locator("#content .task").first()).toBeVisible();
    await expect(consultBtn).toBeVisible();
    await expect(homeBtn).not.toHaveClass(/is-active/);

    // HOME 클릭 → 안내 복귀, 버튼 숨김, HOME 활성
    await homeBtn.click();
    await expect(page.locator("#placeholder")).toBeVisible();
    await expect(consultBtn).toBeHidden();
    await expect(homeBtn).toHaveClass(/is-active/);
  });

  test("컨설팅 내역 섹션: HOME 숨김, 프로젝트 선택 시 표시", async ({ page }) => {
    const history = page.locator("#history");
    await expect(history).toBeHidden(); // HOME에서는 숨김

    const firstCat = page.locator(".cat").first();
    await firstCat.locator(".cat__toggle").click();
    await firstCat.locator(".proj").first().click();

    await expect(history).toBeVisible();
    await expect(history.locator(".history__title")).toHaveText("컨설팅 내역");
  });

  test("issue가 description 바로 아래에 별도 박스로 표시된다", async ({
    page,
  }) => {
    const firstCat = page.locator(".cat").first();
    await firstCat.locator(".cat__toggle").click();
    await firstCat.locator(".proj").first().click();

    const firstTask = page.locator("#content .task").first();
    const issue = firstTask.locator(".task__issue");
    // 첫 task에 issue가 있으면 형식/위치를 검증(없으면 생략)
    test.skip((await issue.count()) === 0, "첫 태스크에 issue가 없어 생략");

    const desc = firstTask.locator(".task__desc");
    await expect(issue).toBeVisible();
    await expect(firstTask.locator(".task__issue-label")).toHaveText("이슈");
    await expect(firstTask.locator(".task__issue-text")).not.toBeEmpty();

    const descBox = await desc.boundingBox();
    const issueBox = await issue.boundingBox();
    expect(issueBox!.y).toBeGreaterThan(descBox!.y);
  });

  test("[1] 클릭 시 토큰 소모 확인 팝업 → 취소하면 아무 동작 안 함", async ({
    page,
  }) => {
    // 프로젝트 진입(버튼은 프로젝트 화면에서만 노출)
    const firstCat = page.locator(".cat").first();
    await firstCat.locator(".cat__toggle").click();
    await firstCat.locator(".proj").first().click();

    await page.locator("#btn-consult").click();

    // 커스텀 확인 팝업 표시
    const dialog = page.locator(".dialog-overlay");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".dialog__msg")).toContainText("API 토큰이 소모");
    await expect(dialog.locator(".dialog__btn--confirm")).toHaveText("확인");
    await expect(dialog.locator(".dialog__btn--cancel")).toHaveText("취소");

    // 취소 → 팝업 닫히고 컨설팅 모달은 열리지 않음
    await dialog.locator(".dialog__btn--cancel").click();
    await expect(dialog).toBeHidden();
    await expect(page.locator(".modal-overlay")).toHaveCount(0);
  });

  test("[2] 테스트 버튼 → 샘플 컨설팅 모달 + 내보내기 버튼", async ({ page }) => {
    // 컨설팅 버튼은 프로젝트(태스크) 화면에서만 노출되므로 먼저 프로젝트를 연다.
    const firstCat = page.locator(".cat").first();
    await firstCat.locator(".cat__toggle").click();
    await firstCat.locator(".proj").first().click();
    await expect(page.locator("#btn-consult-test")).toBeVisible();

    await page.locator("#btn-consult-test").click();

    const modal = page.locator(".modal-overlay");
    await expect(modal).toBeVisible();

    // 샘플 문서(서버 고정 데이터) — 제목 + SAMPLE 배지
    await expect(modal.locator(".doc__title")).toHaveText("자동화 컨설팅 제안 (샘플)");
    await expect(modal.locator(".doc__badge")).toHaveText("SAMPLE");
    await expect(modal.locator(".doc__item").first()).toBeVisible();
    await expect(modal.locator(".doc__proposal").first()).not.toBeEmpty();

    // 내보내기 버튼 4종 모두 활성(미연결 없음)
    await expect(modal.locator(".modal__action--primary")).toHaveText("PDF로 받기");
    await expect(modal.locator(".modal__action--notion")).toBeVisible();
    await expect(modal.locator(".modal__action--slack")).toBeVisible();
    await expect(modal.locator(".modal__action--gmail")).toBeVisible();
    await expect(modal.locator(".modal__action--pending")).toHaveCount(0);

    await modal.locator(".modal__close").click();
    await expect(modal).toBeHidden();
  });

  test("내보내기 버튼 클릭 시 외부 전송 확인 팝업 → 취소하면 동작 안 함", async ({
    page,
  }) => {
    // 프로젝트 진입 후 [2] 샘플 모달 오픈
    const firstCat = page.locator(".cat").first();
    await firstCat.locator(".cat__toggle").click();
    await firstCat.locator(".proj").first().click();
    await page.locator("#btn-consult-test").click();

    const modal = page.locator(".modal-overlay");
    await expect(modal).toBeVisible();

    // PDF 버튼 클릭 → 외부 전송 확인 팝업
    await modal.locator(".modal__action--primary").click();
    const dialog = page.locator(".dialog-overlay");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".dialog__msg")).toContainText("외부로 보내겠습니까");
    await expect(dialog.locator(".dialog__btn--confirm")).toHaveText("확인");
    await expect(dialog.locator(".dialog__btn--cancel")).toHaveText("취소");

    // 취소 → 팝업만 닫히고 컨설팅 모달은 유지
    await dialog.locator(".dialog__btn--cancel").click();
    await expect(dialog).toBeHidden();
    await expect(modal).toBeVisible();
  });
});

// 시트를 모킹해 "프로젝트가 늘어나도" 모든 기능이 동일하게 동작하는지 검증한다.
// (실제 구글 시트는 건드리지 않음)
const MOCK_CSV = `"category","project","task","description","issue"
"카테고리A","프로젝트A1","작업1","설명1 내용","이슈1 내용"
"카테고리A","프로젝트A1","작업2","설명2 내용",""
"카테고리A","프로젝트A2","작업3","설명3 내용","이슈3 내용"
"카테고리B","프로젝트B1","작업4","설명4 내용","이슈4 내용"
"카테고리B","프로젝트B2","","",""`;

test.describe("데이터 확장(여러 카테고리/프로젝트) — 시트 모킹", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/gviz\/tq/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/csv; charset=utf-8",
        body: MOCK_CSV,
      }),
    );
    await page.goto("/");
    await expect(page.locator(".cat").first()).toBeVisible();
  });

  test("여러 카테고리·프로젝트가 동일하게 렌더/동작한다", async ({ page }) => {
    // 2개 카테고리(중복 없이)
    await expect(page.locator(".cat__label")).toHaveText(["카테고리A", "카테고리B"]);

    const catA = page.locator(".cat").nth(0);
    const catB = page.locator(".cat").nth(1);

    // 카테고리A 펼침 → 프로젝트 2개 / 여러 카테고리 동시 펼침
    await catA.locator(".cat__toggle").click();
    await expect(catA.locator(".proj__label")).toHaveText(["프로젝트A1", "프로젝트A2"]);
    await catB.locator(".cat__toggle").click();
    await expect(catB.locator(".proj").first()).toBeVisible();

    const content = page.locator("#content");

    // 프로젝트A1 선택 → 태스크 2, 화살표 1, 컨설팅 버튼/내역 노출
    await catA.locator(".proj").nth(0).click();
    await expect(content.locator(".task__name")).toHaveText(["작업1", "작업2"]);
    await expect(content.locator(".flow__arrow")).toHaveCount(1);
    await expect(page.locator("#btn-consult")).toBeVisible();
    await expect(page.locator("#history .history__title")).toHaveText("컨설팅 내역");

    // 다른 프로젝트(A2) 선택 → 태스크 1개로 갱신
    await catA.locator(".proj").nth(1).click();
    await expect(content.locator(".task__name")).toHaveText(["작업3"]);

    // 빈 프로젝트(B2, 태스크 0) 선택 → 안내 표시, 버튼은 여전히 노출
    await catB.locator(".proj").nth(1).click();
    await expect(content).toContainText("태스크가 없습니다");
    await expect(page.locator("#btn-consult")).toBeVisible();
  });
});
