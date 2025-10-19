import http from "http";
import { randomUUID } from "crypto";
import dgram from "dgram";

const PORT = Number(process.env.PORT || 4510);
const HOST = process.env.HOST || "0.0.0.0";
const AGENT_TOKEN = process.env.WOL_AGENT_TOKEN || "";
const DEFAULT_BROADCAST = process.env.WOL_BROADCAST || "255.255.255.255";
const DEFAULT_PORT = Number(process.env.WOL_PORT || 9);
const DEFAULT_REPEAT = Number(process.env.WOL_REPEAT || 3);
const DEFAULT_INTERVAL = Number(process.env.WOL_INTERVAL_MS || 120);

const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const log = (level, message, context = {}) => {
  const entry = {
    time: new Date().toISOString(),
    level,
    message,
    ...context,
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
};

const isValidMac = (value) => {
  if (!value) return false;
  const mac = value.trim();
  const macWithSeparators = /^([0-9A-Fa-f]{2}([:-]?)){5}[0-9A-Fa-f]{2}$/;
  const compact = mac.replace(/[^0-9A-Fa-f]/g, "");
  return macWithSeparators.test(mac) || compact.length === 12;
};

const normalizeMac = (value) => value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();

const buildMagicPacket = (mac) => {
  const macBuffer = Buffer.from(mac, "hex");
  if (macBuffer.length !== 6) {
    throw new Error("Invalid MAC length after normalization");
  }

  const packet = Buffer.alloc(6 + 16 * 6, 0xff);
  for (let i = 0; i < 16; i += 1) {
    macBuffer.copy(packet, 6 + i * 6);
  }
  return packet;
};

const sendMagicPacket = async (
  mac,
  {
    broadcastAddress = DEFAULT_BROADCAST,
    port = DEFAULT_PORT,
    repeat = DEFAULT_REPEAT,
    interval = DEFAULT_INTERVAL,
  } = {}
) => {
  const normalizedMac = normalizeMac(mac);
  const packet = buildMagicPacket(normalizedMac);
  const sendCount = Math.max(1, Number(repeat) || DEFAULT_REPEAT);
  const delay = Math.max(0, Number(interval) || DEFAULT_INTERVAL);

  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    let sent = 0;
    let closed = false;

    const closeSocket = (error) => {
      if (closed) return;
      closed = true;
      socket.close();
      if (error) {
        reject(error);
      } else {
        resolve({ packetsSent: sent, broadcastAddress, port });
      }
    };

    socket.on("error", (error) => {
      closeSocket(error);
    });

    socket.bind(0, () => {
      socket.setBroadcast(true);

      const sendPacket = () => {
        socket.send(packet, 0, packet.length, port, broadcastAddress, (error) => {
          if (error) {
            closeSocket(error);
            return;
          }
          sent += 1;
          if (sent >= sendCount) {
            closeSocket();
          } else {
            setTimeout(sendPacket, delay);
          }
        });
      };

      sendPacket();
    });
  });
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error("Payload too large"));
        req.connection.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(body);
        resolve(parsed);
      } catch (error) {
        reject(new Error("Invalid JSON payload"));
      }
    });
    req.on("error", reject);
  });

const sendJson = (res, statusCode, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": CORS_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization", // CORS headers for browsers
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  });
  res.end(body);
};

const server = http.createServer(async (req, res) => {
  const requestId = randomUUID();
  const { method, url } = req;

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": CORS_ORIGIN,
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Max-Age": "600",
    });
    res.end();
    return;
  }

  if (url === "/health" && method === "GET") {
    sendJson(res, 200, { status: "ok", timestamp: Date.now() });
    return;
  }

  if (url === "/wake" && method === "POST") {
    if (AGENT_TOKEN) {
      const headerToken = req.headers["authorization"];
      const expected = `Bearer ${AGENT_TOKEN}`;
      if (headerToken !== expected) {
        log("warn", "Unauthorized wake request", { requestId });
        sendJson(res, 401, { success: false, message: "Unauthorized" });
        return;
      }
    }

    try {
      const body = await readBody(req);
      const { macAddress, broadcastAddress, port, repeat, interval, meta } = body;

      if (!isValidMac(macAddress)) {
        sendJson(res, 400, {
          success: false,
          message: "Invalid or missing macAddress",
        });
        return;
      }

      const result = await sendMagicPacket(macAddress, {
        broadcastAddress: broadcastAddress || undefined,
        port: port ? Number(port) : undefined,
        repeat: repeat ? Number(repeat) : undefined,
        interval: interval ? Number(interval) : undefined,
      });

      log("info", "Magic packet sent", {
        requestId,
        macAddress,
        broadcastAddress: result.broadcastAddress,
        port: result.port,
        packetsSent: result.packetsSent,
        meta,
      });

      sendJson(res, 200, {
        success: true,
        message: `Magic packet sent to ${macAddress}`,
        data: {
          requestId,
          packetsSent: result.packetsSent,
          broadcastAddress: result.broadcastAddress,
          port: result.port,
        },
      });
    } catch (error) {
      log("error", "Failed to send magic packet", { requestId, error: error.message });
      sendJson(res, 500, {
        success: false,
        message: error.message || "Failed to send magic packet",
      });
    }
    return;
  }

  sendJson(res, 404, { success: false, message: "Not Found" });
});

server.listen(PORT, HOST, () => {
  log("info", "Wake-on-LAN agent listening", {
    port: PORT,
    host: HOST,
    hasToken: Boolean(AGENT_TOKEN),
  });
});
