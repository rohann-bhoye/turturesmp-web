package org.turturesmp.bridge;

import com.google.gson.JsonObject;

/** Website-controlled settings delivered in the heartbeat reply. */
record BridgeSettings(boolean whitelistEnabled, boolean maintenanceMode, String maintenanceMessage, boolean allowBedrock) {

    static BridgeSettings fromJson(JsonObject o) {
        String msg = Json.str(o, "maintenanceMessage");
        if (msg == null || msg.isBlank()) msg = "The server is under maintenance. Please try again later.";
        return new BridgeSettings(
                Json.bool(o, "whitelistEnabled", false),
                Json.bool(o, "maintenanceMode", false),
                msg,
                Json.bool(o, "allowBedrock", true));
    }
}
