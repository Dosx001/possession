const sig = @import("signal.zig");
const std = @import("std");

const posix = std.posix;

const Msg = struct {
    status: bool,
    data: []const u8,
};

var b_mtx = std.Thread.Mutex{};
var c_mtx = std.Thread.Mutex{};
var browser: posix.socket_t = 0;
var client: posix.socket_t = 0;

pub fn init() !void {
    sig.init(quit, exit);
    const fd = posix.socket(posix.AF.INET, posix.SOCK.STREAM, 0) catch |e| {
        std.log.err("Websocket socket failed: {}", .{e});
        return;
    };
    defer posix.close(fd);
    posix.setsockopt(
        fd,
        posix.SOL.SOCKET,
        posix.SO.REUSEADDR,
        &std.mem.toBytes(@as(c_int, 1)),
    ) catch |e| {
        std.log.err("Server setsockopt failed: {}", .{e});
        return;
    };
    posix.setsockopt(
        fd,
        posix.SOL.SOCKET,
        posix.SO.REUSEPORT,
        &std.mem.toBytes(@as(c_int, 1)),
    ) catch |e| {
        std.log.err("Server setsockopt failed: {}", .{e});
        return;
    };
    const addr = std.net.Address.initIp4(.{ 127, 0, 0, 1 }, 8080);
    posix.bind(fd, &addr.any, addr.getOsSockLen()) catch |e| {
        std.log.err("Websocket bind failed: {}", .{e});
        return;
    };
    posix.listen(fd, 10) catch |e| {
        std.log.err("Websocket listen failed: {}", .{e});
        return;
    };
    std.log.info("Websocket listening: {any}", .{addr});
    while (true) {
        const conn = posix.accept(fd, null, null, 0) catch |e| {
            std.log.err("Websocket accept failed: {}", .{e});
            continue;
        };
        const t = std.Thread.spawn(.{}, event_loop, .{conn}) catch continue;
        t.detach();
    }
}

fn event_loop(fd: posix.socket_t) void {
    defer posix.close(fd);
    var buf: [1024]u8 = undefined;
    if (handshake(fd, &buf) catch return) {
        el_browser(&buf) catch return;
    } else el_client(&buf) catch return;
}

fn el_browser(buf: []u8) !void {
    defer {
        b_mtx.lock();
        browser = 0;
        b_mtx.unlock();
    }
    var len: usize = 0;
    while (true) {
        len = posix.read(browser, buf) catch |e| {
            std.log.err("Browser message read failed: {}", .{e});
            break;
        };
        if (len == 0) break;
        decode(buf[0..len]) catch break;
    }
}

fn el_client(buf: []u8) !void {
    defer {
        c_mtx.lock();
        client = 0;
        c_mtx.unlock();
    }
    var len: usize = 0;
    var msg: [1024]u8 = undefined;
    while (true) {
        len = posix.read(client, &msg) catch |e| {
            std.log.err("Client message read failed: {}", .{e});
            break;
        };
        if (len == 0) break;
        message(buf, msg[0..len]) catch break;
    }
}

fn handshake(fd: posix.socket_t, buf: []u8) !bool {
    _ = posix.read(fd, buf) catch |e| {
        std.log.err("Websocket header read failed: {}", .{e});
        return e;
    };
    if (std.mem.startsWith(u8, buf, "client")) {
        if (client == 0) {
            if (browser == 0) {
                _ = posix.write(fd, &[1]u8{0x2}) catch |e| {
                    std.log.err("Client rejection failed: {}", .{e});
                    return e;
                };
            } else {
                _ = posix.write(fd, &[1]u8{0x1}) catch |e| {
                    std.log.err("Client handshake failed: {}", .{e});
                    return e;
                };
                c_mtx.lock();
                client = fd;
                c_mtx.unlock();
            }
        } else {
            _ = posix.write(fd, &[1]u8{0x0}) catch |e| {
                std.log.err("Client rejection failed: {}", .{e});
                return e;
            };
        }
        return false;
    }
    if (browser != 0) {
        _ = posix.write(fd, &[1]u8{0x0}) catch |e| {
            std.log.err("Client rejection failed: {}", .{e});
            return e;
        };
        return error.AlreadyInUse;
    }
    const header = "Sec-WebSocket-Key: ";
    var key: []const u8 = undefined;
    var it = std.mem.splitScalar(u8, buf, '\n');
    while (it.next()) |line| {
        if (std.mem.startsWith(u8, line, header)) {
            key = std.mem.trim(u8, line[header.len..], "\r");
            break;
        }
    } else return error.NotFound;
    var sha: [std.crypto.hash.Sha1.digest_length]u8 = undefined;
    std.crypto.hash.Sha1.hash(
        std.fmt.bufPrint(buf, "{s}258EAFA5-E914-47DA-95CA-C5AB0DC85B11", .{key}) catch |e| {
            std.log.err("Magic string failed: {}", .{e});
            return e;
        },
        &sha,
        .{},
    );
    const encoder = std.base64.Base64Encoder.init(std.base64.standard_alphabet_chars, '=');
    var b64: [32]u8 = undefined;
    const slice = std.fmt.bufPrint(
        buf,
        "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: {s}\r\n\r\n",
        .{encoder.encode(&b64, &sha)},
    ) catch |e| {
        std.log.err("Handshake format failed: {}", .{e});
        return e;
    };
    _ = posix.write(fd, slice) catch |e| {
        std.log.err("Handshake write failed: {}", .{e});
        return e;
    };
    b_mtx.lock();
    browser = fd;
    b_mtx.unlock();
    return true;
}

fn decode(buf: []u8) !void {
    var len: usize = (buf[1] & 0x7F);
    var index: usize =
        switch (len) {
            126 => blk: {
                len = @as(u16, buf[2]) << 8 | buf[3];
                break :blk 4;
            },
            127 => blk: {
                len = 0;
                inline for (2..10) |i| {
                    len = len << 8 | buf[i];
                }
                break :blk 10;
            },
            else => 2,
        };
    const key = buf[index .. index + 4];
    index += 4;
    const payload = buf[index .. index + len];
    for (payload, 0..) |*b, i| {
        b.* = b.* ^ key[i % 4];
    }
    if (payload.len == 2) return error.Closed;
    _ = posix.write(client, payload) catch |e| {
        std.log.err("Server write failed: {}", .{e});
        return e;
    };
}

fn message(buf: []u8, msg: []const u8) !void {
    if (msg.len < 126) {
        const slice = std.fmt.bufPrint(
            buf,
            "00{s}",
            .{msg},
        ) catch |e| {
            std.log.err("Message format failed: {}", .{e});
            return e;
        };
        buf[0] = 0x81;
        buf[1] = @intCast(msg.len);
        _ = posix.write(browser, slice) catch |e| {
            std.log.err("Server write failed: {}", .{e});
            return e;
        };
        return;
    }
    const slice = std.fmt.bufPrint(
        buf,
        "0000{s}",
        .{msg},
    ) catch |e| {
        std.log.err("Message format failed: {}", .{e});
        return e;
    };
    buf[0] = 0x81;
    buf[1] = 0x7E;
    buf[2] = @intCast((msg.len >> 8) & 0xFF);
    buf[3] = @intCast(msg.len & 0xFF);
    _ = posix.write(browser, slice) catch |e| {
        std.log.err("Server write failed: {}", .{e});
        return e;
    };
}

fn quit(_: c_int) callconv(.c) void {
    if (0 < browser) {
        _ = posix.write(browser, &[2]u8{ 0x88, 0x00 }) catch |e|
            std.log.err("CLeanup failed: {}", .{e});
    }
    std.posix.exit(0);
}

fn exit(signal: c_int) callconv(.c) void {
    switch (signal) {
        posix.SIG.ILL => std.log.err("Illegal instruction", .{}),
        posix.SIG.ABRT => std.log.err("Error program aborted", .{}),
        posix.SIG.SEGV => std.log.err("Segmentation fault", .{}),
        else => {},
    }
    if (0 < browser) {
        _ = posix.write(browser, &[2]u8{ 0x88, 0x00 }) catch |e| {
            std.log.err("CLeanup failed: {}", .{e});
        };
    }
    std.posix.exit(1);
}
