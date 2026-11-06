package org.turturesmp.bridge;

import net.luckperms.api.LuckPerms;
import net.luckperms.api.LuckPermsProvider;
import net.luckperms.api.model.group.Group;
import net.luckperms.api.model.user.User;
import net.luckperms.api.node.NodeType;
import net.luckperms.api.node.types.DisplayNameNode;
import net.luckperms.api.node.types.InheritanceNode;
import net.luckperms.api.node.types.MetaNode;
import net.luckperms.api.node.types.PermissionNode;
import net.luckperms.api.node.types.PrefixNode;
import net.luckperms.api.node.types.SuffixNode;
import net.luckperms.api.node.types.WeightNode;
import net.luckperms.api.query.QueryOptions;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * All LuckPerms interaction. Only loaded when the LuckPerms plugin is present (soft dependency), so the
 * rest of the plugin must only touch this class after checking for LuckPerms. No Bukkit types are used here.
 * Targets the LuckPerms API 5.4.
 */
final class LuckPermsHook {
    /** Meta key that stores the website chat tag of a user. */
    static final String TAG_KEY = "turture_tag";

    private final LuckPerms lp;

    LuckPermsHook() {
        this.lp = LuckPermsProvider.get();
    }

    static String groupName(String key) {
        String g = key == null ? "" : key.trim().toLowerCase(Locale.ROOT);
        return g.replaceAll("[^a-z0-9_.\\-]", "_");
    }

    // ---------------------------------------------------------------- reads (cached data of online players, main-thread safe)

    /**
     * The "main" rank of an online player: the inherited group with the highest weight (ties: the stored primary
     * group wins). This also reflects temporary ranks, unlike the stored primary group alone. Null if the user
     * is not loaded.
     */
    String topGroup(UUID uuid) {
        User u = lp.getUserManager().getUser(uuid);
        if (u == null) return null;
        String primary = u.getPrimaryGroup();
        String best = null;
        int bestWeight = Integer.MIN_VALUE;
        for (Group g : u.getInheritedGroups(QueryOptions.nonContextual())) {
            int w = g.getWeight().orElse(0);
            if (w > bestWeight || (w == bestWeight && g.getName().equalsIgnoreCase(primary))) {
                best = g.getName();
                bestWeight = w;
            }
        }
        return best != null ? best : primary;
    }

    /** The website chat tag of an online player, or null. */
    String tag(UUID uuid) {
        User u = lp.getUserManager().getUser(uuid);
        if (u == null) return null;
        String v = u.getCachedData().getMetaData().getMetaValue(TAG_KEY);
        return v == null || v.isBlank() ? null : v;
    }

    boolean groupExists(String key) {
        return lp.getGroupManager().getGroup(groupName(key)) != null;
    }

    // ---------------------------------------------------------------- writes (async, safe from any thread)

    /** Gives the user the group (temporary when expiry != null). A permanent grant also becomes the stored primary group. */
    CompletableFuture<Void> setRank(UUID uuid, String key, Instant expiry) {
        final String g = groupName(key);
        if (!groupExists(g)) {
            return CompletableFuture.failedFuture(new IllegalStateException(
                    "LuckPerms group '" + g + "' does not exist (the website should send rank_define first)"));
        }
        return lp.getUserManager().modifyUser(uuid, user -> {
            // Remove the old node first so that a changed expiry replaces it instead of failing as "already has".
            user.data().clear(NodeType.INHERITANCE.predicate(n -> n.getGroupName().equalsIgnoreCase(g)));
            InheritanceNode.Builder b = InheritanceNode.builder(g).value(true);
            if (expiry != null) b.expiry(expiry); // NodeBuilder#expiry(Instant) exists in API 5.x
            user.data().add(b.build());
            if (expiry == null) user.setPrimaryGroup(g);
        });
    }

    CompletableFuture<Void> removeRank(UUID uuid, String key) {
        final String g = groupName(key);
        return lp.getUserManager().modifyUser(uuid, user -> {
            user.data().clear(NodeType.INHERITANCE.predicate(n -> n.getGroupName().equalsIgnoreCase(g)));
            if (user.getPrimaryGroup().equalsIgnoreCase(g) && !g.equals("default")) {
                user.setPrimaryGroup("default"); // result ignored: it fails harmlessly if not applicable
            }
        });
    }

    /** Sets (or clears when tag == null) the user's website tag meta. */
    CompletableFuture<Void> setTag(UUID uuid, String tag) {
        return lp.getUserManager().modifyUser(uuid, user -> {
            user.data().clear(NodeType.META.predicate(n -> n.getMetaKey().equals(TAG_KEY)));
            if (tag != null && !tag.isBlank()) {
                user.data().add(MetaNode.builder(TAG_KEY, tag).build());
            }
        });
    }

    /**
     * Creates or updates a group so that it matches the website definition exactly: weight, display name, prefix,
     * suffix, parents and permissions are replaced (other nodes, e.g. meta or context-specific ones, are kept
     * unless they are of the replaced kinds). A permission starting with '-' is a negated permission.
     */
    CompletableFuture<Void> defineGroup(String key, String displayName, String prefix, String suffix, int weight,
                                        List<String> inherits, List<String> permissions) {
        final String name = groupName(key);
        return lp.getGroupManager().createAndLoadGroup(name).thenCompose(group -> {
            group.data().clear(NodeType.WEIGHT::matches);
            group.data().clear(NodeType.DISPLAY_NAME::matches);
            group.data().clear(NodeType.PREFIX::matches);
            group.data().clear(NodeType.SUFFIX::matches);
            group.data().clear(NodeType.INHERITANCE::matches);
            group.data().clear(NodeType.PERMISSION::matches);

            group.data().add(WeightNode.builder(weight).build());
            if (displayName != null && !displayName.isBlank()) {
                group.data().add(DisplayNameNode.builder(displayName).build());
            }
            if (prefix != null && !prefix.isEmpty()) {
                group.data().add(PrefixNode.builder(prefix, weight).build());
            }
            if (suffix != null && !suffix.isEmpty()) {
                group.data().add(SuffixNode.builder(suffix, weight).build());
            }
            for (String parent : inherits) {
                String p = groupName(parent);
                if (!p.isEmpty() && !p.equals(name)) {
                    group.data().add(InheritanceNode.builder(p).value(true).build());
                }
            }
            for (String perm : permissions) {
                if (perm == null || perm.isBlank()) continue;
                boolean negated = perm.startsWith("-");
                String node = (negated ? perm.substring(1) : perm).trim();
                if (node.isEmpty()) continue;
                group.data().add(PermissionNode.builder(node).value(!negated).build());
            }
            return lp.getGroupManager().saveGroup(group).thenCompose(v -> lp.runUpdateTask());
        });
    }
}
