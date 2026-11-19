// 로컬 테스트용 서버 (배포 계정 없이 실행). 배포 환경과 같은 핸들러를 씁니다.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { handleClaude } from "./lib/claude-handler.js";

const port = process.env.PORT || 3000;
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === "/api/claude") {
    const ac = new AbortController();
    res.on("close", () => ac.abort());
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: req.method === "POST" ? Readable.toWeb(req) : undefined,
      duplex: "half",
      signal: ac.signal,
    });
    const r = await handleClaude(request, process.env);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    if (!r.body) return res.end();
    const reader = r.body.getReader();
    res.on("close", () => reader.cancel().catch(() => {}));
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(value);
    }
    return res.end();
  }
  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(await readFile(new URL("./public/index.html", import.meta.url)));
  }
  res.writeHead(404).end();
}).listen(port, () => console.log(`CareGap (local): http://localhost:${port}`));
