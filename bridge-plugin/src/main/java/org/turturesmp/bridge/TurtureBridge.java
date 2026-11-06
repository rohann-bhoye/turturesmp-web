package org.turturesmp.bridge;

import org.bukkit.Bukkit;
import org.bukkit.command.PluginCommand;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.logging.Level;

/** TurtureBridge: connects the Turture SMP website to this server. See docs/BRIDGE_API.md in the website repo. */
public final class TurtureBridge extends JavaPlugin {
    private BridgeService service;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        try {
            service = new BridgeService(this);
            getServer().getPluginManager().registerEvents(new BridgeListener(this, service), this);

            PluginCommand cmd = getCommand("tsmp");
            if (cmd != null) {
                TsmpCommand handler = new TsmpCommand(this, service);
                cmd.setExecutor(handler);
                cmd.setTabCompleter(handler);
            }

            service.start();

            if (Bukkit.getPluginManager().getPlugin("PlaceholderAPI") != null) {
                try {
                    new TagExpansion(this, service).register();
                    getLogger().info("PlaceholderAPI found: %turture_tag% registered.");
                } catch (Throwable t) { // LinkageError if the PAPI API differs
                    getLogger().warning("Could not register the PlaceholderAPI expansion: " + t);
                }
            }
        } catch (Throwable t) {
            // Never let a bridge problem take the server down; the rest of the server keeps running.
            getLogger().log(Level.SEVERE, "TurtureBridge failed to start; disabling itself.", t);
            getServer().getPluginManager().disablePlugin(this);
        }
    }

    @Override
    public void onDisable() {
        if (service != null) {
            try {
                service.stop();
            } catch (RuntimeException e) {
                getLogger().log(Level.FINE, "Error during shutdown", e);
            }
        }
    }
}
