# TurtureBridge

Paper plugin (1.21.x, Java 21) that connects the Turture SMP website to the Minecraft server.

The plugin always calls the website; the website never connects in, so the server needs no open port.
The protocol is defined in [`docs/BRIDGE_API.md`](../docs/BRIDGE_API.md) and is binding for both sides.

## What it does

| Feature | Details |
|---|---|
| Heartbeat | Every `heartbeat-seconds`: version, MC version, software, max players, TPS, online players (uuid, name, edition). The reply carries the website settings (maintenance, whitelist, Bedrock). |
| Players sync | Every `sync-minutes`, 5 s after a join and on quit: playtime (minutes), kills, deaths, Vault balance, rank, last IP. |
| Command queue | Polls `GET /commands` every `poll-seconds`, executes every command type of the spec in order, reports `POST /commands/{id}/result`. |
| Settings | Maintenance mode (kicks everyone without `turturebridge.bypass`/op, also players already online when it switches on), whitelist flag, `allowBedrock`. |
| Mutes | `mutes.yml`; muted players cannot chat or use the commands listed in `muted-blocked-commands`. |
| Placeholder | `%turture_tag%` (PlaceholderAPI) returns the LuckPerms meta `turture_tag`. |
| In-game moderation | `/tsmp ...` runs locally and mirrors the punishment to the website (`POST /events`). |

## Install

1. Build (see below) or take `build/libs/TurtureBridge-1.0.0.jar` and put it into `plugins/`.
2. Start the server once, then edit `plugins/TurtureBridge/config.yml` (`url`, `secret`).
3. Set the same secret as `BRIDGE_SECRET` on the website. Run `/tsmp reload` (or restart) and check `/tsmp status`.

Optional plugins (all soft dependencies, nothing breaks without them):
**LuckPerms** (ranks, tags, rank definitions), **Vault** + an economy plugin (balance), **PlaceholderAPI** (`%turture_tag%`), **Floodgate** (exact Bedrock detection; without it Bedrock players are recognised by their Floodgate-style UUID).

## Build

Requires JDK 21 and access to Maven Central, `repo.papermc.io` and `repo.extendedclip.com`.

```
cd bridge-plugin
./gradlew build          # or: gradle build
```

The jar is written to `build/libs/TurtureBridge-<version>.jar`. The Gradle wrapper (8.14.3) is included.

## Configuration (`config.yml`)

| Key | Default | Meaning |
|---|---|---|
| `url` | `""` | Website base URL, no `/api/bridge`, no trailing slash. Must be the final URL (redirects are not followed because they would drop the signed body). |
| `secret` | `""` | Shared secret = `BRIDGE_SECRET` on the website. |
| `server-name` | `Turture SMP` | Label used in `/tsmp status` and the User-Agent. |
| `heartbeat-seconds` | `30` | Minimum 5. |
| `poll-seconds` | `5` | Minimum 2. |
| `sync-minutes` | `5` | Minimum 1. |
| `broadcast-prefix` | `&6[Turture] &f` | Prefix of `broadcast` commands. |
| `muted-blocked-commands` | `msg, tell, ...` | Commands blocked for muted players. |
| `tags` | `{}` | Optional map tag key -> display text for `%turture_tag%`. |

The plugin stays idle (with one console warning) until `url` and `secret` are set.

## Permissions and commands

| Permission | Default | Use |
|---|---|---|
| `turturebridge.staff` | op | All `/tsmp` subcommands |
| `turturebridge.bypass` | op | Join during maintenance / when Bedrock is disallowed |

```
/tsmp ban <player> [reason]
/tsmp tempban <player> <30m|12h|7d|2w|1d12h> [reason]
/tsmp ipban <online player> [reason]
/tsmp unban <player>
/tsmp mute <player> [duration] [reason]
/tsmp unmute <player>
/tsmp reload
/tsmp status
```

Targets must be online or have joined the server before (no blocking Mojang lookups). Each moderation command is
applied locally and sent as `{ type: "punishment", punishment: { type, uuid, name, reason, issuedBy, expiresAt?, ip? } }`.
Types sent: `ban`, `tempban`, `ipban`, `mute`, `tempmute`, and also `unban` / `unmute` when a punishment is lifted.
**Note:** `unban` / `unmute` are not in BRIDGE_API.md; the website should treat them as "revoke the active punishment" or ignore them.

## Behaviour of the website commands

- `ban` / `unban`: Bukkit profile ban list (`BanList.Type.PROFILE`), `expiresAt` = temporary. With `ip`, the IP is banned too and
  the player plus anyone online from that IP is kicked; the IP is remembered in `ipbans.yml` so `unban` lifts it. Online players are kicked on ban.
- `mute` / `unmute`: stored in `mutes.yml`, survives restarts, expires automatically.
- `kick`, `warn` (message + console log), `whitelist_add` / `whitelist_remove`, `run_command` (as console, one log line each), `broadcast`.
- `rank_set`: grants the LuckPerms group as parent; `expiresAt` makes it a temporary parent. A permanent grant also becomes the stored
  primary group. The group must exist (send `rank_define` first), otherwise the command fails with a clear message.
  Other groups of the player are left untouched.
- `rank_remove`: removes the parent; resets the stored primary group to `default` if it was that group.
- `rank_define`: creates/updates the group; weight, display name, prefix, suffix, parents and permissions are replaced by the
  website definition (a permission starting with `-` is negated). Treat the website as the source of truth for these groups.
- `tag_set`: sets LuckPerms meta `turture_tag` for the user, `null` clears it.
- `reload_settings`: sends a heartbeat immediately and applies the returned settings.
- The `rankKey` reported to the website is the inherited group with the highest weight (so temporary ranks show up); it is `default` without LuckPerms.

## Reliability

- All HTTP is asynchronous (`java.net.http.HttpClient`); the main thread only builds snapshots and runs Bukkit calls.
- Requests are signed with `HMAC_SHA256(secret, timestamp + "." + rawBody)` (lowercase hex) in `X-Signature`, with `X-Timestamp` in ms.
  A 401 usually means a wrong secret or a server clock more than 5 minutes off.
- When the website is unreachable (network error, 5xx, 401/403, redirect) the plugin backs off exponentially (5 s up to 5 min) and logs
  the problem once, then at most every 10 minutes, and logs when the connection is restored.
- Command results and mirrored punishments go through an in-memory outbox (max 500) and are retried until accepted.
- A command id that is delivered again is not executed twice; the stored result is simply re-reported. Ban, unban, whitelist, rank and tag operations are idempotent anyway.
- Every command handler runs inside a try/catch; a failing command only produces `ok:false`.
- Before the first successful heartbeat no settings are applied (fail open: an unreachable website cannot lock players out).

## Not covered / limits

- Vanilla `/ban`, `/pardon` etc. are not intercepted (use `/tsmp ...` for punishments that must reach the website).
- Outbox and the executed-command cache are in memory only: a server crash can lose undelivered results (the website then sees the command stuck in `sent`).
- Website settings are not cached on disk; after a restart they are applied again at the first successful heartbeat.
