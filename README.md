# RushBee Wake-on-LAN Agent

A tiny HTTP service that relays Wake-on-LAN (WOL) requests to PCs on the same local network. Designed for deployment inside RushBee cafés so cloud-hosted tools can trigger on-premises wake events.

## Features

- No external dependencies — uses the Node.js standard library.
- Minimal HTTP API (`POST /wake`) that accepts JSON.
- Optional bearer-token authentication.
- Lightweight logging (JSON) for easy aggregation.
- Configurable broadcast address, UDP port, repeat count, and interval.

## Requirements

- Node.js 18+ (built on standard modules: `http`, `dgram`, `crypto`).
- Network permissions to send UDP broadcast packets.

## Installation

```bash
npm install
```

(There are no external packages, but the step ensures lockfiles stay in sync.)

## Configuration

Set environment variables as needed:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `4510` | HTTP server port |
| `HOST` | `0.0.0.0` | Interface to bind |
| `WOL_AGENT_TOKEN` | _(empty)_ | Optional bearer token (`Authorization: Bearer <token>`) required on `/wake` |
| `WOL_BROADCAST` | `255.255.255.255` | Default broadcast address |
| `WOL_PORT` | `9` | Default UDP port for magic packets |
| `WOL_REPEAT` | `3` | Number of packets sent per request |
| `WOL_INTERVAL_MS` | `120` | Delay (ms) between repeated packets |
| `CORS_ORIGIN` | `*` | Value for `Access-Control-Allow-Origin` |

Create a `.env` file (ignored by git) or export variables before launching.

Example `.env`:

```
PORT=4510
WOL_AGENT_TOKEN=super-secret-token
WOL_BROADCAST=192.168.1.255
CORS_ORIGIN=http://pos.local
```

## Running the agent

```bash
npm start
```

You should see a log entry similar to:

```
{"time":"2025-10-12T10:03:00.000Z","level":"info","message":"Wake-on-LAN agent listening","port":4510,"host":"0.0.0.0","hasToken":true}
```

## API

### `GET /health`

Returns 200 with `{ "status": "ok" }` for monitoring.

### `POST /wake`

Send a magic packet to a MAC address.

**Headers**

- `Content-Type: application/json`
- `Authorization: Bearer <token>` (only if `WOL_AGENT_TOKEN` is set)

**Body**

```json
{
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "broadcastAddress": "192.168.1.255",      // optional
  "port": 9,                                   // optional
  "repeat": 3,                                 // optional
  "interval": 120,                             // optional (ms between packets)
  "meta": { "seatId": "...", "seatNumber": "..." } // optional, echoed in logs
}
```

**Responses**

- `200 OK` `{ success: true, message, data }`
- `400 Bad Request` for missing/invalid MAC address or malformed JSON
- `401 Unauthorized` if token required and missing/incorrect
- `500 Internal Server Error` if UDP send fails

## Systemd service example

```ini
[Unit]
Description=RushBee Wake-on-LAN Agent
After=network.target

[Service]
WorkingDirectory=/opt/rushbee/wol-agent
ExecStart=/usr/bin/node src/index.js
Environment=WOL_AGENT_TOKEN=super-secret
Environment=WOL_BROADCAST=192.168.1.255
Restart=always
User=pos
Group=pos

[Install]
WantedBy=multi-user.target
```

## Notes

- The agent must run inside the same LAN as the target PCs.
- Ensure the host firewall allows outbound UDP broadcasts on the specified port.
- For redundancy, deploy multiple agents and point each café configuration to the nearest one.
