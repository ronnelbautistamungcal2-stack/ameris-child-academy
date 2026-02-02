const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { initializeSocket } = require("./src/lib/socket.js");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
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

  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Server listening at http://${hostname}:${port}`);
    console.log(`> Socket.io enabled`);
  });
});
