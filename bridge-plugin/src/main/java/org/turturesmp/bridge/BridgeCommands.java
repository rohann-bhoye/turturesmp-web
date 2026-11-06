package org.turturesmp.bridge;

import com.google.gson.JsonObject;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.logging.Logger;

/**
 * Executes the website command types listed in docs/BRIDGE_API.md.
 * Bukkit API calls always run on the main thread; LuckPerms calls are asynchronous futures.
 */
final class BridgeCommands {
    private static final String SOURCE = "TurtureWeb";

    private final TurtureBridge plugin;
    private final BridgeService service;
    private final Logger log;

    BridgeCommands(TurtureBridge plugin, BridgeService service) {
        this.plugin = plugin;
        this.service = service;
        this.log = plugin.getLogger();
    }

    /** Never completes exceptionally. */
    CompletableFuture<Result> execute(String type, JsonObject p) {
        CompletableFuture<Result> out = new CompletableFuture<>();
        boolean scheduled = service.runMain(() -> {
            try {
                handle(type, p).whenComplete((r, ex) -> {
                    if (ex != null) {
                        Throwable c = ex.getCause() != null ? ex.getCause() : ex;
                        out.complete(Result.fail(c.getMessage() != null ? c.getMessage() : c.getClass().getSimpleName()));
                    } else {
                        out.complete(r);
                    }
                });
            } catch (Throwable t) { // a command must never take the server down
                log.warning("Command '" + type + "' threw " + t);
                out.complete(Result.fail("Internal error: " + t.getClass().getSimpleName() + ": " + t.getMessage()));
            }
        });
        if (!scheduled) out.complete(Result.fail("Plugin is shutting down"));
        return out.orTimeout(45, TimeUnit.SECONDS).exceptionally(ex -> Result.fail("Timed out waiting for the server"));
    }

    private CompletableFuture<Result> handle(String type, JsonObject p) {
        PunishmentService pun = service.punishments();
        return switch (type) {
            case "ban" -> sync(() -> {
                UUID id = uuid(p);
                String name = name(p);
                Instant exp = instant(p, "expiresAt");
                String ip = Json.str(p, "ip");
                return pun.ban(id, name, Json.str(p, "reason"), exp, ip == null || ip.isBlank() ? null : ip, SOURCE);
            });
            case "unban" -> sync(() -> pun.unban(uuid(p), name(p), Json.str(p, "ip")));
            case "mute" -> sync(() -> pun.mute(uuid(p), name(p), Json.str(p, "reason"), instant(p, "expiresAt"), SOURCE));
            case "unmute" -> sync(() -> pun.unmute(uuid(p), name(p)));
            case "kick" -> sync(() -> pun.kick(uuid(p), name(p), Json.str(p, "reason")));
            case "warn" -> sync(() -> pun.warn(uuid(p), name(p), Json.str(p, "reason")));
            case "whitelist_add" -> sync(() -> whitelist(uuid(p), name(p), true));
            case "whitelist_remove" -> sync(() -> whitelist(uuid(p), name(p), false));
            case "rank_set" -> rankSet(p);
            case "rank_remove" -> rankRemove(p);
            case "tag_set" -> tagSet(p);
            case "rank_define" -> rankDefine(p);
            case "run_command" -> sync(() -> runCommand(Json.str(p, "command")));
            case "broadcast" -> sync(() -> broadcast(Json.str(p, "message")));
            case "reload_settings" -> service.heartbeat();
            default -> CompletableFuture.completedFuture(Result.fail("Unsupported command type: " + type));
        };
    }

    // ---------------------------------------------------------------- simple handlers

    private interface Task {
        Result run() throws IllegalArgumentException;
    }

    /** Runs a synchronous handler, mapping validation errors to a failed result. */
    private static CompletableFuture<Result> sync(Task t) {
        try {
            return CompletableFuture.completedFuture(t.run());
        } catch (IllegalArgumentException e) {
            return CompletableFuture.completedFuture(Result.fail(e.getMessage()));
        }
    }

    private Result whitelist(UUID uuid, String name, boolean add) {
        OfflinePlayer op = Bukkit.getOfflinePlayer(uuid);
        if (op.isWhitelisted() != add) op.setWhitelisted(add); // already in the wanted state = idempotent success
        Bukkit.reloadWhitelist();
        log.info((add ? "Whitelisted " : "Removed from whitelist: ") + name + " (" + uuid + ")");
        return Result.ok((add ? "Added " : "Removed ") + name + (add ? " to" : " from") + " the whitelist.");
    }

    private Result runCommand(String command) {
        if (command == null || command.isBlank()) return Result.fail("Missing 'command'.");
        String c = command.trim();
        while (c.startsWith("/")) c = c.substring(1);
        if (c.isEmpty()) return Result.fail("Empty command.");
        log.info("Website console command: /" + c);
        boolean ok = Bukkit.dispatchCommand(Bukkit.getConsoleSender(), c);
        return ok ? Result.ok("Executed: /" + c) : Result.fail("Command returned false (unknown command or bad usage): /" + c);
    }

    private Result broadcast(String message) {
        if (message == null || message.isBlank()) return Result.fail("Missing 'message'.");
        String prefix = plugin.getConfig().getString("broadcast-prefix", "");
        Component c = LegacyComponentSerializer.legacyAmpersand().deserialize(prefix + message);
        Bukkit.broadcast(c);
        return Result.ok("Broadcast sent.");
    }

    // ---------------------------------------------------------------- LuckPerms handlers

    private LuckPermsHook lp() {
        return service.luckPerms();
    }

    private static final Result NO_LP = Result.fail("LuckPerms is not installed on this server.");

    private CompletableFuture<Result> rankSet(JsonObject p) {
        LuckPermsHook lp = lp();
        if (lp == null) return CompletableFuture.completedFuture(NO_LP);
        try {
            UUID id = uuid(p);
            String key = required(p, "rankKey");
            Instant exp = instant(p, "expiresAt");
            if (exp != null && !exp.isAfter(Instant.now())) {
                return CompletableFuture.completedFuture(Result.ok("Rank expiry already in the past; nothing to do."));
            }
            return lp.setRank(id, key, exp).thenApply(v -> {
                log.info("Rank set: " + name(p) + " -> " + key + (exp != null ? " until " + exp : ""));
                return Result.ok("Set rank " + key + " for " + name(p) + (exp != null ? " until " + exp : "") + ".");
            });
        } catch (IllegalArgumentException e) {
            return CompletableFuture.completedFuture(Result.fail(e.getMessage()));
        }
    }

    private CompletableFuture<Result> rankRemove(JsonObject p) {
        LuckPermsHook lp = lp();
        if (lp == null) return CompletableFuture.completedFuture(NO_LP);
        try {
            UUID id = uuid(p);
            String key = required(p, "rankKey");
            return lp.removeRank(id, key).thenApply(v -> {
                log.info("Rank removed: " + name(p) + " -/-> " + key);
                return Result.ok("Removed rank " + key + " from " + name(p) + ".");
            });
        } catch (IllegalArgumentException e) {
            return CompletableFuture.completedFuture(Result.fail(e.getMessage()));
        }
    }

    private CompletableFuture<Result> tagSet(JsonObject p) {
        LuckPermsHook lp = lp();
        if (lp == null) return CompletableFuture.completedFuture(NO_LP);
        try {
            UUID id = uuid(p);
            String tag = Json.str(p, "tagKey"); // JSON null / missing clears the tag
            return lp.setTag(id, tag).thenApply(v -> Result.ok(tag == null || tag.isBlank()
                    ? "Cleared tag for " + name(p) + "."
                    : "Set tag '" + tag + "' for " + name(p) + "."));
        } catch (IllegalArgumentException e) {
            return CompletableFuture.completedFuture(Result.fail(e.getMessage()));
        }
    }

    private CompletableFuture<Result> rankDefine(JsonObject p) {
        LuckPermsHook lp = lp();
        if (lp == null) return CompletableFuture.completedFuture(NO_LP);
        try {
            String key = required(p, "key");
            String display = Json.str(p, "displayName");
            String prefix = Json.str(p, "prefix");
            String suffix = Json.str(p, "suffix");
            int weight = Json.integer(p, "weight", 0);
            return lp.defineGroup(key, display, prefix, suffix, weight, Json.stringList(p, "inherits"), Json.stringList(p, "permissions"))
                    .thenApply(v -> {
                        log.info("Rank defined: " + key + " (weight " + weight + ")");
                        return Result.ok("Group '" + LuckPermsHook.groupName(key) + "' created/updated.");
                    });
        } catch (IllegalArgumentException e) {
            return CompletableFuture.completedFuture(Result.fail(e.getMessage()));
        }
    }

    // ---------------------------------------------------------------- payload helpers

    static UUID uuid(JsonObject p) {
        String s = Json.str(p, "uuid");
        if (s == null || s.isBlank()) throw new IllegalArgumentException("Missing 'uuid'.");
        try {
            return UUID.fromString(s.trim());
        } catch (IllegalArgumentException e) {
            // Accept 32-char UUIDs without dashes.
            String t = s.trim().replace("-", "");
            if (t.length() == 32) {
                try {
                    return UUID.fromString(t.replaceFirst("(\\p{XDigit}{8})(\\p{XDigit}{4})(\\p{XDigit}{4})(\\p{XDigit}{4})(\\p{XDigit}+)", "$1-$2-$3-$4-$5"));
                } catch (IllegalArgumentException ignored) {
                    // fall through
                }
            }
            throw new IllegalArgumentException("Invalid uuid: " + s);
        }
    }

    static String name(JsonObject p) {
        String n = Json.str(p, "name");
        return n == null || n.isBlank() ? "unknown" : n;
    }

    private static String required(JsonObject p, String key) {
        String v = Json.str(p, key);
        if (v == null || v.isBlank()) throw new IllegalArgumentException("Missing '" + key + "'.");
        return v;
    }

    /** Parses an optional ISO-8601 timestamp; null/missing means "no expiry". */
    static Instant instant(JsonObject p, String key) {
        String s = Json.str(p, key);
        if (s == null || s.isBlank()) return null;
        try {
            return Instant.parse(s.trim());
        } catch (DateTimeParseException e) {
            try {
                return OffsetDateTime.parse(s.trim()).toInstant();
            } catch (DateTimeParseException e2) {
                throw new IllegalArgumentException("Invalid " + key + ": " + s);
            }
        }
    }
}
