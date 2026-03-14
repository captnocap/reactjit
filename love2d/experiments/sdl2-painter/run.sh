#\!/bin/bash
set -e
cd "$(dirname "$0")"
[ \! -f ft_helper.so ] && bash build.sh
exec luajit main.lua
