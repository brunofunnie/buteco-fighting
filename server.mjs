import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};
http
  .createServer(async (req, res) => {
    try {
      const route = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const file = path.resolve(
        root,
        "." + (route === "/" ? "/index.html" : route),
      );
      if (
        !file.startsWith(root + path.sep) ||
        route.split("/").some((p) => p.startsWith("."))
      ) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      if (!(await stat(file)).isFile()) throw new Error("Missing");
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(Number(process.env.PORT) || 3187, "0.0.0.0", () =>
    console.log(
      `Buteco Fighting: http://localhost:${Number(process.env.PORT) || 3187}`,
    ),
  );
