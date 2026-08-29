const std = @import("std");
const ws = @import("websocket.zig");

pub const std_options: std.Options = .{
    .logFn = @import("log.zig").logger,
};

pub fn main() !void {
    ws.init() catch return;
}
