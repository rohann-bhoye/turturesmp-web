package org.turturesmp.bridge;

import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;

/**
 * Local persistence for punishments Bukkit has no native storage for:
 * <ul>
 *   <li>{@code mutes.yml}: uuid -> name, reason, expiry (epoch ms, 0 = permanent), issuer</li>
 *   <li>{@code ipbans.yml}: uuid -> IP that was banned for that player, so that unban can lift the IP ban too</li>
 * </ul>
 */
final class PunishmentStore {

    record Mute(String name, String reason, long expiresAt, String by) {
        boolean expired(long now) {
            return expiresAt > 0 && now >= expiresAt;
        }
    }

    private final JavaPlugin plugin;
    private final File mutesFile;
    private final File ipBansFile;
    private final Map<UUID, Mute> mutes = new ConcurrentHashMap<>();
    private final Map<UUID, String> ipBans = new ConcurrentHashMap<>();

    PunishmentStore(JavaPlugin plugin) {
        this.plugin = plugin;
        this.mutesFile = new File(plugin.getDataFolder(), "mutes.yml");
        this.ipBansFile = new File(plugin.getDataFolder(), "ipbans.yml");
        load();
    }

    // ---------------------------------------------------------------- mutes

    /** The active mute of this player, or null. Expired mutes are removed lazily. */
    Mute activeMute(UUID uuid) {
        Mute m = mutes.get(uuid);
        if (m == null) return null;
        if (m.expired(System.currentTimeMillis())) {
            if (mutes.remove(uuid, m)) saveMutes();
            return null;
        }
        return m;
    }

    void mute(UUID uuid, String name, String reason, long expiresAtMillis, String by) {
        mutes.put(uuid, new Mute(name, reason, expiresAtMillis, by));
        saveMutes();
    }

    /** @return true if the player was muted. */
    boolean unmute(UUID uuid) {
        boolean had = mutes.remove(uuid) != null;
        if (had) saveMutes();
        return had;
    }

    // ---------------------------------------------------------------- ip bans

    void rememberIpBan(UUID uuid, String ip) {
        ipBans.put(uuid, ip);
        saveIpBans();
    }

    /** Removes and returns the remembered banned IP of this player (or null). */
    String forgetIpBan(UUID uuid) {
        String ip = ipBans.remove(uuid);
        if (ip != null) saveIpBans();
        return ip;
    }

    // ---------------------------------------------------------------- persistence

    private void load() {
        try {
            if (mutesFile.exists()) {
                YamlConfiguration y = YamlConfiguration.loadConfiguration(mutesFile);
                ConfigurationSection s = y.getConfigurationSection("mutes");
                long now = System.currentTimeMillis();
                if (s != null) {
                    for (String key : s.getKeys(false)) {
                        try {
                            UUID id = UUID.fromString(key);
                            Mute m = new Mute(s.getString(key + ".name", "?"), s.getString(key + ".reason", "No reason given"),
                                    s.getLong(key + ".expires", 0L), s.getString(key + ".by", "Console"));
                            if (!m.expired(now)) mutes.put(id, m);
                        } catch (IllegalArgumentException ignored) {
                            // skip corrupt entry
                        }
                    }
                }
            }
            if (ipBansFile.exists()) {
                YamlConfiguration y = YamlConfiguration.loadConfiguration(ipBansFile);
                ConfigurationSection s = y.getConfigurationSection("ipbans");
                if (s != null) {
                    for (String key : s.getKeys(false)) {
                        try {
                            String ip = s.getString(key);
                            if (ip != null) ipBans.put(UUID.fromString(key), ip);
                        } catch (IllegalArgumentException ignored) {
                            // skip corrupt entry
                        }
                    }
                }
            }
        } catch (RuntimeException e) {
            plugin.getLogger().log(Level.WARNING, "Could not read mutes.yml / ipbans.yml; starting empty.", e);
        }
    }

    private synchronized void saveMutes() {
        YamlConfiguration y = new YamlConfiguration();
        for (Map.Entry<UUID, Mute> e : mutes.entrySet()) {
            String k = "mutes." + e.getKey();
            Mute m = e.getValue();
            y.set(k + ".name", m.name());
            y.set(k + ".reason", m.reason());
            y.set(k + ".expires", m.expiresAt());
            y.set(k + ".by", m.by());
        }
        write(y, mutesFile);
    }

    private synchronized void saveIpBans() {
        YamlConfiguration y = new YamlConfiguration();
        for (Map.Entry<UUID, String> e : ipBans.entrySet()) {
            y.set("ipbans." + e.getKey(), e.getValue());
        }
        write(y, ipBansFile);
    }

    private void write(YamlConfiguration y, File file) {
        try {
            File dir = file.getParentFile();
            if (dir != null && !dir.exists() && !dir.mkdirs()) {
                throw new IOException("cannot create " + dir);
            }
            y.save(file);
        } catch (IOException e) {
            plugin.getLogger().log(Level.WARNING, "Could not save " + file.getName(), e);
        }
    }
}
