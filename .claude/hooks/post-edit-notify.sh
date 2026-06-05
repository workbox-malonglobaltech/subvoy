#!/bin/bash
# ============================================================
# Post-Edit Notification Hook
# Runs AFTER Claude successfully edits or creates a file.
# Logs what was changed to .claude/edit-log.txt
# ============================================================

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

if [ -n "$FILE_PATH" ]; then
  echo "[$TIMESTAMP] Modified: $FILE_PATH" >> "$(dirname "$0")/../edit-log.txt"
fi

exit 0
