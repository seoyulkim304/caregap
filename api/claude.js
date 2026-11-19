// Vercel 서버리스 함수: /api/claude
import { handleClaude } from "../lib/claude-handler.js";

export function GET(request) {
  return handleClaude(request, process.env);
}
export function POST(request) {
  return handleClaude(request, process.env);
}
