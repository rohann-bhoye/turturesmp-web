package org.turturesmp.bridge;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.ConsoleCommandSender;
import org.bukkit.command.TabExecutor;
import org.bukkit.entity.Player;

import java.net.InetSocketAddress;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * /tsmp ban|tempban|ipban|unban|mute|unmute|reload|status.
 * Moderation sub-commands execute locally and are mirrored to the website via POST /events.
 * NOTE: the lifting events use the types "unban" / "unmute", which are not listed in BRIDGE_API.md.
 */
final class TsmpCommand implements TabExecutor {
    private static final List<String> SUBS = List.of("ban", "tempban", "ipban", "unban", "mute", "unmute", "reload", "status");

    private final TurtureBridge plugin;
    private final BridgeService service;

    TsmpCommand(TurtureBridge plugin, BridgeService service) {
        this.plugin = plugin;
        this.service = service;
    }

    private record Target(UUID uuid, String name, Player online) {}

    @Override
    public boolean onCommand(CommandSender sender, Command cmd, String label, String[] args) {
        if (!sender.hasPermission("turturebridge.staff")) {
            sender.sendMessage(Component.text("You do not have permission.", NamedTextColor.RED));
            return true;
        }
        if (args.length == 0) {
            usage(sender);
            return true;
        }
        try {
            switch (args[0].toLowerCase(Locale.ROOT)) {
                case "ban" -> ban(sender, args, null, false);
                case "tempban" -> {
                    if (args.length < 3) return usage(sender, "/tsmp tempban <player> <duration e.g. 7d> [reason]");
                    Duration d = Durations.parse(args[2]);
                    if (d == null) return usage(sender, "Invalid duration '" + args[2] + "'. Examples: 30m, 12h, 7d, 2w, 1d12h");
                    ban(sender, args, d, false);
                }
                case "ipban" -> ban(sender, args, null, true);
                case "unban" -> unban(sender, args);
                case "mute" -> mute(sender, args);
                case "unmute" -> unmute(sender, args);
                case "reload" -> {
                    service.reload();
                    reply(sender, "Configuration reloaded.", NamedTextColor.GREEN);
                }
                case "status" -> status(sender);
                default -> usage(sender);
            }
        } catch (RuntimeException e) {
            reply(sender, "Error: " + e.getMessage(), NamedTextColor.RED);
            plugin.getLogger().warning("/tsmp failed: " + e);
        }
        return true;
    }

    // ---------------------------------------------------------------- sub-commands

    private void ban(CommandSender sender, String[] args, Duration duration, boolean ipBan) {
        int reasonFrom = duration != null ? 3 : 2;
        if (args.length < 2) {
            usage(sender, duration != null ? "/tsmp tempban <player> <duration> [reason]"
                    : ipBan ? "/tsmp ipban <online player> [reason]" : "/tsmp ban <player> [reason]");
            return;
        }
        Target t = resolve(sender, args[1]);
        if (t == null) return;
        String ip = null;
        if (ipBan) {
            if (t.online() == null || t.online().getAddress() == null) {
                reply(sender, "IP ban needs the player to be online (their IP is read from the connection).", NamedTextColor.RED);
                return;
            }
            InetSocketAddress a = t.online().getAddress();
            ip = a.getAddress().getHostAddress();
        }
        String reason = join(args, reasonFrom);
        Instant expires = duration != null ? Instant.now().plus(duration) : null;
        String by = issuer(sender);

        Result r = service.punishments().ban(t.uuid(), t.name(), reason, expires, ip, by);
        report(sender, r);
        if (r.ok()) {
            String type = ipBan ? "ipban" : duration != null ? "tempban" : "ban";
            service.postPunishment(type, t.uuid(), t.name(), PunishmentService.reasonOrDefault(reason), by, expires, ip);
        }
    }

    private void unban(CommandSender sender, String[] args) {
        if (args.length < 2) {
            usage(sender, "/tsmp unban <player>");
            return;
        }
        Target t = resolve(sender, args[1]);
        if (t == null) return;
        Result r = service.punishments().unban(t.uuid(), t.name(), null);
        report(sender, r);
        if (r.ok()) service.postPunishment("unban", t.uuid(), t.name(), "Unbanned in game", issuer(sender), null, null);
    }

    private void mute(CommandSender sender, String[] args) {
        if (args.length < 2) {
            usage(sender, "/tsmp mute <player> [duration] [reason]");
            return;
        }
        Target t = resolve(sender, args[1]);
        if (t == null) return;
        Duration d = args.length >= 3 ? Durations.parse(args[2]) : null;
        String reason = join(args, d != null ? 3 : 2);
        Instant expires = d != null ? Instant.now().plus(d) : null;
        String by = issuer(sender);

        Result r = service.punishments().mute(t.uuid(), t.name(), reason, expires, by);
        report(sender, r);
        if (r.ok()) {
            service.postPunishment(d != null ? "tempmute" : "mute", t.uuid(), t.name(),
                    PunishmentService.reasonOrDefault(reason), by, expires, null);
        }
    }

    private void unmute(CommandSender sender, String[] args) {
        if (args.length < 2) {
            usage(sender, "/tsmp unmute <player>");
            return;
        }
        Target t = resolve(sender, args[1]);
        if (t == null) return;
        Result r = service.punishments().unmute(t.uuid(), t.name());
        report(sender, r);
        if (r.ok()) service.postPunishment("unmute", t.uuid(), t.name(), "Unmuted in game", issuer(sender), null, null);
    }

    private void status(CommandSender sender) {
        ApiClient api = service.api();
        BridgeSettings s = service.settings();
        long last = service.lastHeartbeatOk();
        reply(sender, "TurtureBridge " + plugin.getPluginMeta().getVersion() + " (" + service.serverName() + ")", NamedTextColor.GOLD);
        reply(sender, "Website: " + (api.configured() ? api.baseUrl() : "NOT CONFIGURED"), NamedTextColor.GRAY);
        reply(sender, "Connection: " + (!api.configured() ? "idle" : api.healthy() ? "OK" : "FAILING (backoff " + api.backoffMs() / 1000 + "s)")
                + ", last heartbeat: " + (last == 0 ? "never" : ((System.currentTimeMillis() - last) / 1000) + "s ago")
                + ", undelivered: " + api.outboxSize(), NamedTextColor.GRAY);
        reply(sender, "Settings: " + (s == null ? "not received yet"
                : "maintenance=" + s.maintenanceMode() + ", whitelist=" + s.whitelistEnabled() + ", bedrock=" + s.allowBedrock()), NamedTextColor.GRAY);
        reply(sender, "LuckPerms: " + (service.luckPerms() != null) + ", Vault: " + (Bukkit.getPluginManager().getPlugin("Vault") != null)
                + ", PlaceholderAPI: " + (Bukkit.getPluginManager().getPlugin("PlaceholderAPI") != null)
                + ", Floodgate: " + (Bukkit.getPluginManager().getPlugin("floodgate") != null), NamedTextColor.GRAY);
    }

    // ---------------------------------------------------------------- helpers

    private Target resolve(CommandSender sender, String name) {
        Player online = Bukkit.getPlayerExact(name);
        if (online != null) return new Target(online.getUniqueId(), online.getName(), online);
        // Paper: only returns players the server has seen before; never does a blocking Mojang lookup.
        OfflinePlayer op = Bukkit.getOfflinePlayerIfCached(name);
        if (op != null) return new Target(op.getUniqueId(), op.getName() != null ? op.getName() : name, null);
        reply(sender, "Unknown player '" + name + "' (they must have joined this server before).", NamedTextColor.RED);
        return null;
    }

    private static String issuer(CommandSender s) {
        return s instanceof ConsoleCommandSender ? "Console" : s.getName();
    }

    private static String join(String[] args, int from) {
        return args.length > from ? String.join(" ", Arrays.copyOfRange(args, from, args.length)) : null;
    }

    private static void report(CommandSender s, Result r) {
        reply(s, r.message(), r.ok() ? NamedTextColor.GREEN : NamedTextColor.RED);
    }

    private static void reply(CommandSender s, String msg, NamedTextColor color) {
        s.sendMessage(Component.text(msg, color));
    }

    private static void usage(CommandSender s) {
        reply(s, "Usage: /tsmp <ban|tempban|ipban|unban|mute|unmute|reload|status> ...", NamedTextColor.YELLOW);
    }

    private static boolean usage(CommandSender s, String msg) {
        reply(s, msg, NamedTextColor.YELLOW);
        return true;
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command cmd, String alias, String[] args) {
        if (!sender.hasPermission("turturebridge.staff")) return List.of();
        List<String> out = new ArrayList<>();
        if (args.length == 1) {
            for (String s : SUBS) if (s.startsWith(args[0].toLowerCase(Locale.ROOT))) out.add(s);
        } else if (args.length == 2 && !args[0].equalsIgnoreCase("reload") && !args[0].equalsIgnoreCase("status")) {
            for (Player p : Bukkit.getOnlinePlayers()) {
                if (p.getName().toLowerCase(Locale.ROOT).startsWith(args[1].toLowerCase(Locale.ROOT))) out.add(p.getName());
            }
        } else if (args.length == 3 && (args[0].equalsIgnoreCase("tempban") || args[0].equalsIgnoreCase("mute"))) {
            out.addAll(List.of("30m", "1h", "1d", "7d", "30d"));
        }
        return out;
    }
}
