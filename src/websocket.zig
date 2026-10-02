const errno = @import("errno.zig");
const sig = @import("signal.zig");
const std = @import("std");

const posix = std.posix;

const SockAddr = @import("cli.zig").SockAddr;

var browser: posix.socket_t = -1;
var b_mtx = std.Io.Mutex{ .state = .init(.unlocked) };
var b_cv = std.Io.Condition{
    .state = .init(.{ .waiters = 0, .signals = 0 }),
    .epoch = .init(0),
};
var client: posix.socket_t = -1;
var c_mtx = std.Io.Mutex{ .state = .init(.unlocked) };
var c_cv = std.Io.Condition{
    .state = .init(.{ .waiters = 0, .signals = 0 }),
    .epoch = .init(0),
};

pub fn init(io: std.Io, sock_addr: SockAddr) !void {
    sig.init(quit, exit);
    const fd = posix.system.socket(
        posix.AF.INET,
        posix.SOCK.STREAM,
        0,
    );
    errno.check(fd) catch {
        errno.log(.err, "Websocket socket failed: {}");
        return;
    };
    defer _ = posix.system.close(fd);
    const addr = posix.system.sockaddr{
        .family = posix.AF.INET,
        .data = .{
            @truncate(sock_addr.port >> 8), @truncate(sock_addr.port),
            sock_addr.ip[0],                sock_addr.ip[1],
            sock_addr.ip[2],                sock_addr.ip[3],
            0,                              0,
            0,                              0,
            0,                              0,
            0,                              0,
        },
    };
    errno.check(posix.system.bind(
        fd,
        &addr,
        @sizeOf(posix.system.sockaddr),
    )) catch {
        errno.log(.err, "Websocket bind failed: {}");
        return;
    };
    errno.check(posix.system.listen(
        fd,
        10,
    )) catch {
        errno.log(.err, "Websocket listen failed: {}");
        return;
    };
    std.log.info("Websocket listening: {d}.{d}.{d}.{d}:{d}", .{
        sock_addr.ip[0],
        sock_addr.ip[1],
        sock_addr.ip[2],
        sock_addr.ip[3],
        sock_addr.port,
    });
    const browser_t = std.Thread.spawn(
        .{},
        el_browser,
        .{io},
    ) catch |e| {
        std.log.err("Browser thread failed: {}", .{e});
        return;
    };
    const client_t = std.Thread.spawn(
        .{},
        el_client,
        .{io},
    ) catch |e| {
        std.log.err("Client thread failed: {}", .{e});
        return;
    };
    while (true) {
        const conn = posix.system.accept(fd, null, null);
        errno.check(conn) catch {
            errno.log(.warn, "Websocket accept failed: {}");
            return;
        };
        var buf: [1024]u8 = undefined;
        if (handshake(io, conn, &buf) catch {
            _ = posix.system.close(conn);
            continue;
        }) {
            b_mtx.lock(io) catch continue;
            browser = conn;
            b_cv.signal(io);
            b_mtx.unlock(io);
        } else {
            c_mtx.lock(io) catch continue;
            client = conn;
            c_cv.signal(io);
            c_mtx.unlock(io);
        }
    }
    browser_t.join();
    client_t.join();
}

fn el_browser(io: std.Io) !void {
    var buf: [1024]u8 = undefined;
    while (true) {
        b_mtx.lock(io) catch continue;
        while (browser == -1)
            b_cv.wait(io, &b_mtx) catch continue;
        const fd = browser;
        b_mtx.unlock(io);
        var size: u64 = 0;
        var mask: [4]u8 = .{ 0, 0, 0, 0 };
        while (true) {
            const n = posix.read(fd, &buf) catch break;
            if (n == 0) break;
            decode(io, &size, &mask, &buf, n) catch break;
        }
        _ = posix.system.close(fd);
        b_mtx.lock(io) catch continue;
        browser = -1;
        b_mtx.unlock(io);
    }
}

fn el_client(io: std.Io) !void {
    var buf: [1024]u8 = undefined;
    while (true) {
        c_mtx.lock(io) catch continue;
        while (client == -1)
            c_cv.wait(io, &c_mtx) catch continue;
        const fd = client;
        c_mtx.unlock(io);
        var size: u64 = 0;
        while (true) {
            const n = posix.read(fd, &buf) catch break;
            if (n == 0) break;
            message(io, &buf, n, &size) catch break;
        }
        _ = posix.system.close(fd);
        c_mtx.lock(io) catch continue;
        client = -1;
        c_mtx.unlock(io);
    }
}

fn handshake(
    io: std.Io,
    fd: posix.socket_t,
    buf: []u8,
) !bool {
    _ = posix.read(fd, buf) catch |e| {
        std.log.warn("Websocket header read failed: {}", .{e});
        return e;
    };
    b_mtx.lock(io) catch return false;
    const b_fd = browser;
    b_mtx.unlock(io);
    if (std.mem.startsWith(u8, buf, "client")) {
        c_mtx.lock(io) catch return false;
        const c_fd = client;
        c_mtx.unlock(io);
        if (c_fd == -1) {
            if (b_fd == -1) {
                errno.check(@intCast(posix.system.write(
                    fd,
                    &[1]u8{0x2},
                    1,
                ))) catch |e| {
                    errno.log(.warn, "Client rejection failed: {}");
                    return e;
                };
            } else {
                errno.check(@intCast(posix.system.write(
                    fd,
                    &[1]u8{0x1},
                    1,
                ))) catch |e| {
                    errno.log(.warn, "Client handshake failed: {}");
                    return e;
                };
            }
        } else {
            errno.check(@intCast(posix.system.write(
                fd,
                &[1]u8{0x0},
                1,
            ))) catch |e| {
                errno.log(.warn, "Client rejection failed: {}");
                return e;
            };
        }
        return false;
    }
    if (b_fd != -1) {
        errno.check(@intCast(posix.system.write(
            fd,
            &[1]u8{0x0},
            1,
        ))) catch |e| {
            errno.log(.warn, "Client rejection failed: {}");
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
        std.fmt.bufPrint(
            buf,
            "{s}258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
            .{key},
        ) catch |e| {
            std.log.warn("Magic string failed: {}", .{e});
            return e;
        },
        &sha,
        .{},
    );
    const encoder = std.base64.Base64Encoder.init(
        std.base64.standard_alphabet_chars,
        '=',
    );
    var b64: [32]u8 = undefined;
    const slice = std.fmt.bufPrint(
        buf,
        "HTTP/1.1 101 Switching Protocols\r\n" ++
            "Upgrade: websocket\r\n" ++
            "Connection: Upgrade\r\n" ++
            "Sec-WebSocket-Accept: {s}\r\n\r\n",
        .{encoder.encode(&b64, &sha)},
    ) catch |e| {
        std.log.warn("Handshake format failed: {}", .{e});
        return e;
    };
    errno.check(@intCast(posix.system.write(
        fd,
        slice.ptr,
        slice.len,
    ))) catch |e| {
        errno.log(.warn, "Handshake write failed: {}");
        return e;
    };
    return true;
}

fn decode(
    io: std.Io,
    size: *u64,
    mask: *[4]u8,
    buf: *[1024]u8,
    buf_len: usize,
) !void {
    c_mtx.lock(io) catch return;
    const fd = client;
    c_mtx.unlock(io);
    const payload =
        if (size.* == 0) slice: {
            size.* = buf[1] & 0x7F;
            const idx: usize =
                switch (size.*) {
                    126 => idx: {
                        size.* = @as(u16, buf[2]) << 8 | buf[3];
                        break :idx 4;
                    },
                    127 => idx: {
                        inline for (2..10) |i| {
                            size.* = size.* << 8 | buf[i];
                        }
                        break :idx 10;
                    },
                    else => 2,
                };
            const offset = idx + 4;
            @memcpy(mask, buf[idx..offset]);
            break :slice buf[offset..buf_len];
        } else buf[0..buf_len];
    size.* -= payload.len;
    if (payload.len == 2)
        return error.Closed;
    for (payload, 0..) |*b, i| {
        b.* ^= mask[i % 4];
    }
    errno.check(@intCast(posix.system.write(
        fd,
        payload.ptr,
        payload.len,
    ))) catch {
        errno.log(.warn, "Client payload failed: {}");
        return;
    };
}

fn msg_header(fd: c_int, len: u64) !void {
    if (len < 126) {
        errno.check(@intCast(posix.system.write(
            fd,
            &[2]u8{ 0x81, @intCast(len) },
            2,
        ))) catch |e| {
            errno.log(.warn, "Message header failed: {}");
            return e;
        };
    } else if (len <= std.math.maxInt(u16)) {
        errno.check(@intCast(posix.system.write(
            fd,
            &[4]u8{
                0x81,
                0x7E,
                @intCast((len >> 8) & 0xFF),
                @intCast(len & 0xFF),
            },
            4,
        ))) catch |e| {
            errno.log(.warn, "Message(16-bit) header failed: {}");
            return e;
        };
    } else {
        var header = [10]u8{ 0x81, 0x7F, 56, 48, 40, 32, 24, 16, 8, 0 };
        inline for (2..10) |i| {
            header[i] = @intCast((len >> @intCast(header[i])) & 0xFF);
        }
        errno.check(@intCast(posix.system.write(
            fd,
            &header,
            10,
        ))) catch |e| {
            errno.log(.warn, "Message(64-bit) header failed: {}");
            return e;
        };
    }
}

fn message(
    io: std.Io,
    buf: *[1024]u8,
    len: usize,
    size: *u64,
) !void {
    b_mtx.lock(io) catch return;
    const fd = browser;
    b_mtx.unlock(io);
    const offset = if (size.* == 0) blk: {
        if (buf[0] < 0x9) {
            buf[0] += 1;
            for (1..buf[0]) |i| {
                size.* = size.* << 8 | buf[i];
            }
            msg_header(fd, size.*) catch |e|
                return e;
            break :blk buf[0];
        }
        size.* = len;
        msg_header(fd, len) catch |e|
            return e;
        break :blk 0;
    } else 0;
    size.* -= len - offset;
    const msg = buf[offset..len];
    errno.check(@intCast(posix.system.write(
        fd,
        msg.ptr,
        msg.len,
    ))) catch |e| {
        errno.log(.warn, "Message payload write failed: {}");
        return e;
    };
    std.log.info("Record {s}", .{msg});
}

fn quit(_: posix.SIG) callconv(.c) void {
    if (0 < browser) {
        errno.check(@intCast(posix.system.write(
            browser,
            &[2]u8{ 0x88, 0x00 },
            2,
        ))) catch {
            errno.log(.err, "Cleanup failed: {}");
            return;
        };
    }
    posix.system.exit(0);
}

fn exit(signal: posix.SIG) callconv(.c) void {
    switch (signal) {
        posix.SIG.ILL => std.log.err("Illegal instruction", .{}),
        posix.SIG.ABRT => std.log.err("Error program aborted", .{}),
        posix.SIG.SEGV => std.log.err("Segmentation fault", .{}),
        else => {},
    }
    if (0 < browser) {
        errno.check(@intCast(posix.system.write(
            browser,
            &[2]u8{ 0x88, 0x00 },
            2,
        ))) catch {
            errno.log(.err, "Cleanup failed: {}");
            return;
        };
    }
    posix.system.exit(1);
}
