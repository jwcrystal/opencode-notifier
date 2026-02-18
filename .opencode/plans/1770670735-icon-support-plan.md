# Implementation Plan: Issue #23 - Add Icon Support to Notifications

## Requirements
- Icons must be **optional** - notifications work without them
- **Graceful degradation** - if logo fails to display, notifications still show
- Use the logos in `/logos/` folder (opencode-logo-dark.png and opencode-logo-light.png)
- Minimal code changes

---

## Implementation Strategy

### Approach: Simple Icon Path Resolution with Try-Catch

Instead of adding complex configuration, we'll:
1. Create a simple function that attempts to resolve the icon path
2. Wrap icon usage in try-catch to ensure notifications always work
3. Check if icon file exists before passing it to the notifier
4. Return `undefined` if icon is not available (which node-notifier handles gracefully)

---

## Changes Required

### 1. src/config.ts

**Add import:**
```typescript
import { fileURLToPath } from "url"
```

**Add function at end of file:**
```typescript
export function getIconPath(): string | undefined {
  try {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const iconPath = join(__dirname, "..", "..", "logos", "opencode-logo-dark.png")
    
    if (existsSync(iconPath)) {
      return iconPath
    }
  } catch {
    // Ignore errors - notifications will work without icon
  }
  
  return undefined
}
```

---

### 2. src/notify.ts

**Update function signature (line 23):**
```typescript
export async function sendNotification(
  title: string,
  message: string,
  timeout: number,
  iconPath?: string
): Promise<void> {
```

**Update notification options (line 52):**
```typescript
const notificationOptions: any = {
  title: title,
  message: message,
  timeout: timeout,
  icon: iconPath,  // Will be undefined if not provided
}
```

**Note:** node-notifier handles `undefined` gracefully and shows notifications without an icon.

---

### 3. src/index.ts

**Update import (line 3):**
```typescript
import { loadConfig, isEventSoundEnabled, isEventNotificationEnabled, getMessage, getSoundPath, getIconPath } from "./config"
```

**Update notification call (line 28):**
```typescript
if (isEventNotificationEnabled(config, eventType)) {
  const title = getNotificationTitle(config, projectName)
  const iconPath = getIconPath()
  promises.push(sendNotification(title, message, config.timeout, iconPath))
}
```

---

## Error Handling Strategy

### Why This Approach Works:

1. **File existence check**: `existsSync()` prevents passing invalid paths
2. **Try-catch wrapper**: Any unexpected errors return `undefined`
3. **node-notifier behavior**: When `icon: undefined`, it shows notification without icon
4. **No configuration required**: Works out of the box
5. **Platform agnostic**: Works on macOS, Linux, Windows with or without icon support

### Edge Cases Handled:

- **Logo file missing**: Returns `undefined`, notification shows without icon
- **Permission denied**: Caught by try-catch, returns `undefined`
- **Invalid path**: Caught by try-catch, returns `undefined`
- **node-notifier doesn't support icons**: The library ignores unknown options gracefully

---

## Verification Steps

### Test 1: With Logo Present
1. Ensure `/logos/opencode-logo-dark.png` exists
2. Run the plugin
3. Trigger a notification
4. **Expected**: Notification displays WITH the OpenCode icon

### Test 2: Without Logo (Graceful Degradation)
1. Temporarily rename `/logos/` folder
2. Run the plugin
3. Trigger a notification
4. **Expected**: Notification displays WITHOUT icon (no errors)

### Test 3: Build Verification
```bash
bun run build
bun run typecheck
```

### Test 4: Cross-Platform
Test on:
- macOS - uses osascript, should show icon
- Linux - uses notify-send, should show icon (if supported)
- Windows - uses WindowsToaster, should show icon

---

## Files to Modify

1. **src/config.ts** - Add `getIconPath()` function and import
2. **src/notify.ts** - Add optional iconPath parameter
3. **src/index.ts** - Import and use getIconPath()

Total: 3 files, ~10 lines of code added

---

## Success Criteria

- [ ] Notifications work with logo present (show icon)
- [ ] Notifications work without logo present (no icon, no errors)
- [ ] Build completes without errors
- [ ] TypeScript type checking passes
- [ ] Works on all supported platforms (macOS, Linux, Windows)

---

## No README Updates Required

Since this is an optional feature that works automatically when logos are present, no configuration documentation is needed. Users who want icons just need to ensure the logos folder exists.
