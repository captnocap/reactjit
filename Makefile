# reactjit Makefile
# Builds: QuickJS shared library + bundled React apps for both targets

QUICKJS_DIR = quickjs
NATIVE_GAME = examples/native-hud/game
LIB_DIR = $(NATIVE_GAME)/lib
STORYBOOK_LOVE = storybook/love
STORYBOOK_LIB = $(STORYBOOK_LOVE)/lib
STORYBOOK_SDL2 = storybook/sdl2
STORYBOOK_SDL2_LIB = $(STORYBOOK_SDL2)/lib

.PHONY: all clean dist-clean setup build build-native build-web build-storybook build-storybook-native build-storybook-sdl2 run dev dev-storybook storybook storybook-sdl2 storybook-web install dist-storybook dist-storybook-windows cli-setup build-blake3

all: setup build

# ── Dependencies ────────────────────────────────────────

install: node_modules

node_modules:
	npm install

# ── QuickJS setup (native target only) ──────────────────
# All C compilation is handled by build.zig (zig build).
# build.zig references native/quickjs-shim/qjs_ffi_shim.c directly —
# no manual copy into the quickjs/ source tree needed.

setup: $(LIB_DIR)/libquickjs.so lib/libblake3.so

$(QUICKJS_DIR):
	git clone https://github.com/quickjs-ng/quickjs.git $(QUICKJS_DIR)

$(LIB_DIR):
	mkdir -p $(LIB_DIR)

$(LIB_DIR)/libquickjs.so: $(QUICKJS_DIR) $(LIB_DIR)
	zig build libquickjs
	cp zig-out/lib/libquickjs.so $(LIB_DIR)/

# ── BLAKE3 (crypto) ────────────────────────────────────
# Built via zig build (cross-compilable). Uses x86-64 assembly on unix,
# portable C on Windows/aarch64.

lib/libblake3.so: third_party/blake3/blake3.c
	zig build blake3
	mkdir -p lib
	cp zig-out/lib/libblake3.so $@
	@echo "  Built libblake3.so (via zig)"

build-blake3: lib/libblake3.so

# Copy libquickjs to storybook
$(STORYBOOK_LIB)/libquickjs.so: $(LIB_DIR)/libquickjs.so
	mkdir -p $(STORYBOOK_LIB)
	cp zig-out/lib/libquickjs.so $(STORYBOOK_LIB)/

# ── Build targets ───────────────────────────────────────

build: build-native build-web build-storybook-native build-storybook

build-native: node_modules
	npx esbuild \
		--bundle \
		--format=iife \
		--global-name=ReactJIT \
		--target=es2020 \
		--jsx=automatic \
		--outfile=$(NATIVE_GAME)/bundle.js \
		examples/native-hud/src/main.tsx

build-web: node_modules
	npx esbuild \
		--bundle \
		--format=esm \
		--target=es2020 \
		--jsx=automatic \
		--outfile=examples/web-overlay/dist/app.js \
		examples/web-overlay/src/main.tsx

build-storybook: node_modules
	npx esbuild \
		--bundle \
		--format=esm \
		--target=es2020 \
		--jsx=automatic \
		--outfile=storybook/dist/storybook.js \
		storybook/src/main.tsx

build-storybook-native: node_modules
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

build-storybook-sdl2: node_modules
	npx esbuild \
		--bundle \
		--format=iife \
		--global-name=ReactJITStorybook \
		--target=es2020 \
		--jsx=automatic \
		--external:child_process \
		--external:ws \
		--outfile=$(STORYBOOK_SDL2)/bundle.js \
		storybook/src/native-main.tsx

# ── Storybook ──────────────────────────────────────────

storybook-sdl2: build-storybook-sdl2 $(STORYBOOK_SDL2_LIB)/libquickjs.so $(STORYBOOK_SDL2_LIB)/libft_helper.so
	@echo ""
	@echo "=== SDL2 Storybook ready ==="
	@echo "  Run:  cd $(STORYBOOK_SDL2) && luajit main.lua"
	@echo ""

$(STORYBOOK_SDL2_LIB)/libquickjs.so: zig-out/lib/libquickjs.so
	mkdir -p $(STORYBOOK_SDL2_LIB)
	cp $< $@

$(STORYBOOK_SDL2_LIB)/libft_helper.so: zig-out/lib/libft_helper.so
	mkdir -p $(STORYBOOK_SDL2_LIB)
	cp $< $@

storybook: setup build-storybook-native build-storybook $(STORYBOOK_LIB)/libquickjs.so
	@echo ""
	@echo "=== Storybook ready ==="
	@echo "  Native:  cd $(STORYBOOK_LOVE) && love ."
	@echo "  Web:     cd storybook && python3 -m http.server 8080"
	@echo ""

storybook-web: build-storybook
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

dist-storybook: build-storybook-native setup
	@echo "=== Packaging single-file binary ==="
	mkdir -p $(DIST_DIR)
	rm -rf $(DIST_BINARY)
	rm -rf $(STAGING_DIR) $(PAYLOAD_DIR)
	# ── Build the .love zip ──
	# Bundle goes into love/ subdir — matches bundlePath = "love/bundle.js" in main.lua.
	mkdir -p $(STAGING_DIR)/lua/audio/modules $(STAGING_DIR)/lua/themes $(STAGING_DIR)/lua/effects $(STAGING_DIR)/love
	cp $(STORYBOOK_LOVE)/bundle.js $(STAGING_DIR)/love/
	cp packaging/storybook/main.lua $(STAGING_DIR)/
	cp packaging/storybook/conf.lua $(STAGING_DIR)/
	cp lua/*.lua $(STAGING_DIR)/lua/
	cp lua/audio/*.lua $(STAGING_DIR)/lua/audio/
	cp lua/audio/modules/*.lua $(STAGING_DIR)/lua/audio/modules/
	cp lua/themes/*.lua $(STAGING_DIR)/lua/themes/
	cp lua/effects/*.lua $(STAGING_DIR)/lua/effects/
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
zig-out/bin/ilr-launcher.exe:
	zig build win-launcher
	@echo "  Built ilr-launcher.exe"

# Cross-compile libmpv for Windows using zig cc (FFmpeg statically linked in).
# First build only — subsequent runs are skipped by Make's file check.
vendor/mpv-win64/mpv-2.dll:
	bash scripts/build-libmpv-windows.sh

dist-storybook-windows: build-storybook-native $(LOVE_WIN_DIR)/love.exe zig-out-win/bin/quickjs.dll zig-out/bin/ilr-launcher.exe vendor/mpv-win64/mpv-2.dll
	@echo "=== Packaging single-file Windows exe ==="
	mkdir -p $(DIST_DIR)
	rm -rf $(WIN_STAGING)
	# ── Build the .love zip ──
	mkdir -p $(STAGING_DIR)/lua/audio/modules $(STAGING_DIR)/lua/themes $(STAGING_DIR)/lua/effects $(STAGING_DIR)/love
	cp $(STORYBOOK_LOVE)/bundle.js $(STAGING_DIR)/love/
	cp packaging/storybook/main.lua $(STAGING_DIR)/
	cp packaging/storybook/conf.lua $(STAGING_DIR)/
	cp lua/*.lua $(STAGING_DIR)/lua/
	cp lua/audio/*.lua $(STAGING_DIR)/lua/audio/
	cp lua/audio/modules/*.lua $(STAGING_DIR)/lua/audio/modules/
	cp lua/themes/*.lua $(STAGING_DIR)/lua/themes/
	cp lua/effects/*.lua $(STAGING_DIR)/lua/effects/
	cd $(STAGING_DIR) && zip -9 -r /tmp/reactjit-demo.love .
	rm -rf $(STAGING_DIR)
	# ── Assemble payload zip: fused love.exe + DLLs + libquickjs.dll + mpv-2.dll ──
	mkdir -p $(WIN_STAGING)/lib
	cat $(LOVE_WIN_DIR)/love.exe /tmp/reactjit-demo.love > $(WIN_STAGING)/reactjit-demo.exe
	cp $(LOVE_WIN_DIR)/*.dll $(WIN_STAGING)/
	cp zig-out-win/bin/quickjs.dll $(WIN_STAGING)/lib/libquickjs.dll
	cp vendor/mpv-win64/mpv-2.dll $(WIN_STAGING)/
	cd $(WIN_STAGING) && zip -9 -r /tmp/reactjit-payload.zip .
	rm -rf $(WIN_STAGING) /tmp/reactjit-demo.love
	# ── Concatenate: launcher.exe + payload.zip + 8-byte offset footer ──
	rm -f $(DIST_DIR)/reactjit-demo.exe
	cat zig-out/bin/ilr-launcher.exe /tmp/reactjit-payload.zip > $(DIST_DIR)/reactjit-demo.exe
	python3 -c "import sys,struct; sys.stdout.buffer.write(struct.pack('<Q', $$(wc -c < zig-out/bin/ilr-launcher.exe)))" >> $(DIST_DIR)/reactjit-demo.exe
	rm -f /tmp/reactjit-payload.zip
	@echo "=== Done: $(DIST_DIR)/reactjit-demo.exe ==="
	@echo "  Size: $$(du -h $(DIST_DIR)/reactjit-demo.exe | cut -f1)"
	@echo "  Single file — send reactjit-demo.exe, double-click to run"

# ── Run ─────────────────────────────────────────────────

run: build-native setup
	cd $(NATIVE_GAME) && love .

# ── Dev mode (watch + run) ──────────────────────────────

dev:
	npx esbuild \
		--bundle \
		--format=iife \
		--global-name=ReactJIT \
		--target=es2020 \
		--jsx=automatic \
		--outfile=$(NATIVE_GAME)/bundle.js \
		--watch \
		examples/native-hud/src/main.tsx

dev-storybook: setup $(STORYBOOK_LIB)/libquickjs.so node_modules
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
	@echo "=== Populating CLI runtime ==="
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
	mkdir -p cli/runtime/lua/effects
	cp lua/effects/*.lua cli/runtime/lua/effects/
	cp $(QUICKJS_DIR)/libquickjs.so cli/runtime/lib/
	@echo "  Compiling ft_helper.so (FreeType bridge for SDL2 target)..."
	@zig build ft-helper \
		&& cp zig-out/lib/libft_helper.so cli/runtime/lib/ft_helper.so \
		&& echo "  Bundled ft_helper.so" \
		|| echo "  Warning: ft_helper.so build failed — SDL2 target text rendering unavailable"
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
	@zig build blake3 \
		&& cp zig-out/lib/libblake3.so cli/runtime/lib/libblake3.so \
		&& echo "  Bundled libblake3.so (via zig)" \
		|| echo "  Warning: libblake3.so build failed — BLAKE3 hashing unavailable"
	@TOR=$$(which tor 2>/dev/null); \
	if [ -n "$$TOR" ]; then \
		cp "$$(readlink -f "$$TOR")" cli/runtime/bin/tor; \
		chmod +x cli/runtime/bin/tor; \
		echo "  Bundled tor"; \
	else \
		echo "  Warning: tor not found — .onion hosting won't be bundled"; \
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
	cp -r packages/game cli/runtime/reactjit/game
	cp -r packages/3d cli/runtime/reactjit/3d
	cp -r packages/controls cli/runtime/reactjit/controls
	cp -r packages/geo cli/runtime/reactjit/geo
	cp -r packages/theme cli/runtime/reactjit/theme
	mkdir -p cli/runtime/lua/themes
	cp lua/themes/*.lua cli/runtime/lua/themes/
	@if [ -d fonts ]; then \
		mkdir -p cli/runtime/fonts; \
		cp -r fonts/* cli/runtime/fonts/; \
		echo "  Bundled fonts ($$(du -sh fonts | cut -f1))"; \
	fi
	@if [ -d data ]; then \
		mkdir -p cli/runtime/data; \
		cp -r data/* cli/runtime/data/; \
		echo "  Bundled data ($$(du -sh data | cut -f1))"; \
	fi
	@echo "=== CLI runtime ready. Run: cd cli && npm link ==="

# ── Clean ───────────────────────────────────────────────

clean-demos:
	@./scripts/clean-dormant-demos.sh

dist-clean:
	rm -rf $(DIST_DIR)
	rm -rf $${XDG_CACHE_HOME:-$$HOME/.cache}/reactjit-demo

clean: dist-clean
	rm -f $(NATIVE_GAME)/bundle.js
	rm -f examples/web-overlay/dist/app.js
	rm -f storybook/dist/storybook.js
	rm -f $(STORYBOOK_LOVE)/bundle.js
	rm -rf $(LIB_DIR)
	rm -rf $(STORYBOOK_LIB)
	rm -rf node_modules
