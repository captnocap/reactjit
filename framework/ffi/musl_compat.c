// musl compatibility shim for glibc-built static libraries (e.g., wgpu-native)
// musl uses 64-bit types natively — no need for the *64 variants.

#define _GNU_SOURCE
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/mman.h>
#include <fcntl.h>

// glibc's stat64 → musl's stat (already 64-bit)
int stat64(const char *path, struct stat *buf) {
    return stat(path, buf);
}

int fstat64(int fd, struct stat *buf) {
    return fstat(fd, buf);
}

int lstat64(const char *path, struct stat *buf) {
    return lstat(path, buf);
}

// glibc's mmap64 → musl's mmap (already 64-bit)
void *mmap64(void *addr, size_t len, int prot, int flags, int fd, off_t off) {
    return mmap(addr, len, prot, flags, fd, off);
}

// glibc's open64 → musl's open (already 64-bit)
#include <stdarg.h>
int open64(const char *path, int flags, ...) {
    va_list ap;
    va_start(ap, flags);
    int mode = va_arg(ap, int);
    va_end(ap);
    return open(path, flags, mode);
}

// glibc's lseek64 → musl's lseek (already 64-bit)
#include <unistd.h>
off_t lseek64(int fd, off_t offset, int whence) {
    return lseek(fd, offset, whence);
}

// Other common glibc *64 variants
#include <dirent.h>
#include <stdio.h>

struct dirent64 {
    unsigned long long d_ino;
    long long d_off;
    unsigned short d_reclen;
    unsigned char d_type;
    char d_name[256];
};

int readdir64_r(void *dirp, struct dirent64 *entry, struct dirent64 **result) {
    (void)dirp; (void)entry;
    *result = (void*)0;
    return 0;
}

int ftruncate64(int fd, off_t length) {
    return ftruncate(fd, length);
}

int fcntl64(int fd, int cmd, ...) {
    va_list ap;
    va_start(ap, cmd);
    long arg = va_arg(ap, long);
    va_end(ap);
    return fcntl(fd, cmd, arg);
}
