// 컨설팅 결과를 Gmail(SMTP)로 전송한다.
// 필요한 것: GMAIL_USER, GMAIL_APP_PASSWORD(앱 비밀번호), MAIL_TO(받는 주소).
import nodemailer from "nodemailer";

/** HTML 이스케이프 (동적 텍스트가 메일 마크업을 깨지 않도록) */
function esc(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 컨설팅 결과 → 이메일 HTML 본문 */
function buildHtml(result) {
  const items = Array.isArray(result.items) ? result.items : [];
  const itemsHtml = items
    .map(
      (it) => `
      <div style="margin:0 0 28px;">
        <h2 style="margin:0 0 2px;font-size:17px;">${esc(it.task)}</h2>
        <div style="color:#888;font-size:13px;margin-bottom:10px;">${esc(it.category)} › ${esc(it.project)}</div>
        <p style="margin:0 0 6px;"><strong>설명 요약:</strong> ${esc(it.summary)}</p>
        <p style="margin:0 0 6px;"><strong>이슈:</strong> ${esc(it.issue)}</p>
        <p style="margin:0 0 4px;"><strong>💡 자동화 제안</strong></p>
        <ul style="margin:0 0 8px;padding-left:20px;">
          ${(it.proposals || []).map((p) => `<li style="margin-bottom:4px;">${esc(p)}</li>`).join("")}
        </ul>
        <div style="color:#888;font-size:13px;">기대효과 ${esc(it.effect)} · 난이도 ${esc(it.difficulty)} · 우선순위 ${esc(it.priority)}</div>
      </div>`,
    )
    .join("\n");

  return `
  <div style="font-family:'Segoe UI','Malgun Gothic',system-ui,sans-serif;max-width:720px;margin:0 auto;color:#1a1d24;line-height:1.65;">
    <h1 style="font-size:22px;margin:0 0 8px;">🤖 ${esc(result.title)}</h1>
    ${result.intro ? `<p style="color:#555;margin:0 0 16px;">${esc(result.intro)}</p>` : ""}
    <hr style="border:none;border-top:2px solid #e3e6ea;margin:0 0 20px;">
    ${itemsHtml}
  </div>`;
}

/** 컨설팅 결과를 메일로 전송한다. */
export async function sendToGmail(result, stamp) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const to = process.env.MAIL_TO || user;
  if (!user || !pass) {
    throw new Error(
      "GMAIL_USER / GMAIL_APP_PASSWORD 가 설정되지 않았습니다. 앱 비밀번호를 .env 에 넣고 서버를 재시작하세요.",
    );
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass: pass.replace(/\s+/g, "") }, // 앱 비밀번호의 공백 제거
  });

  const subject = `[자동화 컨설팅] ${result.title}${stamp ? ` (${stamp})` : ""}`;
  await transporter.sendMail({
    from: `자동화 컨설팅 <${user}>`,
    to,
    subject,
    html: buildHtml(result),
  });
  return to;
}
