# widget syntax
what it is
ws is a way to create a widget in a single file that pulls in only what is needed for the process and nothing more


# the syntax

<ffi>
open @("lib.so")
</ffi>
<functions>
init(path)   = open + exec