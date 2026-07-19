// 구글 시트에 행을 추가(append)한다.
//  - 공개 시트는 "읽기"만 인증 없이 가능하므로, "쓰기"는 시트에 연결된
//    Apps Script 웹앱(SHEET_WEBAPP_URL)을 통해 처리한다.
//  - 웹앱은 { rows: string[][] } 를 받아 시트 맨 아래에 한 행씩 append 하고
//    { ok: true, appended: n } 을 돌려준다. (apps-script/Code.gs 참고)

/**
 * 여러 행을 시트에 추가한다.
 * @param {string[][]} rows 각 행은 [category, project, task, description, issue]
 * @returns {Promise<{ appended: number }>}
 */
export async function appendRows(rows) {
  const url = process.env.SHEET_WEBAPP_URL;
  if (!url) {
    throw new Error(
      "SHEET_WEBAPP_URL 이 설정되지 않았습니다. 시트에 연결된 Apps Script 웹앱을 배포한 뒤 그 URL 을 .env 에 넣고 서버를 재시작하세요. (설정 방법: apps-script/README.md)",
    );
  }

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      // Apps Script 웹앱은 CORS/preflight 회피를 위해 text/plain 본문을 권장한다.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ rows }),
      redirect: "follow", // 웹앱은 302로 googleusercontent 로 리다이렉트한다
    });
  } catch (err) {
    throw new Error(
      `Apps Script 웹앱에 연결하지 못했습니다: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Apps Script 응답을 해석하지 못했습니다(웹앱 URL/배포 상태를 확인하세요). 응답: ${text.slice(0, 200)}`,
    );
  }

  if (!res.ok || data.ok !== true) {
    throw new Error(data.error || `시트 쓰기 실패 (HTTP ${res.status}).`);
  }
  return { appended: Number(data.appended) || rows.length };
}
