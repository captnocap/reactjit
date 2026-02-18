# CartridgeOS — Alpine Linux + iLoveReact SDL2 target
# Build context: monorepo root (docker build -f experiments/cartridge-os/Dockerfile .)
#
# Stage 1: compile ft_helper.so against musl (Alpine's C library).
# The glibc-built ft_helper.so from the host won't load in Alpine.
FROM alpine:3.21 AS builder

RUN apk add --no-cache gcc musl-dev freetype-dev

COPY lua/sdl2_ft_helper.c /build/ft_helper.c

RUN gcc -shared -fPIC -O2 /build/ft_helper.c \
        -o /build/ft_helper.so \
        $(pkg-config --cflags --libs freetype2) \
    && echo "[builder] ft_helper.so compiled against musl" \
    && ls -lh /build/ft_helper.so

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Runtime image
# ─────────────────────────────────────────────────────────────────────────────
FROM alpine:3.21

# SDL2 + OpenGL via Mesa (kmsdrm backend needs GBM + EGL + DRI drivers)
# mesa-dri-gallium provides: virtio_gpu_dri.so, swrast_dri.so, etc.
# font-liberation gives us LiberationSans for text rendering
RUN apk add --no-cache \
    luajit \
    sdl2 \
    mesa-dri-gallium \
    mesa-egl \
    mesa-gbm \
    mesa-gl \
    libdrm \
    freetype \
    libstdc++ \
    libgcc \
    font-liberation \
    linux-virt

# ft_helper.so compiled against musl (from Stage 1)
COPY --from=builder /build/ft_helper.so /app/ft_helper.so

# App placeholder — build.sh copies real app files after docker export
RUN mkdir -p /app/lua
