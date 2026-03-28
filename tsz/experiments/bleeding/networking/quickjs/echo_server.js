// QuickJS TCP echo server using os module (POSIX sockets via C host)
// This file is loaded and executed by the C host which provides native socket bindings

// The C host exposes these globals:
//   net_create_server(port) -> server_fd
//   net_accept(server_fd) -> client_fd
//   net_read(fd, max_bytes) -> string | null
//   net_write(fd, data) -> bytes_written
//   net_close(fd)
//   net_connect(port) -> fd
//   get_time_us() -> microseconds
//   get_rss_kb() -> kilobytes

function echo_accept_one(server_fd) {
    const client_fd = net_accept(server_fd);
    if (client_fd < 0) return false;

    while (true) {
        const data = net_read(client_fd, 4096);
        if (!data || data.length === 0) break;
        net_write(client_fd, data);
    }

    net_close(client_fd);
    return true;
}

function http_accept_one(server_fd) {
    const client_fd = net_accept(server_fd);
    if (client_fd < 0) return false;

    const data = net_read(client_fd, 4096);
    if (data && data.length > 0) {
        let response;
        if (data.startsWith("GET ")) {
            response = "HTTP/1.1 200 OK\r\nContent-Length: 13\r\nConnection: close\r\n\r\nHello, World!";
        } else {
            response = "HTTP/1.1 405 Method Not Allowed\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
        }
        net_write(client_fd, response);
    }

    net_close(client_fd);
    return true;
}

// Connection pool
function ConnectionPool(target_port, max_size) {
    this.connections = [];
    this.target_port = target_port;
    this.max_size = max_size;
}

ConnectionPool.prototype.acquire = function() {
    for (let i = 0; i < this.connections.length; i++) {
        if (!this.connections[i].in_use) {
            this.connections[i].in_use = true;
            return this.connections[i].fd;
        }
    }
    if (this.connections.length < this.max_size) {
        const fd = net_connect(this.target_port);
        this.connections.push({ fd: fd, in_use: true });
        return fd;
    }
    throw new Error("pool exhausted");
};

ConnectionPool.prototype.release = function(fd) {
    for (let i = 0; i < this.connections.length; i++) {
        if (this.connections[i].fd === fd) {
            this.connections[i].in_use = false;
            return;
        }
    }
};

ConnectionPool.prototype.close = function() {
    for (let i = 0; i < this.connections.length; i++) {
        net_close(this.connections[i].fd);
    }
    this.connections = [];
};

// Export for use by the C host benchmark driver
globalThis.echo_accept_one = echo_accept_one;
globalThis.http_accept_one = http_accept_one;
globalThis.ConnectionPool = ConnectionPool;
