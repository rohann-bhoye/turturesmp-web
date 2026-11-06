package org.turturesmp.bridge;

import java.time.Duration;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Parses and formats short durations such as "30m", "2h", "7d", "1w", "1d12h". */
final class Durations {
    private static final Pattern FULL = Pattern.compile("(?:\\d+[smhdw])+", Pattern.CASE_INSENSITIVE);
    private static final Pattern PART = Pattern.compile("(\\d+)([smhdw])", Pattern.CASE_INSENSITIVE);

    private Durations() {}

    static boolean looksLikeDuration(String s) {
        return s != null && FULL.matcher(s).matches();
    }

    /** Returns null if the text is not a valid positive duration. */
    static Duration parse(String s) {
        if (!looksLikeDuration(s)) return null;
        long seconds = 0;
        Matcher m = PART.matcher(s);
        while (m.find()) {
            long n;
            try {
                n = Long.parseLong(m.group(1));
            } catch (NumberFormatException e) {
                return null;
            }
            long unit = switch (Character.toLowerCase(m.group(2).charAt(0))) {
                case 's' -> 1L;
                case 'm' -> 60L;
                case 'h' -> 3600L;
                case 'd' -> 86400L;
                default -> 604800L; // 'w'
            };
            if (n > 100_000L) return null; // sanity cap, avoids overflow
            seconds += n * unit;
        }
        return seconds > 0 ? Duration.ofSeconds(seconds) : null;
    }

    static String format(Duration d) {
        long s = Math.max(0, d.getSeconds());
        long days = s / 86400;
        long hours = (s % 86400) / 3600;
        long minutes = (s % 3600) / 60;
        StringBuilder sb = new StringBuilder();
        if (days > 0) sb.append(days).append("d ");
        if (hours > 0) sb.append(hours).append("h ");
        if (minutes > 0 || sb.length() == 0) sb.append(minutes).append("m");
        return sb.toString().trim();
    }
}
