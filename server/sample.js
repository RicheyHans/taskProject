// [2] 테스트용 샘플 컨설팅 결과. 실제 [1] 결과와 동일한 JSON 형식을 따른다.
// 프론트엔드는 이 형식을 그대로 렌더링한다.

/**
 * @typedef {Object} ConsultingItem
 * @property {string} category
 * @property {string} project
 * @property {string} task
 * @property {string} summary        설명(description) 요약
 * @property {string} issue          이슈 요약
 * @property {string[]} proposals    자동화 제안(불릿)
 * @property {string} effect         기대 효과
 * @property {string} difficulty     난이도(낮음/중간/높음)
 * @property {string} priority       우선순위(높음/중간/낮음)
 *
 * @typedef {Object} ConsultingResult
 * @property {string} title
 * @property {boolean} sample
 * @property {string} intro
 * @property {ConsultingItem[]} items
 */

/** @returns {ConsultingResult} */
export function buildConsultingSample() {
  return {
    title: "자동화 컨설팅 제안 (샘플)",
    sample: true,
    intro:
      "이 문서는 커넥터 동작 확인용 샘플입니다. 실제 기능에서는 Claude가 각 태스크의 설명과 이슈를 읽어 아래와 같은 형식으로 자동화 방안을 제안합니다.",
    items: [
      {
        category: "관리 업무",
        project: "프로젝트 1",
        task: "태스크 1-1",
        summary: "여러 채널에서 들어온 데이터를 수기로 취합하고 정리하는 반복 작업.",
        issue: "수작업 비중이 커서 시간이 오래 걸리고, 옮기는 과정에서 오타·누락이 잦음.",
        proposals: [
          "Google Sheets + Apps Script로 입력 → 정리 → 검증 파이프라인 구성",
          "매일 오전 9시 시간 기반 트리거로 취합 리포트 자동 생성",
          "필수값/형식 위반 행을 자동 하이라이트하는 검증 규칙 추가",
        ],
        effect: "주 3시간 → 20분 (약 85% 절감)",
        difficulty: "낮음",
        priority: "높음",
      },
      {
        category: "관리 업무",
        project: "프로젝트 1",
        task: "태스크 1-2",
        summary: "정리된 데이터를 바탕으로 정기 보고 문서를 작성하고 공유.",
        issue: "매번 같은 포맷을 손으로 다시 만들고, 공유 대상에게 개별 전달하느라 번거로움.",
        proposals: [
          "보고서 템플릿 + 시트 데이터 병합(Docs API)으로 문서 자동 생성",
          "생성 즉시 지정 폴더 저장 + 관련자에게 링크 자동 알림(Slack/메일)",
        ],
        effect: "주 2시간 → 15분 (약 87% 절감)",
        difficulty: "중간",
        priority: "중간",
      },
      {
        category: "기획 업무",
        project: "프로젝트 A",
        task: "태스크 A-1",
        summary: "경쟁/시장 정보를 주기적으로 수집해 한곳에 모으는 작업.",
        issue: "소스가 여러 곳이라 매번 사이트를 돌며 복사·붙여넣기 해야 함.",
        proposals: [
          "정해진 소스에 대한 정기 수집 스크립트(스케줄러) 구성",
          "수집 결과를 Notion 데이터베이스에 자동 적재 + 중복 제거",
          "주간 요약을 Claude로 초안 자동 작성",
        ],
        effect: "주 1.5시간 → 10분 (약 89% 절감)",
        difficulty: "중간",
        priority: "중간",
      },
    ],
  };
}
