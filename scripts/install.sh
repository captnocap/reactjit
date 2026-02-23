#!/bin/sh
# ReactJIT installer — curl -fsSL https://reactjit.dev/install | sh
# Also: curl ... | sh -s -- full|light|storybook|source
set -e

REPO="captnocap/reactjit"
INSTALL_DIR="$HOME/.reactjit"
BIN_DIR="$INSTALL_DIR/bin"

# ── Colors (if terminal) ────────────────────────────────
if [ -t 1 ]; then
  BOLD="\033[1m"   DIM="\033[2m"   RESET="\033[0m"
  CYAN="\033[36m"  GREEN="\033[32m" RED="\033[31m"
else
  BOLD="" DIM="" RESET="" CYAN="" GREEN="" RED=""
fi

info()  { printf "${CYAN}${BOLD}%s${RESET}\n" "$1"; }
ok()    { printf "${GREEN}${BOLD}  %s${RESET}\n" "$1"; }
err()   { printf "${RED}${BOLD}  %s${RESET}\n" "$1" >&2; }
dim()   { printf "${DIM}  %s${RESET}\n" "$1"; }

# ── Detect platform ─────────────────────────────────────
detect_platform() {
  OS=$(uname -s)
  ARCH=$(uname -m)

  case "$OS" in
    Linux)  PLATFORM_OS="linux" ;;
    Darwin) PLATFORM_OS="macos" ;;
    MINGW*|MSYS*|CYGWIN*) PLATFORM_OS="windows" ;;
    *) err "Unsupported OS: $OS"; exit 1 ;;
  esac

  case "$ARCH" in
    x86_64|amd64)  PLATFORM_ARCH="x64" ;;
    aarch64|arm64) PLATFORM_ARCH="arm64" ;;
    *) err "Unsupported architecture: $ARCH"; exit 1 ;;
  esac

  PLATFORM="${PLATFORM_OS}-${PLATFORM_ARCH}"

  # Windows gets .exe suffix
  case "$PLATFORM_OS" in
    windows) EXE_EXT=".exe" ;;
    *)       EXE_EXT="" ;;
  esac
}

# ── Fetch latest release tag ────────────────────────────
fetch_latest_tag() {
  TAG=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"//;s/".*//')

  if [ -z "$TAG" ]; then
    err "Could not fetch latest release from GitHub."
    err "Check: https://github.com/${REPO}/releases"
    exit 1
  fi
}

# ── Download with progress ──────────────────────────────
download() {
  URL="$1"
  DEST="$2"

  if command -v wget >/dev/null 2>&1; then
    wget -q --show-progress -O "$DEST" "$URL"
  elif command -v curl >/dev/null 2>&1; then
    curl -fSL --progress-bar -o "$DEST" "$URL"
  else
    err "Need curl or wget to download."
    exit 1
  fi
}

# ── Tier picker ──────────────────────────────────────────
pick_tier() {
  # Accept argument for non-interactive use
  case "${1:-}" in
    full|1)      TIER="full"; return ;;
    light|2)     TIER="light"; return ;;
    storybook|3) TIER="storybook"; return ;;
    source|4)    TIER="source"; return ;;
  esac

  # Interactive menu
  printf "\n"
  info "ReactJIT"
  printf "\n"
  printf "  ${BOLD}[1]${RESET} Full (recommended) — CLI + Storybook + Node.js runtime\n"
  printf "  ${BOLD}[2]${RESET} Light — CLI + Storybook, bring your own Node.js\n"
  printf "  ${BOLD}[3]${RESET} Storybook — just the app, nothing else\n"
  printf "  ${BOLD}[4]${RESET} Storybook + Source — app + clone the repo\n"
  printf "\n"
  printf "  Select ${DIM}[1]${RESET}: "
  read -r CHOICE

  case "${CHOICE:-1}" in
    1|"") TIER="full" ;;
    2)    TIER="light" ;;
    3)    TIER="storybook" ;;
    4)    TIER="source" ;;
    *)    err "Invalid selection"; exit 1 ;;
  esac
}

# ── PATH setup ───────────────────────────────────────────
prompt_path() {
  printf "\n  Add reactjit to PATH? ${DIM}[Y/n]${RESET}: "
  read -r ANSWER

  case "${ANSWER:-Y}" in
    [Yy]|"")
      # Find the right shell config
      SHELL_NAME=$(basename "$SHELL" 2>/dev/null || echo "bash")
      case "$SHELL_NAME" in
        zsh)  RC="$HOME/.zshrc" ;;
        bash) RC="$HOME/.bashrc" ;;
        fish) RC="$HOME/.config/fish/config.fish" ;;
        *)    RC="$HOME/.profile" ;;
      esac

      EXPORT_LINE="export PATH=\"${BIN_DIR}:\$PATH\""

      if [ "$SHELL_NAME" = "fish" ]; then
        EXPORT_LINE="set -gx PATH ${BIN_DIR} \$PATH"
      fi

      # Don't duplicate
      if ! grep -qF "$BIN_DIR" "$RC" 2>/dev/null; then
        printf "\n# ReactJIT\n%s\n" "$EXPORT_LINE" >> "$RC"
        ok "Added to PATH in $RC"
      else
        dim "Already in PATH ($RC)"
      fi

      ok "Run: source $RC  (or open a new terminal)"
      ;;
    *)
      dim "Skipped. Add ${BIN_DIR} to PATH manually."
      ;;
  esac
}

# ── Install full/light tier ──────────────────────────────
install_cli() {
  ARTIFACT="reactjit-${TIER}-${PLATFORM}${EXE_EXT}"
  URL="https://github.com/${REPO}/releases/download/${TAG}/${ARTIFACT}"

  printf "\n"
  dim "Installing ${TIER} for ${PLATFORM}..."
  dim "${URL}"
  printf "\n"

  mkdir -p "$BIN_DIR"
  DEST="${BIN_DIR}/reactjit${EXE_EXT}"

  download "$URL" "$DEST"
  chmod +x "$DEST"

  printf "\n"
  ok "Installed to ${DEST}"

  prompt_path

  printf "\n"
  ok "Done. Run: reactjit storybook"
  printf "\n"
}

# ── Install storybook only ───────────────────────────────
install_storybook() {
  ARTIFACT="reactjit-storybook-${PLATFORM}${EXE_EXT}"
  URL="https://github.com/${REPO}/releases/download/${TAG}/${ARTIFACT}"
  DEST="./reactjit-storybook${EXE_EXT}"

  printf "\n"
  dim "Downloading storybook for ${PLATFORM}..."
  dim "${URL}"
  printf "\n"

  download "$URL" "$DEST"
  chmod +x "$DEST"

  printf "\n"
  ok "Downloaded: ${DEST}"
  ok "Run: ./${DEST}"
  printf "\n"
}

# ── Install storybook + source ───────────────────────────
install_source() {
  # Download storybook binary first
  install_storybook

  printf "\n"
  dim "Cloning source..."

  if command -v git >/dev/null 2>&1; then
    git clone "https://github.com/${REPO}.git" reactjit
    ok "Source: ./reactjit/"
    ok "Storybook: ./reactjit-storybook${EXE_EXT}"
  else
    err "git not found — skipping source clone."
    dim "Install git and run: git clone https://github.com/${REPO}.git"
  fi

  printf "\n"
}

# ── Main ─────────────────────────────────────────────────
main() {
  detect_platform
  pick_tier "$@"
  fetch_latest_tag

  case "$TIER" in
    full|light) install_cli ;;
    storybook)  install_storybook ;;
    source)     install_source ;;
  esac
}

main "$@"
