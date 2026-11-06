package org.turturesmp.bridge;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.BanList;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.profile.PlayerProfile;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import java.util.logging.Logger;
import java.util.regex.Pattern;

/**
 * Applies punishments locally. Every method MUST be called on the main server thread.
 * Used by both the website command executor and the in-game /tsmp commands.
 */
final class PunishmentService {
    private static final Pattern IP_LITERAL = Pattern.compile("[0-9a-fA-F:.]+");

    private final Logger log;
    private final PunishmentStore store;

    PunishmentService(Logger log, PunishmentStore store) {
        this.log = log;
        this.store = store;
    }

    PunishmentStore store() {
        return store;
    }

    static String reasonOrDefault(String reason) {
        return reason == null || reason.isBlank() ? "No reason given" : reason.trim();
    }

    // ---------------------------------------------------------------- ban

    /**
     * Bans a player by profile (and additionally by IP when {@code ip} is given), then kicks them.
     * Re-banning an already banned player simply replaces the entry, so this is idempotent.
     * API note: {@code Bukkit.getBanList(BanList.Type)} is the long-standing entry point; recent Paper versions
     * also offer {@code getBanList(BanListType)}. The Type-based call still works on all 1.21.x builds.
     */
    @SuppressWarnings({"deprecation", "unchecked"})
    Result ban(UUID uuid, String name, String reason, Instant expiresAt, String ip, String source) {
        final String why = reasonOrDefault(reason);
        if (expiresAt != null && !expiresAt.isAfter(Instant.now())) {
            return Result.ok("Ban already expired; nothing to do.");
        }
        final Date expires = expiresAt == null ? null : Date.from(expiresAt);

        InetAddress addr = null;
        if (ip != null && !ip.isBlank()) {
            addr = parseIp(ip);
            if (addr == null) return Result.fail("Invalid IP address: " + ip);
        }

        BanList<PlayerProfile> profileBans = Bukkit.getBanList(BanList.Type.PROFILE);
        PlayerProfile profile = Bukkit.createPlayerProfile(uuid, name);
        profileBans.addBan(profile, why, expires, source);

        if (addr != null) {
            BanList<InetAddress> ipBans = Bukkit.getBanList(BanList.Type.IP);
            ipBans.addBan(addr, why, expires, source);
            store.rememberIpBan(uuid, addr.getHostAddress());
        }

        String screen = banScreen(why, expiresAt, addr != null);
        Player online = Bukkit.getPlayer(uuid);
        if (online != null) online.kick(Component.text(screen, NamedTextColor.RED));
        if (addr != null) {
            for (Player p : Bukkit.getOnlinePlayers()) {
                if (p.getAddress() != null && addr.equals(p.getAddress().getAddress())) {
                    p.kick(Component.text(screen, NamedTextColor.RED));
                }
            }
        }
        log.info("Banned " + name + " (" + uuid + ")" + (addr != null ? " [IP]" : "") + " by " + source + ": " + why);
        return Result.ok("Banned " + name + (expiresAt != null ? " until " + expiresAt : " permanently") + ".");
    }

    @SuppressWarnings({"deprecation", "unchecked"})
    Result unban(UUID uuid, String name, String ip) {
        BanList<PlayerProfile> profileBans = Bukkit.getBanList(BanList.Type.PROFILE);
        PlayerProfile profile = Bukkit.createPlayerProfile(uuid, name);
        profileBans.pardon(profile);

        String remembered = store.forgetIpBan(uuid);
        for (String candidate : new String[]{ip, remembered}) {
            if (candidate == null || candidate.isBlank()) continue;
            InetAddress addr = parseIp(candidate);
            if (addr != null) {
                BanList<InetAddress> ipBans = Bukkit.getBanList(BanList.Type.IP);
                ipBans.pardon(addr);
            }
        }
        log.info("Unbanned " + name + " (" + uuid + ")");
        return Result.ok("Unbanned " + name + " (no-op if they were not banned).");
    }

    // ---------------------------------------------------------------- kick / warn

    Result kick(UUID uuid, String name, String reason) {
        Player p = Bukkit.getPlayer(uuid);
        if (p == null) return Result.ok(name + " is not online; nothing to kick.");
        p.kick(Component.text("You were kicked.\nReason: " + reasonOrDefault(reason), NamedTextColor.RED));
        log.info("Kicked " + name + ": " + reasonOrDefault(reason));
        return Result.ok("Kicked " + name + ".");
    }

    Result warn(UUID uuid, String name, String reason) {
        String why = reasonOrDefault(reason);
        log.info("Warned " + name + " (" + uuid + "): " + why);
        Player p = Bukkit.getPlayer(uuid);
        if (p == null) return Result.ok(name + " is offline; the warning was only logged.");
        p.sendMessage(Component.text("[Warning] ", NamedTextColor.GOLD).append(Component.text(why, NamedTextColor.YELLOW)));
        return Result.ok("Warned " + name + ".");
    }

    // ---------------------------------------------------------------- mute

    Result mute(UUID uuid, String name, String reason, Instant expiresAt, String by) {
        String why = reasonOrDefault(reason);
        if (expiresAt != null && !expiresAt.isAfter(Instant.now())) {
            return Result.ok("Mute already expired; nothing to do.");
        }
        store.mute(uuid, name, why, expiresAt == null ? 0L : expiresAt.toEpochMilli(), by);
        Player p = Bukkit.getPlayer(uuid);
        if (p != null) p.sendMessage(muteMessage(store.activeMute(uuid)));
        log.info("Muted " + name + " (" + uuid + ") by " + by + ": " + why);
        return Result.ok("Muted " + name + (expiresAt != null ? " until " + expiresAt : " permanently") + ".");
    }

    Result unmute(UUID uuid, String name) {
        boolean had = store.unmute(uuid);
        Player p = Bukkit.getPlayer(uuid);
        if (p != null && had) p.sendMessage(Component.text("You have been unmuted.", NamedTextColor.GREEN));
        log.info("Unmuted " + name + " (" + uuid + ")");
        return Result.ok(had ? "Unmuted " + name + "." : name + " was not muted.");
    }

    Component muteMessage(PunishmentStore.Mute m) {
        if (m == null) return Component.empty();
        String when = m.expiresAt() > 0
                ? "Expires in " + Durations.format(java.time.Duration.ofMillis(Math.max(0, m.expiresAt() - System.currentTimeMillis()))) + "."
                : "This mute is permanent.";
        return Component.text("You are muted. Reason: " + m.reason() + ". " + when, NamedTextColor.RED);
    }

    // ---------------------------------------------------------------- helpers

    static String banScreen(String reason, Instant expiresAt, boolean ipBan) {
        return (ipBan ? "Your IP address is banned.\n" : "You are banned from this server.\n")
                + "Reason: " + reason + "\n"
                + (expiresAt != null ? "Expires: " + expiresAt : "This ban is permanent.");
    }

    /** Parses an IP literal only (never performs a DNS lookup). Returns null if invalid. */
    static InetAddress parseIp(String s) {
        if (s == null) return null;
        String t = s.trim();
        if (t.isEmpty() || !IP_LITERAL.matcher(t).matches()) return null;
        try {
            return InetAddress.getByName(t);
        } catch (UnknownHostException e) {
            return null;
        }
    }
}
