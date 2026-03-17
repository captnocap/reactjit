//! Win32 API declarations not exposed by Zig's std.os.windows.
//! Only compiled on Windows targets.

const std = @import("std");

pub const HANDLE = std.os.windows.HANDLE;
pub const DWORD = std.os.windows.DWORD;
pub const BOOL = std.os.windows.BOOL;

pub const PROCESS_TERMINATE = 0x0001;
pub const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
pub const STILL_ACTIVE: DWORD = 259;
pub const PIPE_NOWAIT: DWORD = 0x00000001;

pub extern "kernel32" fn OpenProcess(
    dwDesiredAccess: DWORD,
    bInheritHandle: BOOL,
    dwProcessId: DWORD,
) callconv(.winapi) ?HANDLE;

pub extern "kernel32" fn TerminateProcess(
    hProcess: HANDLE,
    uExitCode: c_uint,
) callconv(.winapi) BOOL;

pub extern "kernel32" fn GetExitCodeProcess(
    hProcess: HANDLE,
    lpExitCode: *DWORD,
) callconv(.winapi) BOOL;

pub extern "kernel32" fn GetProcessId(
    hProcess: HANDLE,
) callconv(.winapi) DWORD;

pub extern "kernel32" fn GetCurrentProcessId() callconv(.winapi) DWORD;

pub extern "kernel32" fn SetNamedPipeHandleState(
    hNamedPipe: HANDLE,
    lpMode: ?*DWORD,
    lpMaxCollectionCount: ?*DWORD,
    lpCollectDataTimeout: ?*DWORD,
) callconv(.winapi) BOOL;

pub extern "kernel32" fn ReadFile(
    hFile: HANDLE,
    lpBuffer: [*]u8,
    nNumberOfBytesToRead: DWORD,
    lpNumberOfBytesRead: ?*DWORD,
    lpOverlapped: ?*anyopaque,
) callconv(.winapi) BOOL;

pub fn closeHandle(handle: HANDLE) void {
    std.os.windows.CloseHandle(handle);
}
