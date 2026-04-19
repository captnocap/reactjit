// applescript_shim.m — Execute AppleScript via NSAppleScript (Objective-C)
// No subprocess, no threading issues. Runs in-process via OSA.

#import <Foundation/Foundation.h>

const char* applescript_execute(const char* script) {
    static char result_buf[65536];
    result_buf[0] = '\0';

    @autoreleasepool {
        NSString* src = [NSString stringWithUTF8String:script];
        NSDictionary* errorDict = nil;
        NSAppleScript* as = [[NSAppleScript alloc] initWithSource:src];
        NSAppleEventDescriptor* res = [as executeAndReturnError:&errorDict];

        if (res) {
            NSString* str = [res stringValue];
            if (str) {
                const char* utf8 = [str UTF8String];
                size_t len = strlen(utf8);
                if (len >= sizeof(result_buf)) len = sizeof(result_buf) - 1;
                memcpy(result_buf, utf8, len);
                result_buf[len] = '\0';
            } else {
                // Some results don't have a string value (e.g. records, lists)
                NSString* desc = [res description];
                const char* utf8 = [desc UTF8String];
                size_t len = strlen(utf8);
                if (len >= sizeof(result_buf)) len = sizeof(result_buf) - 1;
                memcpy(result_buf, utf8, len);
                result_buf[len] = '\0';
            }
        } else if (errorDict) {
            NSString* errMsg = errorDict[NSAppleScriptErrorMessage];
            if (errMsg) {
                const char* utf8 = [errMsg UTF8String];
                snprintf(result_buf, sizeof(result_buf), "ERROR: %s", utf8);
            } else {
                snprintf(result_buf, sizeof(result_buf), "ERROR: AppleScript execution failed");
            }
        }
    }

    return result_buf;
}
