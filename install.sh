#!/bin/sh
# Better Remote Control (brc) — standalone installer
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/custardcream98/better-remote-control/main/install.sh | sh
#
# Installs the latest release to ~/.brc/ and adds it to PATH.

set -e

REPO="custardcream98/better-remote-control"
INSTALL_DIR="$HOME/.brc"
BIN_DIR="$INSTALL_DIR/bin"

# ── Detect platform ──────────────────────────────────────────────────

detect_platform() {
  OS="$(uname -s)"
  ARCH="$(uname -m)"

  case "$OS" in
    Darwin) PLATFORM="darwin" ;;
    Linux)  PLATFORM="linux" ;;
    MINGW*|MSYS*|CYGWIN*) PLATFORM="win32" ;;
    *)
      echo "Error: unsupported OS: $OS" >&2
      exit 1
      ;;
  esac

  case "$ARCH" in
    x86_64|amd64) ARCH="x64" ;;
    arm64|aarch64) ARCH="arm64" ;;
    *)
      echo "Error: unsupported architecture: $ARCH" >&2
      exit 1
      ;;
  esac

  # Linux arm64 is not yet supported
  if [ "$PLATFORM" = "linux" ] && [ "$ARCH" = "arm64" ]; then
    echo "Error: linux-arm64 is not yet supported" >&2
    exit 1
  fi

  echo "${PLATFORM}-${ARCH}"
}

# ── Fetch latest version tag ─────────────────────────────────────────

get_latest_version() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
      | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"//;s/".*//'
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "https://api.github.com/repos/$REPO/releases/latest" \
      | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"//;s/".*//'
  else
    echo "Error: curl or wget is required" >&2
    exit 1
  fi
}

# ── Download & extract ────────────────────────────────────────────────

download() {
  URL="$1"
  DEST="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$DEST" "$URL"
  else
    wget -qO "$DEST" "$URL"
  fi
}

# ── Main ──────────────────────────────────────────────────────────────

main() {
  TARGET="$(detect_platform)"
  echo "Detected platform: $TARGET"

  VERSION="$(get_latest_version)"
  if [ -z "$VERSION" ]; then
    echo "Error: could not determine latest version" >&2
    exit 1
  fi
  echo "Latest version: $VERSION"

  ARCHIVE_NAME="brc-${VERSION}-${TARGET}.tar.gz"
  DOWNLOAD_URL="https://github.com/$REPO/releases/download/$VERSION/$ARCHIVE_NAME"

  echo "Downloading $ARCHIVE_NAME..."

  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT

  download "$DOWNLOAD_URL" "$TMP_DIR/brc.tar.gz"

  echo "Installing to $INSTALL_DIR..."

  # Remove old installation
  rm -rf "$INSTALL_DIR"
  mkdir -p "$INSTALL_DIR"

  # Extract (strip the top-level directory)
  tar -xzf "$TMP_DIR/brc.tar.gz" -C "$INSTALL_DIR" --strip-components=1

  echo ""
  echo "✓ brc $VERSION installed to $INSTALL_DIR"
  echo ""

  # ── PATH setup ──────────────────────────────────────────────────

  case ":$PATH:" in
    *":$BIN_DIR:"*) ;; # Already in PATH
    *)
      echo "Add the following to your shell profile (~/.zshrc, ~/.bashrc, etc.):"
      echo ""
      echo "  export PATH=\"$BIN_DIR:\$PATH\""
      echo ""
      echo "Then restart your terminal, or run:"
      echo ""
      echo "  export PATH=\"$BIN_DIR:\$PATH\""
      echo ""
      ;;
  esac

  echo "Run 'brc' to start."
}

main
