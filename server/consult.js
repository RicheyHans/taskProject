// [1] 실제 분석: 전달받은 태스크들을 Claude로 분석해 자동화 제안을 만든다.
// Anthropic API 키(ANTHROPIC_API_KEY)가 있어야 동작한다.
//
// 구조화 출력(output_config.format + JSON 스키마)을 사용한다. 강제 tool 호출 방식은
// 모델이 드물게 전체 결과를 유사 XML 문자열로 한 필드에 덤프하는 실패가 있어 이 방식으로 대체했다.
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

/** 응답을 강제할 JSON 스키마 */
const CONSULT_SCHEMA = {
  type: "object",
  properties: {
    intro: { type: "string", description: "전체 요약 한두 문장" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          project: { type: "string" },
          task: { type: "string" },
          summary: { type: "string", description: "설명(description)을 1~2문장으로 요약" },
          issue: { type: "string", description: "이슈를 1문장으로 요약" },
          proposals: {
            type: "array",
            items: { type: "string" },
            description: "구체적인 자동화 방안 2~4개",
          },
          effect: { type: "string", description: "기대 효과(가능하면 정량적으로)" },
          difficulty: { type: "string", enum: ["낮음", "중간", "높음"] },
          priority: { type: "string", enum: ["높음", "중간", "낮음"] },
        },
        required: [
          "category",
          "project",
          "task",
          "summary",
          "issue",
          "proposals",
          "effect",
          "difficulty",
          "priority",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["intro", "items"],
  additionalProperties: false,
};

/**
 * @param {Array<{category:string,project:string,task:string,description:string,issue:string}>} items
 */
export async function runConsulting(items) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const taskList = items
    .map(
      (t, i) =>
        `${i + 1}. [${t.category} › ${t.project}] ${t.task}\n   설명: ${t.description || "(없음)"}\n   이슈: ${t.issue || "(없음)"}`,
    )
    .join("\n\n");

  const prompt = `너는 업무 자동화 컨설턴트다. 아래는 한 사용자의 업무 태스크 목록과 각 태스크의 설명(description)·이슈(issue)다.\n각 태스크별로, 설명과 이슈를 근거로 "어떻게 자동화할 수 있는지"를 구체적이고 실행 가능한 방안으로 제안하라.\n모든 태스크를 빠짐없이 다루고, 한국어로 작성하라. 지정된 JSON 형식으로만 응답하라.\n\n[태스크 목록]\n${taskList}`;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    output_config: {
      format: { type: "json_schema", schema: CONSULT_SCHEMA },
    },
    messages: [{ role: "user", content: prompt }],
  });

  if (res.stop_reason === "max_tokens") {
    throw new Error(
      "결과가 max_tokens 한도에서 잘렸습니다. 태스크 수를 줄이거나 서버의 max_tokens 를 높여주세요.",
    );
  }

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || !textBlock.text) {
    throw new Error("모델 응답에서 결과 텍스트를 찾지 못했습니다.");
  }

  let data;
  try {
    data = JSON.parse(textBlock.text);
  } catch {
    throw new Error("결과 JSON 파싱에 실패했습니다.");
  }

  return {
    title: "자동화 컨설팅 제안",
    sample: false,
    intro: data.intro || "",
    items: Array.isArray(data.items) ? data.items : [],
  };
}
