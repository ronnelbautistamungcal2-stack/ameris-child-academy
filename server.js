const forceProd = process.argv.includes("--prod");
if (forceProd) {
  process.env.NODE_ENV = "production";
}

const { createServer } = require("http");
const { networkInterfaces } = require("os");
const { parse } = require("url");
const next = require("next");
const { initializeSocket } = require("./src/lib/socket.js");
const { startScheduledJobs } = require("./src/lib/jobs");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
const ignoredInterfaceNames = /(vmware|vethernet|virtual|hyper-v|loopback|wsl|docker)/i;
const renderHostname =
  hostname === "0.0.0.0" || hostname === "::" ? "localhost" : hostname;

const app = next({ dev, hostname: renderHostname, port });
const handle = app.getRequestHandler();

function collectNetworkUrls(port, includeInterface) {
  const urls = [];
  const interfaces = networkInterfaces();

  for (const [name, entries] of Object.entries(interfaces)) {
    if (!includeInterface(name)) continue;

    for (const entry of entries || []) {
      const isIPv4 =
        typeof entry.family === "string"
          ? entry.family === "IPv4"
          : entry.family === 4;
      if (!isIPv4 || entry.internal) continue;
      urls.push(`http://${entry.address}:${port}`);
    }
  }

  return [...new Set(urls)];
}

function getNetworkUrls(port) {
  const preferred = collectNetworkUrls(
    port,
    (name) => !ignoredInterfaceNames.test(name),
  );

  if (preferred.length) return preferred;
  return collectNetworkUrls(port, () => true);
}

async function start() {
  await app.prepare();

  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request:", err);
      res.statusCode = 500;
      res.end("Internal server error");
    }
  });

  // Initialize Socket.io
  initializeSocket(httpServer);
  startScheduledJobs();

  httpServer.listen(port, hostname, (err) => {
    if (err) throw err;
    const isWildcardHost = hostname === "0.0.0.0" || hostname === "::";

    if (isWildcardHost) {
      console.log(`> Local:   http://localhost:${port}`);
      for (const url of getNetworkUrls(port)) {
        console.log(`> Network: ${url}`);
      }
    } else {
      console.log(`> Server:  http://${hostname}:${port}`);
    }

    console.log(`> Socket.io enabled`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
