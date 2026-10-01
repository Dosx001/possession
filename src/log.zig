const log = @import("log");
const std = @import("std");

pub fn logger(
    comptime level: std.log.Level,
    comptime scope: @TypeOf(.EnumLiteral),
    comptime format: []const u8,
    args: anytype,
) void {
    var buf: [1032]u8 = undefined;
    if (std.posix.system.isatty(
        std.posix.system.STDERR_FILENO,
    ) == 1) {
        const io = std.Options.debug_io;
        const prev = io.swapCancelProtection(.blocked);
        defer _ = io.swapCancelProtection(prev);
        const stderr = std.debug.lockStderr(&buf).terminal();
        defer std.debug.unlockStderr();
        std.log.defaultLogFileTerminal(level, scope, format, args, stderr) catch {};
        return;
    }
    const msg = std.fmt.bufPrintSentinel(
        &buf,
        format,
        args,
        0,
    ) catch return;
    log.syslog(switch (level) {
        .err => log.LOG_ERR,
        .warn => log.LOG_WARNING,
        .info => log.LOG_INFO,
        .debug => log.LOG_DEBUG,
    }, "%s", msg.ptr);
}
