package org.turturesmp.bridge;

import ac.grim.grimac.api.GrimAPIProvider;
import ac.grim.grimac.api.event.events.FlagEvent;
import org.bukkit.plugin.Plugin;

final class GrimAlertHook {
    private GrimAlertHook() {}

    static void register(Plugin plugin, GrimFlagCollector collector) {
        var api = GrimAPIProvider.get();
        var grimPlugin = api.getGrimPlugin(plugin);
        api.getEventBus().get(FlagEvent.class).onFlag(grimPlugin, (user, check, verbose, cancelled) -> {
            collector.record(user.getUniqueId(), user.getName(), check.getCheckName(), verbose, cancelled);
            return cancelled;
        }, 0, true);
    }
}
