# RushBee Wake-on-LAN Agent

A tiny HTTP service that relays Wake-on-LAN (WOL) requests to PCs on the same local network. Designed for deployment inside RushBee cafés so cloud-hosted tools can trigger on-premises wake events.

## Features

- No external dependencies — uses the Node.js standard library
- Minimal HTTP API (`POST /wake`) that accepts JSON
- Optional bearer-token authentication
- Lightweight logging (JSON) for easy aggregation
- Configurable broadcast address, UDP port, repeat count, and interval
- Runs silently in background (no visible window)
- Automatically handles port conflicts
- Single-file executable - just double-click and run

## Quick Start (Windows)

1. **Build the executable:**
   ```bash
   npm run build:win
   ```

2. **Run it:**
   - Go to the `dist` folder
   - Double-click **`launcher.vbs`**
   - Done! Server is now running in the background

**That's it!** The launcher automatically:
- Kills any existing instance on the same port
- Starts the server in the background
- No console window appears

To stop it, use Task Manager and end the `rushbee-wol-agent-win.exe` process.

## Linux / macOS

Build and run:
```bash
npm run build:linux   # or build:macos
cd dist
./rushbee-wol-agent-linux &
```

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

### Setting Environment Variables for Windows Service

After installing as a service, set environment variables via registry:

1. Open Registry Editor (regedit.exe)
2. Navigate to: `HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\RushBeeWoLAgent`
3. Right-click → New → Multi-String Value → Name it "Environment"
4. Add entries like:
   ```
   PORT=4510
   WOL_AGENT_TOKEN=your-secret-token
   ```
5. Restart the service

Or use PowerShell:
```powershell
sc.exe stop RushBeeWoLAgent
reg add "HKLM\SYSTEM\CurrentControlSet\Services\RushBeeWoLAgent" /v Environment /t REG_MULTI_SZ /d "PORT=4510`0WOL_AGENT_TOKEN=your-token" /f
sc.exe start RushBeeWoLAgent
```

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

### Setting Environment Variables (Windows)

Set environment variables before running the launcher:

```powershell
# PowerShell
$env:PORT = "4510"
$env:WOL_AGENT_TOKEN = "your-secret-token"
```

Or create a batch file in the `dist` folder:

**start-wol-agent.bat:**
```batch
@echo off
set PORT=4510
set WOL_AGENT_TOKEN=your-secret-token
set WOL_BROADCAST=192.168.1.255
cscript //nologo launcher.vbs
```

Then just double-click the batch file instead.rvice]
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
