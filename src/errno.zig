const std = @import("std");

pub fn check(status: c_int) !void {
    if (status == -1) {
        return error.Errno;
    }
}

pub fn log(comptime format: []const u8) void {
    std.log.err(format, .{std.posix.errno(-1)});
}
