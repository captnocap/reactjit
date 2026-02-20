/*
 * sha512.h — Standalone streaming SHA-512 (FIPS 180-4)
 *
 * Decoupled from TweetNaCl. No dynamic allocation.
 * Context struct lives on the stack.
 *
 * Usage:
 *   struct sha512_ctx ctx;
 *   sha512_init(&ctx);
 *   sha512_update(&ctx, data1, len1);
 *   sha512_update(&ctx, data2, len2);
 *   sha512_final(&ctx, hash);  // hash is 64 bytes
 */

#ifndef SHA512_H
#define SHA512_H

#include <stdint.h>
#include <stddef.h>

#define SHA512_BLOCK_SIZE  128
#define SHA512_DIGEST_SIZE  64

struct sha512_ctx {
    uint64_t state[8];
    uint64_t count;     /* total bytes processed */
    uint8_t  buf[SHA512_BLOCK_SIZE];
    size_t   buflen;
};

void sha512_init(struct sha512_ctx *ctx);
void sha512_update(struct sha512_ctx *ctx, const uint8_t *data, size_t len);
void sha512_final(struct sha512_ctx *ctx, uint8_t *hash);

/* One-shot convenience */
void sha512(const uint8_t *data, size_t len, uint8_t *hash);

#endif /* SHA512_H */
