const std = @import("std");

pub fn check(status: c_int) !void {
    if (status == -1) {
        return error.Errno;
    }
}

pub fn log(level: std.log.Level, comptime format: []const u8) void {
    switch (level) {
        .warn => std.log.warn(format, .{std.posix.errno(-1)}),
        .err => std.log.err(format, .{std.posix.errno(-1)}),
        .info => std.log.info(format, .{std.posix.errno(-1)}),
        .debug => std.log.debug(format, .{std.posix.errno(-1)}),
    }
}
