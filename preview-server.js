const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname);
const port = Number(process.env.PORT) || 3000;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  let target = path.resolve(root, "." + pathname);
  if (target !== root && !target.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (pathname.endsWith("/")) target = path.join(target, "index.html");

  fs.readFile(target, (err, data) => {
    if (err) {
      res.writeHead(err.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store"
      });
      res.end(err.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(target).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(data);
  });
}).listen(port, "0.0.0.0", () => {
  console.log(`LIFE OS preview server listening on port ${port}`);
});
