const std = @import("std");
const build = @import("build");

pub const Options = struct {
    port: u16 = 8080,
    ip: [4]u8 = .{ 127, 0, 0, 1 },
};

const Option = enum {
    Help,
    Port,
    Remote,
    Server,
    Version,
};

var opt: Option = .Help;

const opt_map = std.StaticStringMap(Option).initComptime(.{
    .{ "--help", .Help },
    .{ "-h", .Help },
    .{ "--port", .Port },
    .{ "-p", .Port },
    .{ "--remote", .Remote },
    .{ "-r", .Remote },
    .{ "--server", .Server },
    .{ "-s", .Server },
    .{ "--version", .Version },
    .{ "-v", .Version },
});

pub fn parse(io: std.Io, args: std.process.Args) ?Options {
    var opts = Options{};
    var server = false;
    var stdout_buffer: [1024]u8 = undefined;
    var writer = std.Io.File.Writer.init(.stdout(), io, &stdout_buffer);
    const stdout = &writer.interface;
    var iter = args.iterate();
    _ = iter.skip();
    while (iter.next()) |arg| {
        if (opt_map.get(arg)) |val| {
            opt = val;
            switch (val) {
                .Help => {
                    help(stdout);
                    stdout.flush() catch |err| {
                        std.log.warn("Help flush failed: {}", .{err});
                    };
                    std.process.exit(0);
                },
                .Remote => opts.ip = .{ 0, 0, 0, 0 },
                .Server => server = true,
                .Version => {
                    _ = stdout.print(
                        "{s}\n",
                        .{build.version},
                    ) catch |err| {
                        std.log.warn("Version print failed: {}", .{err});
                    };
                    stdout.flush() catch |err| {
                        std.log.warn("Version flush failed: {}", .{err});
                    };
                    std.process.exit(0);
                },
                else => {},
            }
            continue;
        }
        switch (opt) {
            .Port => opts.port = std.fmt.parseInt(u16, arg, 10) catch {
                _ = stdout.write("\x1b[31mInvalid port number\x1b[0m\n" ++
                    \\Value must be unused port number between 0 and 65535
                    \\https://en.wikipedia.org/wiki/List_of_TCP_and_UDP_port_numbers
                    \\
                ) catch |err| {
                    std.log.warn("Port parse int failed: {}", .{err});
                };
                stdout.flush() catch |err| {
                    std.log.warn("Port flush failed: {}", .{err});
                };
                std.process.exit(1);
            },
            else => {
                exit(
                    stdout,
                    "\x1b[31mUnknown option: {s}\x1b[0m\n\n",
                    .{arg},
                );
            },
        }
    }
    if (!server) {
        help(stdout);
        stdout.flush() catch |err| {
            std.log.warn("Help flush failed: {}", .{err});
        };
        return null;
    }
    return opts;
}

fn help(stdout: *std.Io.Writer) void {
    _ = stdout.write(
        \\Usage: possession [OPTIONS]
        \\
        \\Options:
        \\  -h, --help        Print this help message
        \\  -p, --port        Set port number (default: 8080)
        \\  -r, --remote      Allow remote access
        \\  -s, --server      Run server
        \\  -v, --version     Print version
        \\
        \\Examples:
        \\      possession -s
        \\      possession -s -p 12345
        \\      possession -s -p 12345 -r
        \\
    ) catch |err| {
        std.log.warn("Help write failed: {}", .{err});
    };
}

fn exit(
    stdout: *std.Io.Writer,
    comptime format: []const u8,
    args: anytype,
) noreturn {
    _ = stdout.print(format, args) catch |err| {
        std.log.warn("Exit print failed: {}", .{err});
    };
    help(stdout);
    stdout.flush() catch |err| {
        std.log.warn("Exit flush failed: {}", .{err});
    };
    std.process.exit(1);
}
