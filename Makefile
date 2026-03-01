# reactjit Makefile
# Builds: QuickJS shared library + bundled React apps for Love2D target
# Cross-platform: works on Linux (x86_64/aarch64) and macOS (Intel/Apple Silicon)

# ── Platform detection ─────────────────────────────────
UNAME_S := $(shell uname -s)
UNAME_M := $(shell uname -m)

ifeq ($(UNAME_S),Darwin)
  LIB_EXT := .dylib
  # Portable readlink -f (macOS lacks GNU readlink)
  READLINK_F = python3 -c "import os,sys; print(os.path.realpath(sys.argv[1]))"
  # Find a Homebrew/system library by name (returns path or empty)
  # Usage: $(call find_dylib,libmpv.2)
  find_dylib = $(shell find /opt/homebrew/lib /usr/local/lib /usr/lib 2>/dev/null -name '$(1).dylib' -o -name '$(1)*.dylib' 2>/dev/null | head -1)
else
  LIB_EXT := .so
  READLINK_F = readlink -f
  find_dylib = $(shell ldconfig -p 2>/dev/null | grep '$(1)' | head -1 | sed 's/.*=> //')
endif

QUICKJS_DIR = quickjs
NATIVE_GAME = examples/native-hud/game
LIB_DIR = $(NATIVE_GAME)/lib
STORYBOOK_LOVE = storybook/love
STORYBOOK_LIB = $(STORYBOOK_LOVE)/lib

.PHONY: all clean dist-clean setup build build-web build-storybook-love build-storybook-web dev-storybook-love storybook-love storybook-web install dist-storybook dist-storybook-windows dist-cli dist-cli-full dist-cli-light release cli-setup build-blake3 build-natives build-luajit build-all-platforms

all: setup build

# ── Dependencies ────────────────────────────────────────

install: node_modules

node_modules:
	npm install

# ── QuickJS setup ─────────────────────────────────────────
# All C compilation is handled by build.zig (zig build).
# build.zig references native/quickjs-shim/qjs_ffi_shim.c directly —
# no manual copy into the quickjs/ source tree needed.

setup: $(LIB_DIR)/libquickjs$(LIB_EXT) lib/libblake3$(LIB_EXT)

$(QUICKJS_DIR):
	git clone https://github.com/quickjs-ng/quickjs.git $(QUICKJS_DIR)

$(LIB_DIR):
	mkdir -p $(LIB_DIR)

$(LIB_DIR)/libquickjs$(LIB_EXT): $(QUICKJS_DIR) $(LIB_DIR)
	zig build libquickjs
	cp zig-out/lib/libquickjs$(LIB_EXT) $(LIB_DIR)/

# ── BLAKE3 (crypto) ────────────────────────────────────
# Built via zig build (cross-compilable). Uses x86-64 assembly on unix,
# portable C on Windows/aarch64.

lib/libblake3$(LIB_EXT): third_party/blake3/blake3.c
	zig build blake3
	mkdir -p lib
	cp zig-out/lib/libblake3$(LIB_EXT) $@
	@echo "  Built libblake3$(LIB_EXT) (via zig)"

build-blake3: lib/libblake3$(LIB_EXT)

# Copy libquickjs to storybook
$(STORYBOOK_LIB)/libquickjs$(LIB_EXT): $(LIB_DIR)/libquickjs$(LIB_EXT)
	mkdir -p $(STORYBOOK_LIB)
	cp zig-out/lib/libquickjs$(LIB_EXT) $(STORYBOOK_LIB)/

# ── Build targets ───────────────────────────────────────

build: build-web build-storybook-love build-storybook-web

build-web: node_modules
	npx esbuild \
		--bundle \
		--format=esm \
		--target=es2020 \
		--jsx=automatic \
		--outfile=examples/web-overlay/dist/app.js \
		examples/web-overlay/src/main.tsx

build-storybook-web: node_modules
	npx esbuild \
		--bundle \
		--format=esm \
		--target=es2020 \
		--jsx=automatic \
		--outfile=storybook/dist/storybook.js \
		storybook/src/main.tsx

build-storybook-love: node_modules
	npx esbuild \
		--bundle \
		--format=iife \
		--global-name=ReactJITStorybook \
		--target=es2020 \
		--jsx=automatic \
		--external:child_process \
		--external:ws \
		--outfile=$(STORYBOOK_LOVE)/bundle.js \
		storybook/src/native-main.tsx

# ── Storybook ──────────────────────────────────────────

storybook-love: setup build-storybook-love $(STORYBOOK_LIB)/libquickjs$(LIB_EXT)
	@echo ""
	@echo "=== Love2D Storybook ready ==="
	@echo "  Run:  cd $(STORYBOOK_LOVE) && love ."
	@echo ""

storybook-web: build-storybook-web
	@echo "Web storybook built. Serve with: cd storybook && python3 -m http.server 8080"

# ── Dist (consumer-facing distributable) ─────────────────
#
# Produces a single self-extracting binary that runs on any x86_64 Linux
# with zero dependencies. Bundles Love2D, all shared libraries (including
# glibc and ld-linux), libquickjs, and the .love game archive.
#
# The binary extracts to ~/.cache/reactjit-demo/<hash>/ on first run
# and launches via the bundled dynamic linker (ld-linux), bypassing the
# host's glibc entirely. Same technique as Steam Runtime / AppImage.
#
# This is ONLY for end-user distribution. Developer tooling (CLI, dev
# server, `love .` workflow) lives in the CLI/dev sections below and
# expects Love2D + deps installed on the dev machine.

DIST_DIR = dist
DIST_BINARY = $(DIST_DIR)/reactjit-demo
STAGING_DIR = /tmp/reactjit-demo-staging
PAYLOAD_DIR = /tmp/reactjit-demo-payload

# Only linux-vdso is kernel-injected and cannot be bundled.
VDSO_EXCLUDE = linux-vdso

# ── Windows dist vars ────────────────────────────────────
LOVE_WIN_VERSION = 11.5
LOVE_WIN_ZIP     = vendor/love-$(LOVE_WIN_VERSION)-win64.zip
LOVE_WIN_DIR     = vendor/love-$(LOVE_WIN_VERSION)-win64
WIN_STAGING      = /tmp/reactjit-demo-win

dist-storybook: build-storybook-love setup
ifneq ($(UNAME_S),Linux)
	@echo "Error: dist-storybook produces a self-extracting Linux binary."
	@echo "  This target can only run on Linux (requires ldd, ldconfig, ld-linux)."
	@echo "  Use 'rjit build linux' for cross-compiled builds from any host."
	@exit 1
endif
	@echo "=== Packaging single-file binary ==="
	mkdir -p $(DIST_DIR)
	rm -rf $(DIST_BINARY)
	rm -rf $(STAGING_DIR) $(PAYLOAD_DIR)
	# ── Build the .love zip ──
	# Bundle goes into love/ subdir — matches bundlePath = "love/bundle.js" in main.lua.
	mkdir -p $(STAGING_DIR)/lua/audio/modules $(STAGING_DIR)/lua/themes $(STAGING_DIR)/lua/effects $(STAGING_DIR)/lua/masks $(STAGING_DIR)/lua/capabilities $(STAGING_DIR)/lua/classifiers $(STAGING_DIR)/love
	cp $(STORYBOOK_LOVE)/bundle.js $(STAGING_DIR)/love/
	cp packaging/storybook/main.lua $(STAGING_DIR)/
	cp packaging/storybook/conf.lua $(STAGING_DIR)/
	cp lua/*.lua $(STAGING_DIR)/lua/
	cp lua/audio/*.lua $(STAGING_DIR)/lua/audio/
	cp lua/audio/modules/*.lua $(STAGING_DIR)/lua/audio/modules/
	cp lua/themes/*.lua $(STAGING_DIR)/lua/themes/
	cp lua/effects/*.lua $(STAGING_DIR)/lua/effects/
	cp lua/masks/*.lua $(STAGING_DIR)/lua/masks/
	cp lua/capabilities/*.lua $(STAGING_DIR)/lua/capabilities/
	cp lua/classifiers/*.lua $(STAGING_DIR)/lua/classifiers/
	cd $(STAGING_DIR) && zip -9 -r /tmp/reactjit-demo.love .
	# ── Assemble payload directory ──
	# Don't fuse — ld-linux invocation breaks /proc/self/exe detection.
	# Instead, keep love binary and .love zip separate; pass .love as arg.
	mkdir -p $(PAYLOAD_DIR)/lib
	cp $$(readlink -f $$(which love)) $(PAYLOAD_DIR)/love.bin
	cp /tmp/reactjit-demo.love $(PAYLOAD_DIR)/game.love
	cp $(QUICKJS_DIR)/libquickjs.so $(PAYLOAD_DIR)/lib/
	@LIBMPV=$$(ldconfig -p | grep 'libmpv.so.2 ' | head -1 | sed 's/.*=> //'); \
	if [ -n "$$LIBMPV" ]; then \
		cp "$$LIBMPV" $(PAYLOAD_DIR)/lib/libmpv.so.2; \
		echo "  Bundled libmpv.so.2"; \
		ldd "$$LIBMPV" | grep "=> /" | grep -v '$(VDSO_EXCLUDE)' | \
			awk '{print $$1, $$3}' | while read soname path; do \
				case "$$soname" in \
					libx264.*|libx265.*|libSvtAv1Enc.*|librav1e.*|libshine.*|libtwolame.*|libvo-amrwbenc.*|libxvidcore.*) continue ;; \
					libopenblas.*|liblapack.*|libblas.*|libgfortran.*) continue ;; \
					libflite*|libpocketsphinx.*|libsphinxbase.*) continue ;; \
					libcodec2.*|libopencore-amr*|libgsm.*|libopenmpt.*|libgme.*) continue ;; \
					libcaca.*|libsixel.*|libslang.*|libncursesw.*|libtinfo.*) continue ;; \
					libzvbi.*|libaribb24.*) continue ;; \
					libcdio*|libdc1394.*|libavc1394.*|libiec61883.*|libraw1394.*|librom1394.*) continue ;; \
					libzmq.*|libpgm-*|libnorm.*|libsodium.*|librabbitmq.*|libsrt-gnutls.*|librist.*) continue ;; \
					librsvg*|libgdk_pixbuf*|libcairo-gobject.*) continue ;; \
					libjxl*|libhwy.*) continue ;; \
					libdb-5.3.*|liblua5.2.*|libmujs.*) continue ;; \
				esac; \
				if [ ! -f $(PAYLOAD_DIR)/lib/"$$soname" ]; then \
					real=$$(readlink -f "$$path"); \
					cp "$$real" $(PAYLOAD_DIR)/lib/"$$soname"; \
				fi; \
			done; \
	fi
	@if [ -f cli/runtime/bin/tor ]; then \
		mkdir -p $(PAYLOAD_DIR)/bin; \
		cp cli/runtime/bin/tor $(PAYLOAD_DIR)/bin/tor; \
		chmod +x $(PAYLOAD_DIR)/bin/tor; \
		echo "  Bundled tor"; \
		ldd $(PAYLOAD_DIR)/bin/tor | grep "=> /" | grep -v '$(VDSO_EXCLUDE)' | \
			awk '{print $$1, $$3}' | while read soname path; do \
				if [ ! -f $(PAYLOAD_DIR)/lib/"$$soname" ]; then \
					real=$$(readlink -f "$$path"); \
					cp "$$real" $(PAYLOAD_DIR)/lib/"$$soname"; \
				fi; \
			done; \
	fi
	@echo "--- Bundling shared libraries ---"
	ldd $(PAYLOAD_DIR)/love.bin | grep "=> /" | grep -v '$(VDSO_EXCLUDE)' | \
		awk '{print $$1, $$3}' | while read soname path; do \
			real=$$(readlink -f "$$path"); \
			cp "$$real" $(PAYLOAD_DIR)/lib/"$$soname"; \
		done
	# ── Bundle the dynamic linker itself ──
	cp $$(readlink -f /lib64/ld-linux-x86-64.so.2) $(PAYLOAD_DIR)/lib/ld-linux-x86-64.so.2
	# ── Create launcher that uses bundled ld-linux ──
	printf '#!/bin/sh\nDIR="$$(cd "$$(dirname "$$0")" && pwd)"\nexec "$$DIR/lib/ld-linux-x86-64.so.2" --inhibit-cache --library-path "$$DIR/lib" "$$DIR/love.bin" "$$DIR/game.love" "$$@"\n' > $(PAYLOAD_DIR)/run
	chmod +x $(PAYLOAD_DIR)/run
	# ── Pack into single self-extracting binary ──
	cd $(PAYLOAD_DIR) && tar czf /tmp/reactjit-demo.tar.gz .
	printf '#!/bin/sh\nset -e\nAPP_DIR=$${XDG_CACHE_HOME:-$$HOME/.cache}/reactjit-demo\nSIG=$$(md5sum "$$0" 2>/dev/null | cut -c1-8 || cksum "$$0" | cut -d" " -f1)\nCACHE="$$APP_DIR/$$SIG"\nif [ ! -f "$$CACHE/.ready" ]; then\n  rm -rf "$$APP_DIR"\n  mkdir -p "$$CACHE"\n  SKIP=$$(awk '"'"'/^__ARCHIVE__$$/{print NR + 1; exit}'"'"' "$$0")\n  tail -n+"$$SKIP" "$$0" | tar xz -C "$$CACHE"\n  touch "$$CACHE/.ready"\nfi\nexec "$$CACHE/run" "$$@"\n__ARCHIVE__\n' > $(DIST_BINARY)
	cat /tmp/reactjit-demo.tar.gz >> $(DIST_BINARY)
	chmod +x $(DIST_BINARY)
	# ── Cleanup ──
	rm -rf $(STAGING_DIR) $(PAYLOAD_DIR) /tmp/reactjit-demo.love /tmp/reactjit-demo.tar.gz
	@echo "=== Done: $(DIST_BINARY) ==="
	@echo "  Size: $$(du -h $(DIST_BINARY) | cut -f1)"
	@echo "  Run:  ./$(DIST_BINARY)"

# ── Windows dist ────────────────────────────────────────

# Download Love2D Windows binaries (one-time, cached in vendor/).
$(LOVE_WIN_ZIP):
	mkdir -p vendor
	curl -L -o $(LOVE_WIN_ZIP) \
		https://github.com/love2d/love/releases/download/$(LOVE_WIN_VERSION)/love-$(LOVE_WIN_VERSION)-win64.zip
	@echo "  Downloaded $(LOVE_WIN_ZIP)"

$(LOVE_WIN_DIR)/love.exe: $(LOVE_WIN_ZIP)
	mkdir -p $(LOVE_WIN_DIR)
	unzip -o $(LOVE_WIN_ZIP) -d vendor/
	touch $(LOVE_WIN_DIR)/love.exe
	@echo "  Extracted Love2D win64 to $(LOVE_WIN_DIR)"

# Cross-compile libquickjs for Windows via Zig (output kept separate from Linux build).
zig-out-win/bin/quickjs.dll:
	zig build libquickjs -Dtarget=x86_64-windows-gnu --prefix zig-out-win
	@echo "  Built quickjs.dll for Windows"

# Zig self-extracting launcher stub (always Windows, no console window).
zig-out/bin/rjit-launcher.exe:
	zig build win-launcher
	@echo "  Built rjit-launcher.exe"

# Cross-compile libmpv for Windows using zig cc (FFmpeg statically linked in).
# First build only — subsequent runs are skipped by Make's file check.
vendor/mpv-win64/mpv-2.dll:
	bash scripts/build-libmpv-windows.sh

dist-storybook-windows: build-storybook-love $(LOVE_WIN_DIR)/love.exe zig-out-win/bin/quickjs.dll zig-out/bin/rjit-launcher.exe vendor/mpv-win64/mpv-2.dll
	@echo "=== Packaging single-file Windows exe ==="
	mkdir -p $(DIST_DIR)
	rm -rf $(WIN_STAGING)
	# ── Build the .love zip ──
	mkdir -p $(STAGING_DIR)/lua/audio/modules $(STAGING_DIR)/lua/themes $(STAGING_DIR)/lua/effects $(STAGING_DIR)/lua/masks $(STAGING_DIR)/lua/capabilities $(STAGING_DIR)/lua/classifiers $(STAGING_DIR)/love
	cp $(STORYBOOK_LOVE)/bundle.js $(STAGING_DIR)/love/
	cp packaging/storybook/main.lua $(STAGING_DIR)/
	cp packaging/storybook/conf.lua $(STAGING_DIR)/
	cp lua/*.lua $(STAGING_DIR)/lua/
	cp lua/audio/*.lua $(STAGING_DIR)/lua/audio/
	cp lua/audio/modules/*.lua $(STAGING_DIR)/lua/audio/modules/
	cp lua/themes/*.lua $(STAGING_DIR)/lua/themes/
	cp lua/effects/*.lua $(STAGING_DIR)/lua/effects/
	cp lua/masks/*.lua $(STAGING_DIR)/lua/masks/
	cp lua/capabilities/*.lua $(STAGING_DIR)/lua/capabilities/
	cp lua/classifiers/*.lua $(STAGING_DIR)/lua/classifiers/
	cd $(STAGING_DIR) && zip -9 -r /tmp/reactjit-demo.love .
	rm -rf $(STAGING_DIR)
	# ── Assemble payload zip: fused love.exe + DLLs + libquickjs.dll + mpv-2.dll ──
	mkdir -p $(WIN_STAGING)/lib
	cat $(LOVE_WIN_DIR)/love.exe /tmp/reactjit-demo.love > $(WIN_STAGING)/game.exe
	cp $(LOVE_WIN_DIR)/*.dll $(WIN_STAGING)/
	cp zig-out-win/bin/quickjs.dll $(WIN_STAGING)/lib/libquickjs.dll
	cp vendor/mpv-win64/mpv-2.dll $(WIN_STAGING)/
	cd $(WIN_STAGING) && zip -9 -r /tmp/reactjit-payload.zip .
	rm -rf $(WIN_STAGING) /tmp/reactjit-demo.love
	# ── Concatenate: launcher.exe + payload.zip + 8-byte offset footer ──
	rm -f $(DIST_DIR)/reactjit-demo.exe
	cat zig-out/bin/rjit-launcher.exe /tmp/reactjit-payload.zip > $(DIST_DIR)/reactjit-demo.exe
	python3 -c "import sys,struct; sys.stdout.buffer.write(struct.pack('<Q', $$(wc -c < zig-out/bin/rjit-launcher.exe)))" >> $(DIST_DIR)/reactjit-demo.exe
	rm -f /tmp/reactjit-payload.zip
	@echo "=== Done: $(DIST_DIR)/reactjit-demo.exe ==="
	@echo "  Size: $$(du -h $(DIST_DIR)/reactjit-demo.exe | cut -f1)"
	@echo "  Single file — send reactjit-demo.exe, double-click to run"

# ── Dev mode (watch + run) ──────────────────────────────

dev-storybook-love: setup $(STORYBOOK_LIB)/libquickjs$(LIB_EXT) node_modules
	npx esbuild \
		--bundle \
		--format=iife \
		--global-name=ReactJITStorybook \
		--target=es2020 \
		--jsx=automatic \
		--outfile=$(STORYBOOK_LOVE)/bundle.js \
		--watch \
		storybook/src/native-main.tsx

# ── CLI setup (developer tooling — expects Love2D installed) ──

cli-setup: setup
	@echo "=== Populating CLI runtime ($(UNAME_S) $(UNAME_M)) ==="
	rm -rf cli/runtime
	mkdir -p cli/runtime/lua cli/runtime/lib cli/runtime/bin cli/runtime/reactjit
	cp lua/*.lua cli/runtime/lua/
	mkdir -p cli/runtime/lua/g3d
	cp lua/g3d/* cli/runtime/lua/g3d/
	mkdir -p cli/runtime/lua/audio/modules
	cp lua/audio/*.lua cli/runtime/lua/audio/
	cp lua/audio/modules/*.lua cli/runtime/lua/audio/modules/
	mkdir -p cli/runtime/lua/capabilities
	cp lua/capabilities/*.lua cli/runtime/lua/capabilities/
	mkdir -p cli/runtime/lua/classifiers
	cp lua/classifiers/*.lua cli/runtime/lua/classifiers/
	mkdir -p cli/runtime/lua/effects
	cp lua/effects/*.lua cli/runtime/lua/effects/
	mkdir -p cli/runtime/lua/masks
	cp lua/masks/*.lua cli/runtime/lua/masks/
	mkdir -p cli/runtime/lua/child_window
	cp lua/child_window/*.lua cli/runtime/lua/child_window/
	mkdir -p cli/runtime/lua/devtools_window
	cp lua/devtools_window/*.lua cli/runtime/lua/devtools_window/
	cp zig-out/lib/libquickjs$(LIB_EXT) cli/runtime/lib/
	@# ── Optional system libraries (platform-aware discovery) ──
ifeq ($(UNAME_S),Darwin)
	@# macOS: search Homebrew and system paths
	@LIBMPV=$$(find /opt/homebrew/lib /usr/local/lib 2>/dev/null -name 'libmpv.2.dylib' -o -name 'libmpv.dylib' 2>/dev/null | head -1); \
	if [ -n "$$LIBMPV" ]; then \
		cp "$$LIBMPV" cli/runtime/lib/libmpv.2.dylib; \
		echo "  Bundled libmpv.2.dylib"; \
	else \
		echo "  Warning: libmpv not found — video playback won't be bundled"; \
	fi
	@LIBSQLITE=$$(find /opt/homebrew/opt/sqlite/lib /opt/homebrew/lib /usr/local/lib 2>/dev/null -name 'libsqlite3.0.dylib' -o -name 'libsqlite3.dylib' 2>/dev/null | head -1); \
	if [ -n "$$LIBSQLITE" ]; then \
		cp "$$LIBSQLITE" cli/runtime/lib/libsqlite3.0.dylib; \
		echo "  Bundled libsqlite3.0.dylib"; \
	else \
		echo "  Warning: libsqlite3 not found — SQLite features won't be bundled"; \
	fi
	@LIBARCHIVE=$$(find /opt/homebrew/opt/libarchive/lib /opt/homebrew/lib /usr/local/opt/libarchive/lib /usr/local/lib 2>/dev/null -name 'libarchive.13.dylib' -o -name 'libarchive.dylib' 2>/dev/null | head -1); \
	if [ -n "$$LIBARCHIVE" ]; then \
		cp "$$LIBARCHIVE" cli/runtime/lib/libarchive.13.dylib; \
		echo "  Bundled libarchive.13.dylib"; \
	else \
		echo "  Warning: libarchive not found — archive features won't be bundled"; \
	fi
	@LIBSODIUM=$$(find /opt/homebrew/lib /usr/local/lib 2>/dev/null -name 'libsodium.dylib' 2>/dev/null | head -1); \
	if [ -n "$$LIBSODIUM" ]; then \
		cp "$$LIBSODIUM" cli/runtime/lib/libsodium.dylib; \
		echo "  Bundled libsodium.dylib"; \
	else \
		echo "  Warning: libsodium not found — crypto features won't be bundled"; \
	fi
	@LIBCRYPTO=$$(find /opt/homebrew/lib /usr/local/lib 2>/dev/null -name 'libcrypto.dylib' 2>/dev/null | head -1); \
	if [ -n "$$LIBCRYPTO" ]; then \
		cp "$$LIBCRYPTO" cli/runtime/lib/libcrypto.dylib; \
		echo "  Bundled libcrypto.dylib"; \
	else \
		echo "  Warning: libcrypto not found — BLAKE2s/PBKDF2 won't be bundled"; \
	fi
else
	@# Linux: use ldconfig for library discovery
	@LIBMPV=$$(ldconfig -p | grep 'libmpv.so.2 ' | head -1 | sed 's/.*=> //'); \
	if [ -n "$$LIBMPV" ]; then \
		cp "$$LIBMPV" cli/runtime/lib/libmpv.so.2; \
		echo "  Bundled libmpv.so.2"; \
	else \
		echo "  Warning: libmpv.so.2 not found — video playback won't be bundled"; \
	fi
	@LIBSQLITE=$$(ldconfig -p | grep 'libsqlite3.so.0 ' | grep 'x86-64' | head -1 | sed 's/.*=> //'); \
	if [ -n "$$LIBSQLITE" ]; then \
		cp "$$LIBSQLITE" cli/runtime/lib/libsqlite3.so.0; \
		echo "  Bundled libsqlite3.so.0"; \
	else \
		echo "  Warning: libsqlite3.so.0 not found — SQLite features won't be bundled"; \
	fi
	@LIBARCHIVE=$$(ldconfig -p | grep 'libarchive.so.13 ' | grep 'x86-64' | head -1 | sed 's/.*=> //'); \
	if [ -n "$$LIBARCHIVE" ]; then \
		cp "$$LIBARCHIVE" cli/runtime/lib/libarchive.so.13; \
		echo "  Bundled libarchive.so.13"; \
	else \
		echo "  Warning: libarchive.so.13 not found — archive features won't be bundled"; \
	fi
	@LIBSODIUM=$$(ldconfig -p | grep 'libsodium.so' | grep 'x86-64' | head -1 | sed 's/.*=> //'); \
	if [ -n "$$LIBSODIUM" ]; then \
		cp "$$LIBSODIUM" cli/runtime/lib/libsodium.so; \
		echo "  Bundled libsodium.so"; \
	else \
		echo "  Warning: libsodium.so not found — crypto features won't be bundled"; \
	fi
	@LIBCRYPTO=$$(ldconfig -p | grep 'libcrypto.so ' | grep 'x86-64' | head -1 | sed 's/.*=> //'); \
	if [ -n "$$LIBCRYPTO" ]; then \
		cp "$$LIBCRYPTO" cli/runtime/lib/libcrypto.so; \
		echo "  Bundled libcrypto.so"; \
	else \
		echo "  Warning: libcrypto.so not found — BLAKE2s/PBKDF2 won't be bundled"; \
	fi
endif
	@zig build blake3 \
		&& cp zig-out/lib/libblake3$(LIB_EXT) cli/runtime/lib/libblake3$(LIB_EXT) \
		&& echo "  Bundled libblake3$(LIB_EXT) (via zig)" \
		|| echo "  Warning: libblake3 build failed — BLAKE3 hashing unavailable"
	@TOR=$$(which tor 2>/dev/null); \
	if [ -n "$$TOR" ]; then \
		cp "$$($(READLINK_F) "$$TOR")" cli/runtime/bin/tor; \
		chmod +x cli/runtime/bin/tor; \
		echo "  Bundled tor"; \
	else \
		echo "  Warning: tor not found — .onion hosting won't be bundled"; \
	fi
	@# ── Windows cross-compiled binaries (for rjit build windows) ──
	@if [ -f zig-out/bin/rjit-launcher.exe ]; then \
		cp zig-out/bin/rjit-launcher.exe cli/runtime/bin/rjit-launcher.exe; \
		echo "  Bundled rjit-launcher.exe (Windows self-extractor)"; \
	else \
		echo "  Warning: rjit-launcher.exe not found — run 'zig build win-launcher' first"; \
	fi
	@mkdir -p cli/runtime/lib/win64; \
	if [ -f zig-out-win/bin/quickjs.dll ]; then \
		cp zig-out-win/bin/quickjs.dll cli/runtime/lib/win64/libquickjs.dll; \
		echo "  Bundled libquickjs.dll (Windows)"; \
	else \
		echo "  Warning: quickjs.dll not found — run 'zig build libquickjs -Dtarget=x86_64-windows-gnu' first"; \
	fi
	cp -r packages/core cli/runtime/reactjit/core
	cp -r packages/native cli/runtime/reactjit/native
	cp -r packages/router cli/runtime/reactjit/router
	cp -r packages/storage cli/runtime/reactjit/storage
	cp -r packages/audio cli/runtime/reactjit/audio
	cp -r packages/server cli/runtime/reactjit/server
	cp -r packages/ai cli/runtime/reactjit/ai
	cp -r packages/apis cli/runtime/reactjit/apis
	cp -r packages/rss cli/runtime/reactjit/rss
	cp -r packages/webhooks cli/runtime/reactjit/webhooks
	cp -r packages/crypto cli/runtime/reactjit/crypto
	cp -r packages/media cli/runtime/reactjit/media
	cp -r packages/3d cli/runtime/reactjit/3d
	cp -r packages/controls cli/runtime/reactjit/controls
	cp -r packages/geo cli/runtime/reactjit/geo
	cp -r packages/theme cli/runtime/reactjit/theme
	mkdir -p cli/runtime/lua/themes
	cp lua/themes/*.lua cli/runtime/lua/themes/
	@if [ -d fonts/base ]; then \
		mkdir -p cli/runtime/fonts; \
		cp -r fonts/base cli/runtime/fonts/; \
		if [ -f fonts/manifest.json ]; then cp fonts/manifest.json cli/runtime/fonts/; fi; \
		echo "  Bundled fonts: base only ($$(du -sh fonts/base | cut -f1)) — use 'reactjit fonts add <pack>' for i18n"; \
	fi
	@if [ -d data ]; then \
		mkdir -p cli/runtime/data; \
		cp -r data/* cli/runtime/data/; \
		echo "  Bundled data ($$(du -sh data | cut -f1))"; \
	fi
	@echo "=== CLI runtime ready. Run: cd cli && npm link ==="

# ── Cross-compilation targets ─────────────────────────────
# Build all native artifacts (zig + LuaJIT) for a target platform.
# Usage: make build-natives TARGET=x86_64-linux-gnu
#        make build-luajit TARGET=x86_64-windows-gnu
#        make build-all-platforms

build-natives:
	@test -n "$(TARGET)" || { echo "Usage: make build-natives TARGET=<zig-triple>"; exit 1; }
	zig build all -Dtarget=$(TARGET)
	@echo "=== Native artifacts built for $(TARGET) ==="

build-luajit:
	@test -n "$(TARGET)" || { echo "Usage: make build-luajit TARGET=<zig-triple>"; exit 1; }
	bash scripts/build-luajit-cross.sh $(TARGET)

build-all-platforms:
	@echo "=== Building for all platforms ==="
	zig build all
	bash scripts/build-luajit-cross.sh native
	zig build all -Dtarget=x86_64-linux-gnu
	bash scripts/build-luajit-cross.sh x86_64-linux-gnu
	zig build all -Dtarget=x86_64-windows-gnu
	bash scripts/build-luajit-cross.sh x86_64-windows-gnu
	zig build all -Dtarget=aarch64-linux-gnu
	bash scripts/build-luajit-cross.sh aarch64-linux-gnu
	zig build all -Dtarget=x86_64-macos
	bash scripts/build-luajit-cross.sh x86_64-macos
	zig build all -Dtarget=aarch64-macos
	bash scripts/build-luajit-cross.sh aarch64-macos
	@echo "=== All platforms built ==="

# ── CLI distribution (Full / Light / Storybook tiers) ────
# Usage:
#   make dist-cli                         Build all 3 tiers (linux-x64 default)
#   make dist-cli-full PLATFORM=macos-arm64
#   make dist-cli-light PLATFORM=linux-x64

dist-cli-full: cli-setup build-storybook-love
	bash scripts/build-cli-dist.sh $(or $(PLATFORM),linux-x64)

dist-cli-light: cli-setup build-storybook-love
	bash scripts/build-cli-dist.sh $(or $(PLATFORM),linux-x64) --no-node

dist-cli: dist-cli-full dist-cli-light dist-storybook ## Build all 3 tier artifacts

# ── Release ──────────────────────────────────────────────
# Usage: make release VERSION=0.2.0
# Bumps package.json, commits, tags, pushes. GitHub Actions handles the rest.

release:
	@test -n "$(VERSION)" || { echo "Usage: make release VERSION=x.y.z"; exit 1; }
	@echo "=== Releasing v$(VERSION) ==="
	node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json','utf-8')); p.version='$(VERSION)'; fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');"
	git add package.json
	git commit -m "release: v$(VERSION)"
	git tag "v$(VERSION)"
	@echo "=== Tagged v$(VERSION). Push with: git push && git push --tags ==="

# ── Clean ───────────────────────────────────────────────

clean-demos:
	@./scripts/clean-dormant-demos.sh

dist-clean:
	rm -rf $(DIST_DIR)
	rm -rf $${XDG_CACHE_HOME:-$$HOME/.cache}/reactjit-demo

clean: dist-clean
	rm -f examples/web-overlay/dist/app.js
	rm -f storybook/dist/storybook.js
	rm -f $(STORYBOOK_LOVE)/bundle.js
	rm -rf $(LIB_DIR)
	rm -rf $(STORYBOOK_LIB)
	rm -rf node_modules
