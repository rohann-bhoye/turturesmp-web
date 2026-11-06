package org.turturesmp.bridge;

/** Outcome of executing a website command. */
record Result(boolean ok, String message) {
    static Result ok(String message) {
        return new Result(true, message);
    }

    static Result fail(String message) {
        return new Result(false, message);
    }
}
