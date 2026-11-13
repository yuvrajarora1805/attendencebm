#!/bin/bash
# AttendPro ERP - Linux Launcher Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUNDLE_BIN="$SCRIPT_DIR/build/linux/x64/release/bundle/attendpro"

# If binary is not built yet, build it first
if [ ! -f "$BUNDLE_BIN" ]; then
    echo "AttendPro binary not found. Compiling release build..."
    if [ -f "$HOME/develop/flutter/bin/flutter" ]; then
        export PATH="$HOME/develop/flutter/bin:$PATH"
    fi
    cd "$SCRIPT_DIR" && flutter build linux --release
fi

if [ -f "$BUNDLE_BIN" ]; then
    echo "Launching AttendPro ERP..."
    "$BUNDLE_BIN" "$@"
else
    echo "Error: Failed to build or find $BUNDLE_BIN"
    exit 1
fi

