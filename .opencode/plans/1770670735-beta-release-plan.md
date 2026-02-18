# Beta Release Plan: Icon Support Feature

## Current State
- **Local version**: 0.1.15 + icon feature
- **npm latest**: 0.1.15
- **npm beta**: 0.1.17 (user doesn't want this code)
- **Goal**: Publish current code as beta for testing, then to latest

---

## Release Strategy

### Phase 1: Beta Release (Testing)

#### Step 1: Update package.json

**File**: `package.json`

**Changes**:
1. Update version from "0.1.15" to "0.1.18-beta.0"
2. Add "logos" to files array so icons are included in npm package

**Current files array (line 18-21)**:
```json
"files": [
  "dist",
  "sounds"
]
```

**Update to**:
```json
"files": [
  "dist",
  "sounds",
  "logos"
]
```

**Version update (line 3)**:
```json
"version": "0.1.18-beta.0"
```

#### Step 2: Build the project

```bash
bun run build
bun run typecheck
```

**Verify**:
- dist/index.js is created
- No TypeScript errors
- Logos folder exists with icon files

#### Step 3: Publish to npm with beta tag

```bash
npm publish --tag beta
```

**What this does**:
- Publishes version 0.1.18-beta.0 to npm
- Tags it as "beta" (not "latest")
- Users can install with: `npm install @mohak34/opencode-notifier@beta`

#### Step 4: Test the beta

**In opencode.json**:
```json
{
  "plugin": ["@mohak34/opencode-notifier@beta"]
}
```

**Clear cache and restart**:
```bash
rm -rf ~/.cache/opencode/node_modules/@mohak34/opencode-notifier
```

**Test scenarios**:
1. Notification with icon displays correctly
2. Notification without logos folder still works (graceful degradation)
3. Works on all platforms (macOS, Linux, Windows)

---

### Phase 2: Production Release

If beta testing succeeds:

#### Step 5: Update to stable version

**File**: `package.json`

**Change version (line 3)**:
```json
"version": "0.1.18"
```

#### Step 6: Build and publish to latest

```bash
bun run build
npm publish
```

**What this does**:
- Publishes version 0.1.18 to npm
- Automatically tags it as "latest"
- Becomes the default version for new installs

---

## Commands Summary

### Beta Release:
```bash
# 1. Update package.json version to 0.1.18-beta.0
# 2. Add "logos" to files array
# 3. Build
bun run build
bun run typecheck

# 4. Publish beta
npm publish --tag beta
```

### Test Beta:
```bash
# Clear cache
rm -rf ~/.cache/opencode/node_modules/@mohak34/opencode-notifier

# Update opencode.json to use @beta
# Restart OpenCode
```

### Production Release:
```bash
# 1. Update package.json version to 0.1.18
# 2. Build
bun run build

# 3. Publish latest
npm publish
```

---

## Verification Checklist

### Beta Testing:
- [ ] Beta package installs correctly
- [ ] Logos folder is present in node_modules
- [ ] Notifications display with OpenCode icon
- [ ] Notifications work without icon if logos missing
- [ ] All platforms tested (macOS/Linux/Windows)

### Production:
- [ ] Version 0.1.18 published
- [ ] Tagged as "latest" in npm
- [ ] Users get new version by default

---

## Notes

- **Version numbering**: Using 0.1.18 because 0.1.16 and 0.1.17 already exist in npm history
- **Beta tag**: Using standard npm prerelease format (0.1.18-beta.0)
- **Files array**: Including "logos" ensures users automatically get the icon files
- **No breaking changes**: This is a backward-compatible feature addition

---

## Rollback Plan

If beta has issues:
1. Fix issues in code
2. Increment to 0.1.18-beta.1
3. Republish to beta
4. Retest

If need to remove beta:
```bash
npm unpublish @mohak34/opencode-notifier@0.1.18-beta.0
```
