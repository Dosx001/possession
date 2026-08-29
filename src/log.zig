const std = @import("std");
const c = @cImport({
    @cInclude("syslog.h");
});

pub fn logger(
    comptime level: std.log.Level,
    comptime scope: @TypeOf(.EnumLiteral),
    comptime format: []const u8,
    args: anytype,
) void {
    const scope_name = if (scope == .default) "" else "(" ++ @tagName(scope) ++ "): ";
    if (@import("builtin").mode == .Debug) {
        std.debug.lockStdErr();
        defer std.debug.unlockStdErr();
        const stderr = std.fs.File.stderr().deprecatedWriter();
        nosuspend stderr.print(
            @tagName(level) ++ "|" ++ scope_name ++ format ++ "\n",
            args,
        ) catch return;
    }
    var buf: [128]u8 = undefined;
    const msg = std.fmt.bufPrintZ(
        &buf,
        scope_name ++ format,
        args,
    ) catch {
        const alloc_msg = std.fmt.allocPrintSentinel(
            std.heap.c_allocator,
            scope_name ++ format,
            args,
            0,
        ) catch |e| {
            std.log.err("Logging failed: {}", .{e});
            return;
        };
        c.syslog(switch (level) {
            .err => c.LOG_ERR,
            .warn => c.LOG_WARNING,
            .info => c.LOG_INFO,
            .debug => c.LOG_DEBUG,
        }, "%s", alloc_msg.ptr);
        std.heap.c_allocator.free(alloc_msg);
        return;
    };
    c.syslog(switch (level) {
        .err => c.LOG_ERR,
        .warn => c.LOG_WARNING,
        .info => c.LOG_INFO,
        .debug => c.LOG_DEBUG,
    }, "%s", msg.ptr);
}
