# TurtureBridge protocol (website <-> Minecraft server plugin)

The plugin calls the website. The website never connects into the server, so the server needs no open port.
Base URL: `<SITE_URL>/api/bridge`. All bodies are JSON.

## Authentication (every request)
Shared secret in env var `BRIDGE_SECRET` on the website, and in the plugin's `config.yml` (`secret`).
Headers:
- `X-Timestamp`: current time in milliseconds
- `X-Signature`: lowercase hex of `HMAC_SHA256(secret, timestamp + "." + rawBody)` (rawBody is "" for GET)
The website rejects a missing/invalid signature (401) or a timestamp more than 5 minutes off (401). Compare in constant time.

## Plugin -> website
| Method + path | Body | Response |
|---|---|---|
| `POST /heartbeat` (every 30 s) | `{ version, mcVersion, software, maxPlayers, tps?, online: [{uuid,name,edition}] }` | `{ ok, settings: { whitelistEnabled, maintenanceMode, maintenanceMessage, allowBedrock } }` |
| `POST /players/sync` (every 5 min and on quit) | `{ players: [{ uuid, name, edition, playtimeMinutes, kills, deaths, balance, rankKey, lastIp? }] }` | `{ ok, upserted }` |
| `POST /events` | `{ type: "punishment", punishment: { type, uuid, name, reason, issuedBy, expiresAt?, ip? } }` (bans done in game are mirrored to the website) | `{ ok }` |
| `GET /commands?limit=20` | - | `{ commands: [{ id, type, payload }] }` (marks them `sent`) |
| `POST /commands/{id}/result` | `{ ok: boolean, message?: string }` | `{ ok }` |

## Command types (website -> plugin, delivered through `GET /commands`)
`payload` fields per `type`:
- `ban` `{ uuid, name, reason, expiresAt?: ISO, ip?: string }` (`ip` set means IP ban)
- `unban` `{ uuid, name }`
- `mute` `{ uuid, name, reason, expiresAt?: ISO }` / `unmute` `{ uuid, name }`
- `kick` `{ uuid, name, reason }` / `warn` `{ uuid, name, reason }`
- `whitelist_add` / `whitelist_remove` `{ uuid, name }`
- `rank_set` `{ uuid, name, rankKey, expiresAt?: ISO }` (LuckPerms group; expiry = temporary parent)
- `rank_remove` `{ uuid, name, rankKey }`
- `tag_set` `{ uuid, name, tagKey: string|null }` (chat tag; null clears it)
- `rank_define` `{ key, displayName, prefix, suffix, weight, inherits: string[], permissions: string[] }` (create/update a LuckPerms group)
- `run_command` `{ command }` (console command, no leading slash)
- `broadcast` `{ message }`
- `reload_settings` `{}`

## Website side (shared code, already written)
- Model `BridgeCommand` (`src/server/models/BridgeCommand.ts`): statuses `pending -> sent -> done | failed`.
- `queueCommand(type, payload, opts)` in `src/server/bridge-queue.ts` is the ONLY way other code asks the server to do something. Never run commands any other way.
- Every admin action that queues a command must also call `audit(...)` from `src/server/audit.ts`.
