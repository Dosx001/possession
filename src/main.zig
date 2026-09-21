const std = @import("std");
const ws = @import("websocket.zig");

pub const std_options: std.Options = .{
    .logFn = @import("log.zig").logger,
};

pub fn main(init: std.process.Init) void {
    ws.init(init.io) catch return;
}
