#!/bin/bash
set -e
cd "$(dirname "$0")"
pkg_flags=$(pkg-config --cflags --libs freetype2)
zig cc -shared -fPIC -O2 ft_helper.c -o ft_helper.so $pkg_flags -target x86_64-linux-gnu
echo "Built: ft_helper.so"
