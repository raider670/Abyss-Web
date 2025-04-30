import { createBareServer } from "@tomphttp/bare-server-node";
import express from "express";
import http from "http";
import { dirname, join } from "path";
import { hostname } from "node:os";
import { fileURLToPath } from "url";
import compression from "compression";
import chalk from "chalk";
import "dotenv/config";

let port = parseInt(process.env.PORT, 10) || 8080;

const bare = createBareServer("/bare/");
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(compression());
app.use(express.static(join(__dirname, "static")));
app.use("/class/", express.static(join(__dirname, "services", "uv")));
app.use("/work/", express.static(join(__dirname, "services", "dynamic")));

app.use((req, res) => {
  res.status(404).sendFile(join(__dirname, "static", "404.html"));
});

const server = http.createServer();

server.on("error", (err) => {
  console.error(`ERROR: ${err}`);
  process.exit(1); // Exit the process on critical errors
});

server.on("request", (req, res) => {
  try {
    if (bare.shouldRoute(req)) {
      bare.routeRequest(req, res);
    } else {
      app(req, res);
    }
  } catch (err) {
    console.error(`Error handling request: ${err}`);
    res.statusCode = 500;
    res.end("Internal Server Error");
  }
});

server.on("upgrade", (req, socket, head) => {
  try {
    if (bare.shouldRoute(req)) {
      bare.routeUpgrade(req, socket, head);
    } else {
      socket.end();
    }
  } catch (err) {
    console.error(`Error handling upgrade: ${err}`);
    socket.end();
  }
});

server.on("listening", () => {
  const address = server.address();
  console.log(chalk.green("ABYSS: Abyss Web started."));
  console.log("Listening on:");
  console.log(`\thttp://localhost:${address.port}`);
  console.log(`\thttp://${hostname() || "localhost"}:${address.port}`);
  console.log(
    `\thttp://${
      address && address.family === "IPv6" ? `[${address.address}]` : address?.address || "localhost"
    }:${address.port}`
  );
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed.");
    bare.close();
    process.exit(0);
  });
}

server.listen({ port });
