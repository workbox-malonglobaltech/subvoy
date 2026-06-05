#!/bin/bash
# ============================================================
# Protect Files Hook
# Runs BEFORE Claude edits or writes any file.
# Exit code 2 = BLOCK the action and show the error message.
# Exit code 0 = ALLOW the action.
# ============================================================

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

# Files and patterns Claude should NEVER modify
PROTECTED_PATTERNS=(
  ".env"
  ".env.local"
  ".env.production"
  ".npmrc"
  ".gitconfig"
  "package-lock.json"
  "yarn.lock"
  "node_modules/"
  ".git/"
  "*.pem"
  "*.key"
  "*.p12"
  "*.cert"
)

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  # Use case-insensitive matching
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    echo "🔒 Security: Blocked attempt to modify protected file: $FILE_PATH" >&2
    echo "   Pattern matched: $pattern" >&2
    echo "   If this is intentional, modify the file manually." >&2
    exit 2
  fi
done

exit 0
