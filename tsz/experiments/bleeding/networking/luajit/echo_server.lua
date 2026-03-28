-- LuaJIT TCP echo server using FFI to POSIX sockets
local ffi = require("ffi")

ffi.cdef[[
    typedef int socklen_t;
    typedef unsigned short sa_family_t;
    typedef unsigned short in_port_t;
    typedef unsigned int in_addr_t;

    struct in_addr {
        in_addr_t s_addr;
    };

    struct sockaddr_in {
        sa_family_t sin_family;
        in_port_t sin_port;
        struct in_addr sin_addr;
        unsigned char sin_zero[8];
    };

    struct sockaddr {
        sa_family_t sa_family;
        char sa_data[14];
    };

    int socket(int domain, int type, int protocol);
    int bind(int sockfd, const struct sockaddr *addr, socklen_t addrlen);
    int listen(int sockfd, int backlog);
    int accept(int sockfd, struct sockaddr *addr, socklen_t *addrlen);
    int connect(int sockfd, const struct sockaddr *addr, socklen_t addrlen);
    ssize_t read(int fd, void *buf, size_t count);
    ssize_t write(int fd, const void *buf, size_t count);
    ssize_t send(int fd, const void *buf, size_t len, int flags);
    ssize_t recv(int fd, void *buf, size_t len, int flags);
    int close(int fd);
    int setsockopt(int sockfd, int level, int optname, const void *optval, socklen_t optlen);
    uint16_t htons(uint16_t hostshort);
    uint32_t htonl(uint32_t hostlong);
    int inet_pton(int af, const char *src, void *dst);
    char *strerror(int errnum);

    // For timing
    typedef long time_t;
    typedef long suseconds_t;
    struct timeval {
        time_t tv_sec;
        suseconds_t tv_usec;
    };
    int gettimeofday(struct timeval *tv, void *tz);

    // For memory tracking
    struct rusage {
        struct timeval ru_utime;
        struct timeval ru_stime;
        long ru_maxrss;
        long ru_ixrss;
        long ru_idrss;
        long ru_isrss;
        long ru_minflt;
        long ru_majflt;
        long ru_nswap;
        long ru_inblock;
        long ru_oublock;
        long ru_msgsnd;
        long ru_msgrcv;
        long ru_nsignals;
        long ru_nvcsw;
        long ru_nivcsw;
    };
    int getrusage(int who, struct rusage *usage);
]]

local AF_INET = 2
local SOCK_STREAM = 1
local SOL_SOCKET = 1
local SO_REUSEADDR = 2
local IPPROTO_TCP = 6

local M = {}

function M.get_time_us()
    local tv = ffi.new("struct timeval")
    ffi.C.gettimeofday(tv, nil)
    return tonumber(tv.tv_sec) * 1000000 + tonumber(tv.tv_usec)
end

function M.get_rss_kb()
    local usage = ffi.new("struct rusage")
    ffi.C.getrusage(0, usage) -- RUSAGE_SELF = 0
    return tonumber(usage.ru_maxrss)
end

function M.create_server(port)
    local fd = ffi.C.socket(AF_INET, SOCK_STREAM, 0)
    assert(fd >= 0, "socket() failed")

    local optval = ffi.new("int[1]", 1)
    ffi.C.setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, optval, ffi.sizeof("int"))

    local addr = ffi.new("struct sockaddr_in")
    addr.sin_family = AF_INET
    addr.sin_port = ffi.C.htons(port)
    addr.sin_addr.s_addr = ffi.C.htonl(0x7f000001) -- 127.0.0.1

    local ret = ffi.C.bind(fd, ffi.cast("struct sockaddr*", addr), ffi.sizeof(addr))
    assert(ret == 0, "bind() failed")

    ret = ffi.C.listen(fd, 128)
    assert(ret == 0, "listen() failed")

    return fd
end

function M.echo_accept_one(server_fd)
    local client_addr = ffi.new("struct sockaddr_in")
    local addrlen = ffi.new("socklen_t[1]", ffi.sizeof(client_addr))
    local client_fd = ffi.C.accept(server_fd, ffi.cast("struct sockaddr*", client_addr), addrlen)
    if client_fd < 0 then return false end

    local buf = ffi.new("char[4096]")
    while true do
        local n = ffi.C.read(client_fd, buf, 4096)
        if n <= 0 then break end
        local written = 0
        while written < n do
            local w = ffi.C.write(client_fd, buf + written, n - written)
            if w <= 0 then break end
            written = written + w
        end
    end

    ffi.C.close(client_fd)
    return true
end

function M.http_accept_one(server_fd)
    local client_addr = ffi.new("struct sockaddr_in")
    local addrlen = ffi.new("socklen_t[1]", ffi.sizeof(client_addr))
    local client_fd = ffi.C.accept(server_fd, ffi.cast("struct sockaddr*", client_addr), addrlen)
    if client_fd < 0 then return false end

    local buf = ffi.new("char[4096]")
    local n = ffi.C.read(client_fd, buf, 4096)
    if n > 0 then
        local request = ffi.string(buf, n)
        local response
        if request:sub(1, 4) == "GET " then
            response = "HTTP/1.1 200 OK\r\nContent-Length: 13\r\nConnection: close\r\n\r\nHello, World!"
        else
            response = "HTTP/1.1 405 Method Not Allowed\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
        end
        ffi.C.write(client_fd, response, #response)
    end

    ffi.C.close(client_fd)
    return true
end

-- Connection pool
function M.create_pool(target_port, max_size)
    return {
        connections = {},
        target_port = target_port,
        max_size = max_size,
    }
end

function M.pool_acquire(pool)
    -- Find free connection
    for i, entry in ipairs(pool.connections) do
        if not entry.in_use then
            entry.in_use = true
            return entry.fd
        end
    end
    -- Create new
    if #pool.connections < pool.max_size then
        local fd = ffi.C.socket(AF_INET, SOCK_STREAM, 0)
        assert(fd >= 0, "socket() failed")

        local addr = ffi.new("struct sockaddr_in")
        addr.sin_family = AF_INET
        addr.sin_port = ffi.C.htons(pool.target_port)
        addr.sin_addr.s_addr = ffi.C.htonl(0x7f000001)

        local ret = ffi.C.connect(fd, ffi.cast("struct sockaddr*", addr), ffi.sizeof(addr))
        assert(ret == 0, "connect() failed")

        table.insert(pool.connections, { fd = fd, in_use = true })
        return fd
    end
    error("pool exhausted")
end

function M.pool_release(pool, fd)
    for _, entry in ipairs(pool.connections) do
        if entry.fd == fd then
            entry.in_use = false
            return
        end
    end
end

function M.pool_close(pool)
    for _, entry in ipairs(pool.connections) do
        ffi.C.close(entry.fd)
    end
    pool.connections = {}
end

-- Standalone server mode
if arg and arg[0] and arg[0]:match("echo_server") then
    local port = tonumber(arg[1]) or 9200
    local server_fd = M.create_server(port)
    io.write(string.format("LuaJIT echo server listening on :%d\n", port))
    while true do
        M.echo_accept_one(server_fd)
    end
end

return M
