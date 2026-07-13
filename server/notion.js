// 컨설팅 결과를 Notion 페이지로 생성한다.
// 필요한 것: 내부 integration 토큰(NOTION_TOKEN) + 대상 부모 페이지(NOTION_PARENT_PAGE_ID).
// 부모 페이지는 반드시 해당 integration에 "연결(공유)"되어 있어야 한다.
import { Client } from "@notionhq/client";

// 기본 부모 페이지: "Seungbum Private" 워크스페이스의 "업무" 페이지.
const DEFAULT_PARENT_PAGE_ID = "ef991364-09a6-4203-af50-597d96024c8f";

/** 긴 문자열을 Notion rich_text(요소당 2000자 제한)로 안전하게 변환 */
function rt(text, annotations) {
  const t = String(text ?? "");
  const chunks = [];
  for (let i = 0; i < t.length; i += 1900) chunks.push(t.slice(i, i + 1900));
  if (chunks.length === 0) chunks.push("");
  return chunks.map((c) => ({
    type: "text",
    text: { content: c },
    ...(annotations ? { annotations } : {}),
  }));
}

const para = (richText) => ({
  object: "block",
  type: "paragraph",
  paragraph: { rich_text: richText },
});
const bullet = (text) => ({
  object: "block",
  type: "bulleted_list_item",
  bulleted_list_item: { rich_text: rt(text) },
});
const heading2 = (text) => ({
  object: "block",
  type: "heading_2",
  heading_2: { rich_text: rt(text) },
});
const divider = () => ({ object: "block", type: "divider", divider: {} });

/** 컨설팅 결과(JSON)를 Notion 블록 배열로 변환 */
export function buildBlocks(result) {
  const blocks = [];
  if (result.intro) {
    blocks.push({
      object: "block",
      type: "callout",
      callout: { icon: { emoji: "📋" }, rich_text: rt(result.intro) },
    });
  }
  for (const item of result.items || []) {
    blocks.push(heading2(item.task));
    blocks.push(
      para(rt(`${item.category} › ${item.project}`, { italic: true, color: "gray" })),
    );
    blocks.push(para([...rt("설명 요약: ", { bold: true }), ...rt(item.summary)]));
    blocks.push(para([...rt("이슈: ", { bold: true }), ...rt(item.issue)]));
    blocks.push(para(rt("💡 자동화 제안", { bold: true })));
    for (const p of item.proposals || []) blocks.push(bullet(p));
    blocks.push(
      para(
        rt(
          `기대 효과: ${item.effect}  ·  난이도: ${item.difficulty}  ·  우선순위: ${item.priority}`,
          { color: "gray" },
        ),
      ),
    );
    blocks.push(divider());
  }
  return blocks;
}

/**
 * 컨설팅 결과로 Notion 페이지를 생성하고 URL을 반환한다.
 * @param {object} result ConsultingResult
 * @param {string} stamp  제목에 붙일 시각 문자열
 */
export async function createConsultingPage(result, stamp) {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    throw new Error(
      "NOTION_TOKEN 이 설정되지 않았습니다. Notion 내부 integration 토큰을 .env 에 넣고 서버를 재시작하세요.",
    );
  }
  const parentPageId = process.env.NOTION_PARENT_PAGE_ID || DEFAULT_PARENT_PAGE_ID;
  const notion = new Client({ auth: token });

  const title = `${result.title}${stamp ? ` (${stamp})` : ""}`;
  const blocks = buildBlocks(result);
  // Notion은 페이지 생성 시 children 최대 100개 → 100개 단위로 나눠 추가한다.
  const first = blocks.slice(0, 100);
  const rest = blocks.slice(100);

  let page;
  try {
    page = await notion.pages.create({
      parent: { page_id: parentPageId },
      icon: { emoji: "🤖" },
      properties: { title: { title: rt(title) } },
      children: first,
    });
  } catch (err) {
    // 가장 흔한 원인: 부모 페이지를 integration에 공유하지 않음
    const msg = err?.body || err?.message || String(err);
    throw new Error(
      `Notion 페이지 생성 실패: ${msg}\n(대상 페이지를 integration에 '연결(공유)'했는지, NOTION_PARENT_PAGE_ID가 맞는지 확인하세요.)`,
    );
  }

  for (let i = 0; i < rest.length; i += 100) {
    await notion.blocks.children.append({
      block_id: page.id,
      children: rest.slice(i, i + 100),
    });
  }

  return page.url;
}
