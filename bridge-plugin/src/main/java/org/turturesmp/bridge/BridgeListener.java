package org.turturesmp.bridge;

import io.papermc.paper.event.player.AsyncChatEvent;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerCommandPreprocessEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerLoginEvent;
import org.bukkit.event.player.PlayerQuitEvent;

import java.util.List;
import java.util.Locale;

/** Maintenance / Bedrock gate, mute enforcement and per-player sync triggers. */
final class BridgeListener implements Listener {
    private final TurtureBridge plugin;
    private final BridgeService service;

    BridgeListener(TurtureBridge plugin, BridgeService service) {
        this.plugin = plugin;
        this.service = service;
    }

    // Note: PlayerLoginEvent is kept (instead of AsyncPlayerPreLoginEvent) because permission checks such as
    // turturebridge.bypass are only reliable once the Player object exists.
    @SuppressWarnings("deprecation")
    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onLogin(PlayerLoginEvent event) {
        BridgeSettings s = service.settings();
        if (s == null) return; // website not reached yet: fail open
        Player p = event.getPlayer();
        if (service.canBypass(p)) return;
        if (s.maintenanceMode()) {
            event.disallow(PlayerLoginEvent.Result.KICK_OTHER, Component.text(s.maintenanceMessage(), NamedTextColor.YELLOW));
            return;
        }
        if (!s.allowBedrock() && service.floodgate().isBedrock(p.getUniqueId())) {
            event.disallow(PlayerLoginEvent.Result.KICK_OTHER,
                    Component.text("Bedrock players are not allowed on this server right now.", NamedTextColor.YELLOW));
        }
    }

    @EventHandler(priority = EventPriority.LOWEST, ignoreCancelled = true)
    public void onChat(AsyncChatEvent event) {
        PunishmentStore.Mute m = service.store().activeMute(event.getPlayer().getUniqueId());
        if (m == null) return;
        event.setCancelled(true);
        event.getPlayer().sendMessage(service.punishments().muteMessage(m)); // sendMessage is thread-safe on Paper
    }

    @EventHandler(priority = EventPriority.LOWEST, ignoreCancelled = true)
    public void onCommand(PlayerCommandPreprocessEvent event) {
        PunishmentStore.Mute m = service.store().activeMute(event.getPlayer().getUniqueId());
        if (m == null) return;
        List<String> blocked = plugin.getConfig().getStringList("muted-blocked-commands");
        String msg = event.getMessage();
        int space = msg.indexOf(' ');
        String label = (space < 0 ? msg.substring(1) : msg.substring(1, space)).toLowerCase(Locale.ROOT);
        int colon = label.indexOf(':'); // minecraft:msg
        if (colon >= 0) label = label.substring(colon + 1);
        for (String b : blocked) {
            if (b.equalsIgnoreCase(label)) {
                event.setCancelled(true);
                event.getPlayer().sendMessage(service.punishments().muteMessage(m));
                return;
            }
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onJoin(PlayerJoinEvent event) {
        Player p = event.getPlayer();
        // A few seconds later so LuckPerms / economy data is loaded; also makes new players show up on the website.
        Bukkit.getScheduler().runTaskLater(plugin, () -> {
            if (p.isOnline()) service.syncPlayerLater(p);
        }, 100L);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onQuit(PlayerQuitEvent event) {
        service.syncPlayerLater(event.getPlayer());
    }
}
