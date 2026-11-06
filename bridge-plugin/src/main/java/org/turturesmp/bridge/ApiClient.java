package org.turturesmp.bridge;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HexFormat;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.logging.Logger;

/**
 * Signed, fully asynchronous client for the website bridge API (docs/BRIDGE_API.md).
 *
 * <ul>
 *   <li>Every request carries X-Timestamp and X-Signature = hex(HMAC_SHA256(secret, timestamp + "." + rawBody)).</li>
 *   <li>Nothing here ever blocks the caller: all methods return futures that never complete exceptionally.</li>
 *   <li>Network failures feed an exponential backoff (5s .. 5min) and are logged sparingly.</li>
 *   <li>A small in-memory outbox retries command results and events until the website accepts them.</li>
 * </ul>
 * This class has no Bukkit dependency on purpose.
 */
final class ApiClient {

    /** error != null means the request never produced an HTTP response. */
    record Response(int status, String body, String error) {
        boolean ok() {
            return error == null && status >= 200 && status < 300;
        }
    }

    private static final long MAX_BACKOFF_MS = 300_000L;
    private static final long LOG_INTERVAL_MS = 600_000L;
    private static final int OUTBOX_LIMIT = 500;

    private final Logger log;
    private final ExecutorService executor;
    private final HttpClient http;

    private volatile String baseUrl = "";
    private volatile String secret = "";
    private volatile String userAgent = "TurtureBridge";

    private final AtomicInteger failures = new AtomicInteger();
    private volatile long blockedUntil;
    private volatile long lastFailureLog;

    private final ConcurrentLinkedDeque<OutboxItem> outbox = new ConcurrentLinkedDeque<>();
    private final AtomicBoolean flushing = new AtomicBoolean();

    private static final class OutboxItem {
        final String path;
        final String body;

        OutboxItem(String path, String body) {
            this.path = path;
            this.body = body;
        }
    }

    ApiClient(Logger log) {
        this.log = log;
        this.executor = Executors.newFixedThreadPool(2, r -> {
            Thread t = new Thread(r, "TurtureBridge-HTTP");
            t.setDaemon(true);
            return t;
        });
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NEVER) // a redirect would turn a signed POST into an unsigned GET
                .executor(executor)
                .build();
    }

    void configure(String url, String secret, String userAgent) {
        String u = url == null ? "" : url.trim();
        while (u.endsWith("/")) u = u.substring(0, u.length() - 1);
        if (u.endsWith("/api/bridge")) u = u.substring(0, u.length() - "/api/bridge".length());
        this.baseUrl = u;
        this.secret = secret == null ? "" : secret.trim();
        this.userAgent = userAgent;
        this.failures.set(0);
        this.blockedUntil = 0;
    }

    boolean configured() {
        return !baseUrl.isEmpty() && !secret.isEmpty();
    }

    String baseUrl() {
        return baseUrl;
    }

    void shutdown() {
        executor.shutdownNow();
    }

    // ---------------------------------------------------------------- health / backoff

    /** Milliseconds the callers should wait before the next attempt because of recent failures (0 = healthy). */
    long backoffMs() {
        int f = failures.get();
        if (f <= 0) return 0;
        return Math.min(MAX_BACKOFF_MS, 5_000L << Math.min(f - 1, 6));
    }

    boolean healthy() {
        return failures.get() == 0;
    }

    int outboxSize() {
        return outbox.size();
    }

    private void markSuccess() {
        if (failures.getAndSet(0) > 0) {
            blockedUntil = 0;
            log.info("Connection to the website restored.");
        }
    }

    private void markFailure(String reason) {
        int f = failures.incrementAndGet();
        blockedUntil = System.currentTimeMillis() + backoffMs();
        long now = System.currentTimeMillis();
        if (f == 1 || now - lastFailureLog >= LOG_INTERVAL_MS) {
            lastFailureLog = now;
            log.warning("Website unreachable or rejecting requests (" + reason + "). Retrying with backoff; "
                    + "further problems are logged at most every 10 minutes.");
        }
    }

    // ---------------------------------------------------------------- requests

    CompletableFuture<Response> get(String path) {
        return send("GET", path, null);
    }

    CompletableFuture<Response> post(String path, String jsonBody) {
        return send("POST", path, jsonBody == null ? "{}" : jsonBody);
    }

    private CompletableFuture<Response> send(String method, String path, String body) {
        if (!configured()) {
            return CompletableFuture.completedFuture(new Response(-1, "", "url/secret not configured"));
        }
        try {
            String raw = body == null ? "" : body; // rawBody is "" for GET
            String ts = Long.toString(System.currentTimeMillis());
            String signature = sign(ts, raw);
            HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(baseUrl + "/api/bridge" + path))
                    .timeout(Duration.ofSeconds(15))
                    .header("Accept", "application/json")
                    .header("User-Agent", userAgent)
                    .header("X-Timestamp", ts)
                    .header("X-Signature", signature);
            if ("POST".equals(method)) {
                b.header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(raw, StandardCharsets.UTF_8));
            } else {
                b.GET();
            }
            return http.sendAsync(b.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
                    .handle((res, ex) -> {
                        if (ex != null) {
                            Throwable c = ex.getCause() != null ? ex.getCause() : ex;
                            String msg = c.getClass().getSimpleName() + (c.getMessage() != null ? ": " + c.getMessage() : "");
                            markFailure(msg);
                            return new Response(-1, "", msg);
                        }
                        int status = res.statusCode();
                        if (status >= 500) {
                            markFailure("HTTP " + status);
                        } else if (status == 401 || status == 403) {
                            markFailure("HTTP " + status + " - check 'secret' and that the server clock is correct");
                        } else if (status >= 300 && status < 400) {
                            markFailure("HTTP " + status + " redirect - set 'url' to the final address (https, exact host)");
                        } else {
                            markSuccess();
                        }
                        return new Response(status, res.body(), null);
                    });
        } catch (RuntimeException e) { // bad URL, signing problem, ...
            markFailure(e.getClass().getSimpleName() + ": " + e.getMessage());
            return CompletableFuture.completedFuture(new Response(-1, "", e.getMessage()));
        }
    }

    private String sign(String timestamp, String rawBody) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] out = mac.doFinal((timestamp + "." + rawBody).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(out); // lowercase hex
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA256 unavailable", e);
        }
    }

    // ---------------------------------------------------------------- outbox (reliable delivery)

    /** Queues a POST that is retried until the website accepts it (or definitively rejects it). */
    void enqueue(String path, String jsonBody) {
        while (outbox.size() >= OUTBOX_LIMIT) {
            outbox.pollFirst();
        }
        outbox.addLast(new OutboxItem(path, jsonBody));
        flush();
    }

    /** Tries to deliver queued items in order. Safe to call often; does nothing while backed off or already running. */
    void flush() {
        if (!configured() || outbox.isEmpty()) return;
        if (System.currentTimeMillis() < blockedUntil) return;
        if (!flushing.compareAndSet(false, true)) return;
        flushNext();
    }

    private void flushNext() {
        OutboxItem item = outbox.peekFirst();
        if (item == null) {
            flushing.set(false);
            if (!outbox.isEmpty()) flush(); // an item arrived between the peek and the release
            return;
        }
        post(item.path, item.body).whenComplete((r, ex) -> {
            boolean delivered;
            if (ex != null || r == null) {
                delivered = false;
            } else if (r.ok()) {
                delivered = true;
            } else if (r.error() == null && r.status() >= 400 && r.status() < 500
                    && r.status() != 401 && r.status() != 403 && r.status() != 408 && r.status() != 429) {
                // Definitive rejection (e.g. 404 for an unknown command id): retrying cannot help.
                log.warning("Website rejected " + item.path + " with HTTP " + r.status() + "; dropping it.");
                delivered = true;
            } else {
                delivered = false;
            }
            if (delivered) {
                outbox.removeFirstOccurrence(item);
                flushNext();
            } else {
                flushing.set(false); // try again on the next flush() after the backoff
            }
        });
    }
}
