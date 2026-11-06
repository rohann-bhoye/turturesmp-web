package org.turturesmp.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.Statistic;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

import java.net.InetSocketAddress;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import java.util.function.LongSupplier;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.Pattern;

/**
 * Owns the schedulers (heartbeat, players sync, command polling), the website settings and the optional hooks.
 * All network I/O is asynchronous; Bukkit API access is marshalled to the main thread.
 */
final class BridgeService {
    private static final Pattern COMMAND_ID = Pattern.compile("[A-Za-z0-9_\\-]{1,64}");
    private static final int SYNC_CHUNK = 100;

    private final TurtureBridge plugin;
    private final Logger log;
    private final ApiClient api;
    private final PunishmentStore store;
    private final PunishmentService punishments;
    private final BridgeCommands commands;
    private final OptionalHooks.Vault vault = new OptionalHooks.Vault();
    private final OptionalHooks.Floodgate floodgate = new OptionalHooks.Floodgate();

    private volatile LuckPermsHook luckPerms; // null when LuckPerms is absent
    private volatile BridgeSettings settings; // null until the first successful heartbeat
    private volatile long lastHeartbeatOk;
    private volatile String serverName = "Turture SMP";

    private volatile long heartbeatMs = 30_000;
    private volatile long pollMs = 5_000;
    private volatile long syncMs = 300_000;

    private final AtomicInteger generation = new AtomicInteger();

    /** Recently executed command ids -> result, so a re-delivered command is never executed twice. */
    private final Map<String, Result> recent = Collections.synchronizedMap(new LinkedHashMap<>(64, 0.75f, false) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Result> eldest) {
            return size() > 500;
        }
    });

    BridgeService(TurtureBridge plugin) {
        this.plugin = plugin;
        this.log = plugin.getLogger();
        this.api = new ApiClient(log);
        this.store = new PunishmentStore(plugin);
        this.punishments = new PunishmentService(log, store);
        this.commands = new BridgeCommands(plugin, this);
    }

    // ---------------------------------------------------------------- accessors

    PunishmentService punishments() {
        return punishments;
    }

    PunishmentStore store() {
        return store;
    }

    LuckPermsHook luckPerms() {
        return luckPerms;
    }

    ApiClient api() {
        return api;
    }

    BridgeSettings settings() {
        return settings;
    }

    OptionalHooks.Floodgate floodgate() {
        return floodgate;
    }

    String serverName() {
        return serverName;
    }

    long lastHeartbeatOk() {
        return lastHeartbeatOk;
    }

    // ---------------------------------------------------------------- lifecycle

    void start() {
        if (luckPerms == null && Bukkit.getPluginManager().getPlugin("LuckPerms") != null) {
            try {
                luckPerms = new LuckPermsHook();
                log.info("LuckPerms found: rank and tag commands enabled.");
            } catch (Throwable t) { // IllegalStateException (not loaded yet) or LinkageError
                log.warning("LuckPerms is installed but its API is not available: " + t);
            }
        }
        applyConfig();
        if (!api.configured()) {
            log.warning("TurtureBridge is idle: set 'url' and 'secret' in plugins/TurtureBridge/config.yml, then run /tsmp reload.");
            return;
        }
        int gen = generation.incrementAndGet();
        loop(gen, 40, () -> heartbeatMs, done -> heartbeat().whenComplete((r, ex) -> done.run()));
        loop(gen, 60, () -> pollMs, this::pollTick);
        loop(gen, 200, () -> syncMs, this::syncTick);
        log.info("Bridge started: " + api.baseUrl() + " (heartbeat " + heartbeatMs / 1000 + "s, poll " + pollMs / 1000
                + "s, sync " + syncMs / 60000 + "min).");
    }

    void stop() {
        generation.incrementAndGet();
        Bukkit.getScheduler().cancelTasks(plugin);
        api.shutdown();
    }

    /** Re-reads config.yml and restarts the loops (used by /tsmp reload). */
    void reload() {
        generation.incrementAndGet(); // pending loop iterations of the old generation exit on their own
        plugin.reloadConfig();
        start();
    }

    private void applyConfig() {
        var c = plugin.getConfig();
        serverName = c.getString("server-name", "Turture SMP");
        heartbeatMs = Math.max(5, c.getInt("heartbeat-seconds", 30)) * 1000L;
        pollMs = Math.max(2, c.getInt("poll-seconds", 5)) * 1000L;
        syncMs = Math.max(1, c.getInt("sync-minutes", 5)) * 60_000L;
        api.configure(c.getString("url", ""), c.getString("secret", ""),
                "TurtureBridge/" + plugin.getPluginMeta().getVersion() + " (" + serverName + ")");
    }

    // ---------------------------------------------------------------- scheduling helpers

    /** Runs on the main thread. Returns false if the plugin is disabled (never throws). */
    boolean runMain(Runnable r) {
        if (!plugin.isEnabled()) return false;
        try {
            Bukkit.getScheduler().runTask(plugin, r);
            return true;
        } catch (RuntimeException e) { // IllegalPluginAccessException during shutdown
            return false;
        }
    }

    private void runLater(long ticks, Runnable r) {
        if (!plugin.isEnabled()) return;
        try {
            Bukkit.getScheduler().runTaskLater(plugin, r, Math.max(1, ticks));
        } catch (RuntimeException ignored) {
            // plugin is shutting down
        }
    }

    /**
     * A self-rescheduling loop: work runs on the main thread, signals completion through {@code done}, and the next
     * run is scheduled after max(interval, current backoff). A slow or failing request therefore never piles up.
     */
    private void loop(int gen, long initialDelayTicks, LongSupplier intervalMs, Consumer<Runnable> work) {
        runLater(initialDelayTicks, () -> {
            if (gen != generation.get()) return;
            AtomicBoolean finished = new AtomicBoolean();
            Runnable done = () -> {
                if (!finished.compareAndSet(false, true)) return;
                if (gen != generation.get()) return;
                long ms = Math.max(intervalMs.getAsLong(), api.backoffMs());
                loop(gen, ms / 50, intervalMs, work);
            };
            try {
                work.accept(done);
            } catch (Throwable t) {
                log.log(Level.FINE, "Bridge loop iteration failed", t);
                done.run();
            }
        });
    }

    // ---------------------------------------------------------------- heartbeat + settings

    /** Must be called on the main thread. Never completes exceptionally. */
    CompletableFuture<Result> heartbeat() {
        JsonObject body = new JsonObject();
        body.addProperty("version", plugin.getPluginMeta().getVersion());
        body.addProperty("mcVersion", Bukkit.getMinecraftVersion());
        body.addProperty("software", Bukkit.getName());
        body.addProperty("maxPlayers", Bukkit.getMaxPlayers());
        double[] tps = Bukkit.getTPS(); // Paper API
        if (tps != null && tps.length > 0) {
            body.addProperty("tps", Math.round(Math.min(20.0, tps[0]) * 100.0) / 100.0);
        }
        JsonArray online = new JsonArray();
        for (Player p : Bukkit.getOnlinePlayers()) {
            JsonObject o = new JsonObject();
            o.addProperty("uuid", p.getUniqueId().toString());
            o.addProperty("name", p.getName());
            o.addProperty("edition", edition(p));
            online.add(o);
        }
        body.add("online", online);

        return api.post("/heartbeat", body.toString()).thenApply(resp -> {
            if (!resp.ok()) {
                return Result.fail("Heartbeat failed: " + (resp.error() != null ? resp.error() : "HTTP " + resp.status()));
            }
            lastHeartbeatOk = System.currentTimeMillis();
            JsonObject reply = Json.parseObject(resp.body());
            JsonObject s = reply == null ? null : Json.obj(reply.get("settings"));
            if (s == null) return Result.ok("Heartbeat ok (no settings in reply).");
            BridgeSettings parsed = BridgeSettings.fromJson(s);
            runMain(() -> applySettings(parsed));
            return Result.ok("Settings refreshed.");
        });
    }

    /** Main thread. */
    private void applySettings(BridgeSettings next) {
        BridgeSettings prev = settings;
        settings = next;

        if (Bukkit.hasWhitelist() != next.whitelistEnabled()) {
            Bukkit.setWhitelist(next.whitelistEnabled());
            log.info("Whitelist " + (next.whitelistEnabled() ? "enabled" : "disabled") + " by the website.");
        }
        boolean maintenanceJustOn = next.maintenanceMode() && (prev == null || !prev.maintenanceMode());
        if (maintenanceJustOn) {
            log.info("Maintenance mode enabled by the website.");
            for (Player p : Bukkit.getOnlinePlayers()) {
                if (!canBypass(p)) p.kick(Component.text(next.maintenanceMessage(), NamedTextColor.YELLOW));
            }
        } else if (prev != null && prev.maintenanceMode() && !next.maintenanceMode()) {
            log.info("Maintenance mode disabled by the website.");
        }
        if (!next.allowBedrock() && (prev == null || prev.allowBedrock())) {
            for (Player p : Bukkit.getOnlinePlayers()) {
                if (!canBypass(p) && floodgate.isBedrock(p.getUniqueId())) {
                    p.kick(Component.text("Bedrock players are not allowed on this server right now.", NamedTextColor.YELLOW));
                }
            }
        }
    }

    boolean canBypass(Player p) {
        return p.isOp() || p.hasPermission("turturebridge.bypass");
    }

    String edition(Player p) {
        return floodgate.isBedrock(p.getUniqueId()) ? "bedrock" : "java";
    }

    // ---------------------------------------------------------------- players sync

    /** Main thread. */
    JsonObject snapshot(Player p) {
        JsonObject o = new JsonObject();
        o.addProperty("uuid", p.getUniqueId().toString());
        o.addProperty("name", p.getName());
        o.addProperty("edition", edition(p));
        long ticks = 0;
        int kills = 0;
        int deaths = 0;
        try {
            // PLAY_ONE_MINUTE is measured in ticks despite its name. API note: newer Paper/Spigot versions may add
            // a PLAY_TIME alias; PLAY_ONE_MINUTE keeps working across 1.21.x.
            ticks = p.getStatistic(Statistic.PLAY_ONE_MINUTE);
            kills = p.getStatistic(Statistic.PLAYER_KILLS);
            deaths = p.getStatistic(Statistic.DEATHS);
        } catch (RuntimeException e) {
            log.log(Level.FINE, "Could not read statistics for " + p.getName(), e);
        }
        o.addProperty("playtimeMinutes", ticks / 20L / 60L);
        o.addProperty("kills", kills);
        o.addProperty("deaths", deaths);
        o.addProperty("balance", vault.balance(p));
        LuckPermsHook lp = luckPerms;
        String rank = null;
        if (lp != null) {
            try {
                rank = lp.topGroup(p.getUniqueId());
            } catch (RuntimeException e) {
                log.log(Level.FINE, "Could not read rank for " + p.getName(), e);
            }
        }
        o.addProperty("rankKey", rank == null ? "default" : rank);
        InetSocketAddress addr = p.getAddress();
        if (addr != null && addr.getAddress() != null) {
            o.addProperty("lastIp", addr.getAddress().getHostAddress());
        }
        return o;
    }

    private void syncTick(Runnable done) {
        List<JsonObject> snaps = new ArrayList<>();
        for (Player p : Bukkit.getOnlinePlayers()) snaps.add(snapshot(p));
        if (snaps.isEmpty()) {
            done.run();
            return;
        }
        List<CompletableFuture<?>> pending = new ArrayList<>();
        for (int i = 0; i < snaps.size(); i += SYNC_CHUNK) {
            JsonArray arr = new JsonArray();
            for (JsonObject s : snaps.subList(i, Math.min(snaps.size(), i + SYNC_CHUNK))) arr.add(s);
            JsonObject body = new JsonObject();
            body.add("players", arr);
            pending.add(api.post("/players/sync", body.toString()));
        }
        CompletableFuture.allOf(pending.toArray(new CompletableFuture<?>[0])).whenComplete((v, ex) -> done.run());
    }

    /** Main thread: syncs one player reliably (used on quit and shortly after join). */
    void syncPlayerLater(Player p) {
        if (!api.configured()) return;
        JsonObject body = new JsonObject();
        JsonArray arr = new JsonArray();
        arr.add(snapshot(p));
        body.add("players", arr);
        api.enqueue("/players/sync", body.toString());
    }

    // ---------------------------------------------------------------- command polling

    private void pollTick(Runnable done) {
        api.flush(); // retry undelivered results / events first
        api.get("/commands?limit=20").whenComplete((resp, ex) -> {
            if (ex != null || resp == null || !resp.ok()) {
                done.run();
                return;
            }
            JsonObject root = Json.parseObject(resp.body());
            List<JsonObject> list = new ArrayList<>();
            if (root != null && root.get("commands") != null && root.get("commands").isJsonArray()) {
                root.getAsJsonArray("commands").forEach(e -> {
                    JsonObject o = Json.obj(e);
                    if (o != null) list.add(o);
                });
            }
            runCommands(list, 0, done);
        });
    }

    /** Executes the batch sequentially (preserves order, e.g. rank_define before rank_set). */
    private void runCommands(List<JsonObject> list, int index, Runnable done) {
        if (index >= list.size()) {
            done.run();
            return;
        }
        JsonObject c = list.get(index);
        String id = Json.str(c, "id");
        String type = Json.str(c, "type");
        if (id == null || !COMMAND_ID.matcher(id).matches() || type == null) {
            runCommands(list, index + 1, done);
            return;
        }
        JsonObject payload = Json.obj(c.get("payload"));
        if (payload == null) payload = new JsonObject();

        Result cached = recent.get(id);
        CompletableFuture<Result> f = cached != null
                ? CompletableFuture.completedFuture(cached) // already executed: just re-report, never run twice
                : commands.execute(type, payload);
        f.whenComplete((r, ex) -> {
            Result result = r != null ? r : Result.fail("Internal error");
            recent.put(id, result);
            JsonObject body = new JsonObject();
            body.addProperty("ok", result.ok());
            String msg = result.message() == null ? "" : result.message();
            body.addProperty("message", msg.length() > 500 ? msg.substring(0, 500) : msg);
            api.enqueue("/commands/" + id + "/result", body.toString());
            if (!result.ok()) log.warning("Command " + type + " (" + id + ") failed: " + msg);
            runCommands(list, index + 1, done);
        });
    }

    // ---------------------------------------------------------------- events

    /** Mirrors an in-game punishment to the website (retried until delivered). */
    void postPunishment(String type, java.util.UUID uuid, String name, String reason, String issuedBy,
                        java.time.Instant expiresAt, String ip) {
        if (!api.configured()) return;
        JsonObject pun = new JsonObject();
        pun.addProperty("type", type);
        pun.addProperty("uuid", uuid.toString());
        pun.addProperty("name", name);
        pun.addProperty("reason", reason);
        pun.addProperty("issuedBy", issuedBy);
        if (expiresAt != null) pun.addProperty("expiresAt", expiresAt.toString());
        if (ip != null) pun.addProperty("ip", ip);
        JsonObject body = new JsonObject();
        body.addProperty("type", "punishment");
        body.add("punishment", pun);
        api.enqueue("/events", body.toString());
    }
}
