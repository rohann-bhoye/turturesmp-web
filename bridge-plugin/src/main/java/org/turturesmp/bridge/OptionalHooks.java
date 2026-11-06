package org.turturesmp.bridge;

import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.plugin.RegisteredServiceProvider;

import java.lang.reflect.Method;
import java.util.UUID;

/**
 * Vault and Floodgate are reached via reflection so that the plugin compiles and loads without either of them
 * (and without pulling their repositories into the build).
 */
final class OptionalHooks {
    private OptionalHooks() {}

    /** Vault economy balance lookup. Returns 0 whenever Vault or an economy provider is missing. */
    static final class Vault {
        private Class<?> economyClass;
        private Method getBalance;
        private boolean unavailable;

        /** Must run on the main thread (economy plugins are not necessarily thread-safe). */
        double balance(OfflinePlayer player) {
            if (unavailable) return 0.0;
            try {
                if (Bukkit.getPluginManager().getPlugin("Vault") == null) return 0.0;
                if (economyClass == null) {
                    economyClass = Class.forName("net.milkbowl.vault.economy.Economy");
                    getBalance = economyClass.getMethod("getBalance", OfflinePlayer.class);
                }
                // The provider may register after our startup (e.g. EssentialsX), so look it up on every call.
                RegisteredServiceProvider<?> rsp = Bukkit.getServicesManager().getRegistration(economyClass);
                if (rsp == null) return 0.0;
                Object result = getBalance.invoke(rsp.getProvider(), player);
                return result instanceof Number n ? n.doubleValue() : 0.0;
            } catch (ClassNotFoundException | NoSuchMethodException e) {
                unavailable = true; // Vault API not what we expect; stop trying
                return 0.0;
            } catch (ReflectiveOperationException | RuntimeException e) {
                return 0.0;
            }
        }
    }

    /** Bedrock detection. Floodgate UUIDs always have a zero most-significant half, which works even without the API. */
    static final class Floodgate {
        private Object api;
        private Method isFloodgatePlayer;
        private boolean resolved;

        boolean isBedrock(UUID uuid) {
            if (uuid.getMostSignificantBits() == 0L) return true;
            resolve();
            if (api == null) return false;
            try {
                return (boolean) isFloodgatePlayer.invoke(api, uuid);
            } catch (ReflectiveOperationException | RuntimeException e) {
                return false;
            }
        }

        private void resolve() {
            if (resolved) return;
            resolved = true;
            try {
                if (Bukkit.getPluginManager().getPlugin("floodgate") == null) return;
                Class<?> c = Class.forName("org.geysermc.floodgate.api.FloodgateApi");
                api = c.getMethod("getInstance").invoke(null);
                isFloodgatePlayer = c.getMethod("isFloodgatePlayer", UUID.class);
            } catch (ReflectiveOperationException | RuntimeException | LinkageError e) {
                api = null;
            }
        }
    }
}
