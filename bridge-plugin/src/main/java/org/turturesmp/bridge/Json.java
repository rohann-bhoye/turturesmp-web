package org.turturesmp.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.util.ArrayList;
import java.util.List;

/** Null-safe helpers around Gson (the server bundles Gson, so nothing is shaded). */
final class Json {
    private Json() {}

    /** Parses a JSON object, or returns null when the text is empty or not an object. */
    static JsonObject parseObject(String text) {
        if (text == null || text.isBlank()) return null;
        try {
            JsonElement e = JsonParser.parseString(text);
            return e.isJsonObject() ? e.getAsJsonObject() : null;
        } catch (RuntimeException ex) {
            return null;
        }
    }

    static JsonObject obj(JsonElement e) {
        return e != null && e.isJsonObject() ? e.getAsJsonObject() : null;
    }

    static String str(JsonObject o, String key) {
        if (o == null) return null;
        JsonElement e = o.get(key);
        if (e == null || e.isJsonNull() || !e.isJsonPrimitive()) return null;
        return e.getAsString();
    }

    static boolean bool(JsonObject o, String key, boolean def) {
        if (o == null) return def;
        JsonElement e = o.get(key);
        if (e == null || e.isJsonNull() || !e.isJsonPrimitive()) return def;
        try {
            return e.getAsBoolean();
        } catch (RuntimeException ex) {
            return def;
        }
    }

    static int integer(JsonObject o, String key, int def) {
        if (o == null) return def;
        JsonElement e = o.get(key);
        if (e == null || e.isJsonNull() || !e.isJsonPrimitive()) return def;
        try {
            return e.getAsInt();
        } catch (RuntimeException ex) {
            return def;
        }
    }

    static List<String> stringList(JsonObject o, String key) {
        List<String> out = new ArrayList<>();
        if (o == null) return out;
        JsonElement e = o.get(key);
        if (e == null || !e.isJsonArray()) return out;
        JsonArray arr = e.getAsJsonArray();
        for (JsonElement item : arr) {
            if (item.isJsonPrimitive()) out.add(item.getAsString());
        }
        return out;
    }
}
