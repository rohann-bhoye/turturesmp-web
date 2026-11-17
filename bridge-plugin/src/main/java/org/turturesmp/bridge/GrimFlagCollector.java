package org.turturesmp.bridge;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

final class GrimFlagCollector {
    record Alert(UUID eventId, UUID playerUuid, String playerName, String checkName, String verbose,
                 int flagCount, int threshold, int windowSeconds, boolean cancelled) {}

    private record Key(UUID playerUuid, String checkName) {}

    private static final class Window {
        long startedAt;
        volatile long lastSeenAt;
        int count;
        boolean alerted;

        Window(long now) {
            startedAt = now;
            lastSeenAt = now;
        }
    }

    private final Consumer<Alert> sink;
    private final ConcurrentMap<Key, Window> windows = new ConcurrentHashMap<>();
    private final AtomicLong nextPruneAt = new AtomicLong();

    private volatile boolean enabled = true;
    private volatile int threshold = 5;
    private volatile int windowSeconds = 60;

    GrimFlagCollector(Consumer<Alert> sink) {
        this.sink = sink;
    }

    void configure(boolean enabled, int threshold, int windowSeconds) {
        this.enabled = enabled;
        this.threshold = Math.max(1, Math.min(100, threshold));
        this.windowSeconds = Math.max(10, Math.min(600, windowSeconds));
        windows.clear();
    }

    int threshold() {
        return threshold;
    }

    int windowSeconds() {
        return windowSeconds;
    }

    void record(UUID playerUuid, String playerName, String checkName, String verbose, boolean cancelled) {
        if (!enabled || playerUuid == null) return;
        String check = bounded(checkName, 100);
        if (check.isEmpty()) return;

        int requiredFlags = threshold;
        int seconds = windowSeconds;
        long now = System.currentTimeMillis();
        long windowMillis = seconds * 1000L;
        Key key = new Key(playerUuid, check);
        Window state = windows.computeIfAbsent(key, ignored -> new Window(now));
        Alert alert = null;

        synchronized (state) {
            if (now - state.startedAt >= windowMillis || now < state.startedAt) {
                state.startedAt = now;
                state.count = 0;
                state.alerted = false;
            }
            state.lastSeenAt = now;
            if (state.count < requiredFlags) state.count++;
            if (state.count >= requiredFlags && !state.alerted) {
                state.alerted = true;
                alert = new Alert(
                        UUID.randomUUID(),
                        playerUuid,
                        bounded(playerName, 32),
                        check,
                        bounded(verbose, 500),
                        state.count,
                        requiredFlags,
                        seconds,
                        cancelled
                );
            }
        }

        if (alert != null) sink.accept(alert);
        pruneIfDue(now, windowMillis);
    }

    private void pruneIfDue(long now, long windowMillis) {
        long scheduled = nextPruneAt.get();
        if (now < scheduled || !nextPruneAt.compareAndSet(scheduled, now + windowMillis)) return;
        long staleBefore = now - windowMillis * 10;
        windows.entrySet().removeIf(entry -> entry.getValue().lastSeenAt < staleBefore);
    }

    private static String bounded(String value, int maxLength) {
        if (value == null) return "";
        String trimmed = value.trim();
        return trimmed.length() <= maxLength ? trimmed : trimmed.substring(0, maxLength);
    }
}
