// 컨설팅 결과를 Slack Incoming Webhook 으로 전송한다.
// 필요한 것: SLACK_WEBHOOK_URL (지정 채널로 전송되는 웹훅 URL).

/** section 블록 (mrkdwn, 3000자 제한이라 여유 있게 자름) */
const section = (text) => ({
  type: "section",
  text: { type: "mrkdwn", text: String(text).slice(0, 2900) },
});

/** 컨설팅 결과 → Slack Block Kit 메시지 */
function buildSlackMessage(result, stamp) {
  const blocks = [];
  const headerText = `🤖 ${result.title}${stamp ? ` (${stamp})` : ""}`;
  blocks.push({
    type: "header",
    text: { type: "plain_text", text: headerText.slice(0, 150), emoji: true },
  });
  if (result.intro) blocks.push(section(result.intro));
  blocks.push({ type: "divider" });

  const items = Array.isArray(result.items) ? result.items : [];
  let shown = 0;
  for (const item of items) {
    // Slack 메시지는 블록 50개 제한 → 여유를 두고 48 근처에서 멈춘다.
    if (blocks.length >= 48) break;
    const lines = [
      `*${item.task}*  _(${item.category} › ${item.project})_`,
      `⚠️ ${item.issue}`,
      "*💡 자동화 제안*",
      ...(item.proposals || []).map((p) => `• ${p}`),
      `_기대효과 ${item.effect} · 난이도 ${item.difficulty} · 우선순위 ${item.priority}_`,
    ];
    blocks.push(section(lines.join("\n")));
    shown++;
  }
  if (shown < items.length) {
    blocks.push(section(`_…외 ${items.length - shown}개 항목 생략 (Slack 메시지 길이 제한)_`));
  }

  // 알림/폴백용 text
  const text = `${result.title} — 자동화 컨설팅 제안 (${items.length}개 태스크)`;
  return { text, blocks };
}

/** 컨설팅 결과를 Slack으로 전송한다. */
export async function sendToSlack(result, stamp) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    throw new Error(
      "SLACK_WEBHOOK_URL 이 설정되지 않았습니다. Slack Incoming Webhook URL 을 .env 에 넣고 서버를 재시작하세요.",
    );
  }
  const payload = buildSlackMessage(result, stamp);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  // Incoming Webhook 은 성공 시 본문 "ok" 를 반환한다.
  if (!res.ok || body.trim() !== "ok") {
    throw new Error(`Slack 전송 실패 (HTTP ${res.status}): ${body}`);
  }
}
