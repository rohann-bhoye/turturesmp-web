package org.turturesmp.bridge;

import me.clip.placeholderapi.expansion.PlaceholderExpansion;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.OfflinePlayer;

/**
 * PlaceholderAPI expansion: {@code %turture_tag%} returns the website chat tag (LuckPerms meta "turture_tag"),
 * optionally mapped through the {@code tags:} section of config.yml. Empty string when the player has no tag.
 * Only loaded when PlaceholderAPI is installed.
 */
final class TagExpansion extends PlaceholderExpansion {
    private final TurtureBridge plugin;
    private final BridgeService service;

    TagExpansion(TurtureBridge plugin, BridgeService service) {
        this.plugin = plugin;
        this.service = service;
    }

    @Override
    public String getIdentifier() {
        return "turture";
    }

    @Override
    public String getAuthor() {
        return "TurtureSMP";
    }

    @Override
    public String getVersion() {
        return plugin.getPluginMeta().getVersion();
    }

    @Override
    public boolean persist() {
        return true; // survive /papi reload
    }

    @Override
    public String onRequest(OfflinePlayer player, String params) {
        if (player == null || !params.equalsIgnoreCase("tag")) return null;
        LuckPermsHook lp = service.luckPerms();
        if (lp == null) return "";
        String tag = lp.tag(player.getUniqueId()); // cached data of online players: cheap, no I/O
        if (tag == null) return "";
        String mapped = plugin.getConfig().getString("tags." + tag, tag);
        // PlaceholderAPI expects section-sign colour codes.
        return LegacyComponentSerializer.legacySection().serialize(LegacyComponentSerializer.legacyAmpersand().deserialize(mapped));
    }
}
