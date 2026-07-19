// Vercel 서버리스 함수: 헬스 체크. → GET /api/health
export default function handler(_req, res) {
  res.json({ ok: true, hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY) });
}
