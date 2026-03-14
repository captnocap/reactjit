/*
 * cart.h — .cart binary format definitions
 *
 * Layout:  HEADER (160 bytes) | MANIFEST | PAYLOAD (cpio) | SIGNATURE (64 bytes)
 *
 * The signature covers the 160 raw header bytes as stored on disk.
 * The header contains SHA-512 hashes of manifest and payload, binding
 * sizes and integrity into the signature. Verification is constant-time
 * regardless of cart size — only 224 bytes need to be in memory.
 *
 * On-disk layout (all integers little-endian):
 *
 *   Offset  Size  Field
 *   ------  ----  -----
 *   0x00      4   magic ("CART")
 *   0x04      1   version (1)
 *   0x05      1   flags (reserved, 0)
 *   0x06      2   reserved (0)
 *   0x08      4   manifest_len (uint32 LE)
 *   0x0C      8   payload_len  (uint64 LE)
 *   0x14     64   manifest_hash (SHA-512 of manifest bytes)
 *   0x54     64   payload_hash  (SHA-512 of payload bytes)
 *   0x94      8   key_id (first 8 bytes of SHA-256(pubkey))
 *   0x9C      4   padding (zero)
 *   ----
 *   0xA0    160   total
 *
 * After the header: manifest_len bytes of canonical manifest,
 * then payload_len bytes of cpio archive, then 64 bytes Ed25519 signature.
 */

#ifndef CART_H
#define CART_H

#include <stdint.h>

#define CART_MAGIC          "CART"
#define CART_MAGIC_LEN      4
#define CART_VERSION        1
#define CART_HEADER_SIZE    160
#define CART_SIG_SIZE       64      /* Ed25519 */
#define CART_HASH_SIZE      64      /* SHA-512 */
#define CART_PUBKEY_SIZE    32      /* Ed25519 */
#define CART_KEY_ID_SIZE    8       /* truncated SHA-256 of pubkey */

/* Verdict codes for the binary verdict pipe */
#define CART_VERDICT_UNSIGNED   0
#define CART_VERDICT_VERIFIED   1
#define CART_VERDICT_BAD_SIG    2
#define CART_VERDICT_BAD_HASH   3
#define CART_VERDICT_BAD_FORMAT 4
#define CART_VERDICT_NO_CART    5

struct cart_header {
    uint8_t  magic[4];                  /* 0x00: "CART"                    */
    uint8_t  version;                   /* 0x04: format version (1)        */
    uint8_t  flags;                     /* 0x05: reserved (0)              */
    uint16_t reserved;                  /* 0x06: reserved (0)              */
    uint32_t manifest_len;              /* 0x08: manifest size in bytes    */
    uint64_t payload_len;               /* 0x0C: payload size in bytes     */
    uint8_t  manifest_hash[CART_HASH_SIZE]; /* 0x14: SHA-512 of manifest   */
    uint8_t  payload_hash[CART_HASH_SIZE];  /* 0x54: SHA-512 of payload    */
    uint8_t  key_id[CART_KEY_ID_SIZE];  /* 0x94: SHA-256(pubkey)[0:8]      */
    uint8_t  padding[4];               /* 0x9C: zero                      */
} __attribute__((packed));

_Static_assert(sizeof(struct cart_header) == CART_HEADER_SIZE,
               "cart_header must be exactly 160 bytes");

/*
 * Binary verdict written to FD 3 pipe.
 * 17 bytes total — no parsing ambiguity.
 */
struct cart_verdict {
    uint8_t  code;                      /* CART_VERDICT_* enum             */
    uint8_t  key_id[CART_KEY_ID_SIZE];  /* which key validated (or zeros)  */
    uint64_t boot_time;                 /* unix timestamp                  */
} __attribute__((packed));

_Static_assert(sizeof(struct cart_verdict) == 17,
               "cart_verdict must be exactly 17 bytes");

#endif /* CART_H */
