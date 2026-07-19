/**
 * 업무 대시보드 — 시트 쓰기용 Apps Script 웹앱.
 *
 * 로컬 API 서버(server/sheet-write.js)가 아래 형식으로 POST 한다:
 *   { "rows": [ ["category","project","task","description","issue"], ... ] }
 * 각 행을 첫 번째 시트 맨 아래에 append 하고 { ok:true, appended:n } 을 반환한다.
 *
 * ▷ 배포 방법은 apps-script/README.md 참고.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, error: "요청 본문이 없습니다." });
    }
    var body = JSON.parse(e.postData.contents);
    var rows = body.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return json_({ ok: false, error: "rows 가 비어 있습니다." });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    // 여러 행을 한 번에 append (마지막 데이터 행 다음부터 채운다 = "빈 셀에 차곡차곡").
    var start = sheet.getLastRow() + 1;
    var width = 0;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].length > width) width = rows[i].length;
    }
    var norm = rows.map(function (r) {
      var out = [];
      for (var c = 0; c < width; c++) out.push(r[c] != null ? String(r[c]) : "");
      return out;
    });
    sheet.getRange(start, 1, norm.length, width).setValues(norm);

    return json_({ ok: true, appended: norm.length });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/** 헬스체크용(브라우저로 URL 열었을 때). */
function doGet() {
  return json_({ ok: true, service: "task-dashboard sheet writer" });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
