// Cloudflare Pages Functions: /api/claude
import { handleClaude } from "../../lib/claude-handler.js";

export const onRequest = ({ request, env }) => handleClaude(request, env);
