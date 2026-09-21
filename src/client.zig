const errno = @import("errno.zig");
const std = @import("std");

const posix = std.posix;

var fd: posix.socket_t = undefined;
var buf: [1024]u8 = undefined;

pub fn main(init: std.process.Init) void {
    fd = posix.system.socket(
        posix.AF.INET,
        posix.SOCK.STREAM,
        0,
    );
    errno.check(fd) catch {
        errno.log("Websocket socket failed: {}");
        return;
    };
    defer _ = posix.system.close(fd);
    const addr = posix.system.sockaddr{
        .family = posix.AF.INET,
        .data = .{
            0x1F, 0x90, // 8080
            127, 0, 0, 1, // 127.0.0.1
            0,   0, 0, 0,
            0,   0, 0, 0,
        },
    };
    errno.check(posix.system.connect(
        fd,
        &addr,
        @sizeOf(posix.system.sockaddr),
    )) catch {
        errno.log("Websocket connect failed: {}");
        return;
    };
    _ = message("client", .{}) catch unreachable;
    if (buf[0] == 0x0) {
        std.log.info("rejected", .{});
        return;
    }
    const json = message_json(
        \\{{"type":"window","win":{{"url":"https://www.google.com/search?q=websocket","incognito":true}}}}
    , .{}, struct {
        ok: bool,
        payload: struct {
            id: i32,
            tabId: i32,
        },
    }) catch unreachable;
    std.log.info("{}", .{json.value});
    var n = message(
        \\{{"type":"text","tab":{{"windowId":{}}},"query":"#search h3"}}
    ,
        .{json.value.payload.id},
    ) catch unreachable;
    std.log.info("{s}", .{buf[0..n]});
    n = message(
        \\{{"type":"url","tabId":{},"url":{{"url":"https://www.google.com/search?q=zig"}}}}
    ,
        .{json.value.payload.tabId},
    ) catch unreachable;
    while (buf[n - 1] != '}') {
        n = posix.read(fd, &buf) catch unreachable;
    }
    init.io.sleep(.fromMilliseconds(500), .awake) catch unreachable;
    n = message(
        \\{{"type":"text","tab":{{"windowId":{}}},"query":"#search h3"}}
    ,
        .{json.value.payload.id},
    ) catch unreachable;
    std.log.info("{s}", .{buf[0..n]});
}

fn message_json(
    comptime fmt: []const u8,
    args: anytype,
    comptime T: type,
) !std.json.Parsed(T) {
    const len = try message(fmt, args);
    return try std.json.parseFromSlice(
        T,
        std.heap.page_allocator,
        buf[0..len],
        .{},
    );
}

fn message(
    comptime fmt: []const u8,
    args: anytype,
) !usize {
    const slice = try std.fmt.bufPrint(&buf, fmt, args);
    errno.check(@intCast(posix.system.write(
        fd,
        slice.ptr,
        slice.len,
    ))) catch |err| {
        errno.log("Message write failed: {}");
        return err;
    };
    const len = try posix.read(fd, &buf);
    return len;
}
