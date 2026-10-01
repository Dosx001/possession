const std = @import("std");
const ws = @import("websocket.zig");
const cli = @import("cli.zig");

pub const std_options: std.Options = .{
    .logFn = @import("log.zig").logger,
};

pub fn main(init: std.process.Init) void {
    const io = init.io;
    if (cli.parse(io, init.minimal.args)) |opts| {
        ws.init(init.io, opts) catch return;
    }
}
