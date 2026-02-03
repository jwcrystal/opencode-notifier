import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { basename } from "path"
import { loadConfig, isEventSoundEnabled, isEventNotificationEnabled, getMessage, getSoundPath } from "./config"
import type { EventType, NotifierConfig } from "./config"
import detectTerminal from "detect-terminal"
import { execFile } from "child_process"
import { sendNotification } from "./notify"
import { playSound } from "./sound"
import { runCommand } from "./command"

const TERMINAL_PROCESS_NAMES: Record<string, string> = {
  ghostty: "Ghostty",
  kitty: "kitty",
  iterm: "iTerm2",
  iterm2: "iTerm2",
  wezterm: "WezTerm",
  alacritty: "Alacritty",
  terminal: "Terminal",
  apple_terminal: "Terminal",
  hyper: "Hyper",
  warp: "Warp",
  vscode: "Code",
  "vscode-insiders": "Code - Insiders",
}

function getNotificationTitle(config: NotifierConfig, projectName: string | null): string {
  if (config.showProjectName && projectName) {
    return `OpenCode (${projectName})`
  }
  return "OpenCode"
}

async function handleEvent(
  config: NotifierConfig,
  eventType: EventType,
  projectName: string | null,
  elapsedSeconds?: number | null
): Promise<void> {
  const promises: Promise<void>[] = []

  const message = getMessage(config, eventType)

  if (isEventNotificationEnabled(config, eventType)) {
    if (config.suppressWhenFocused) {
      const shouldSuppress = await isTerminalFocused()
      if (shouldSuppress) {
        return
      }
    }
    const title = getNotificationTitle(config, projectName)
    promises.push(sendNotification(title, message, config.timeout))
  }

  if (isEventSoundEnabled(config, eventType)) {
    const customSoundPath = getSoundPath(config, eventType)
    promises.push(playSound(eventType, customSoundPath))
  }

  const minDuration = config.command?.minDuration
  const shouldSkipCommand =
    typeof minDuration === "number" &&
    Number.isFinite(minDuration) &&
    minDuration > 0 &&
    typeof elapsedSeconds === "number" &&
    Number.isFinite(elapsedSeconds) &&
    elapsedSeconds < minDuration

  if (!shouldSkipCommand) {
    runCommand(config, eventType, message)
  }

  await Promise.allSettled(promises)
}

async function runExecCommand(command: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(command, args, (error, stdout) => {
      if (error) {
        resolve(null)
        return
      }
      resolve(stdout.trim())
    })
  })
}

async function runOsascript(script: string): Promise<string | null> {
  if (process.platform !== "darwin") return null
  return runExecCommand("osascript", ["-e", script])
}

async function getFrontmostAppMac(): Promise<string | null> {
  return runOsascript(
    'tell application "System Events" to get name of first application process whose frontmost is true'
  )
}

async function getFrontmostProcessWindows(): Promise<string | null> {
  if (process.platform !== "win32") return null

  const script = [
    "Add-Type @\"",
    "using System;",
    "using System.Runtime.InteropServices;",
    "public class Win32 {",
    "  [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow();",
    "  [DllImport(\"user32.dll\")] public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int processId);",
    "}",
    "\"@",
    "$hwnd = [Win32]::GetForegroundWindow()",
    "$pid = 0",
    "[Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null",
    "(Get-Process -Id $pid).ProcessName",
  ].join("\n")

  return runExecCommand("powershell", ["-NoProfile", "-Command", script])
}

function getTerminalProcessName(terminalName: string): string {
  return TERMINAL_PROCESS_NAMES[terminalName.toLowerCase()] ?? terminalName
}

function normalizeAppName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function matchesTerminal(frontmost: string, terminal: string): boolean {
  const frontNormalized = normalizeAppName(frontmost)
  const terminalNormalized = normalizeAppName(terminal)

  if (!frontNormalized || !terminalNormalized) return false
  return frontNormalized.includes(terminalNormalized) || terminalNormalized.includes(frontNormalized)
}

async function isTerminalFocused(): Promise<boolean> {
  const terminalName = detectTerminal({ preferOuter: true })
  if (!terminalName) return false

  if (process.platform === "darwin") {
    const frontmost = await getFrontmostAppMac()
    const processName = getTerminalProcessName(terminalName)
    return frontmost ? frontmost.toLowerCase() === processName.toLowerCase() : false
  }

  if (process.platform === "win32") {
    const frontmostProcess = await getFrontmostProcessWindows()
    return frontmostProcess ? matchesTerminal(frontmostProcess, terminalName) : false
  }

  if (process.platform === "linux") {
    return false
  }

  return false
}

function getSessionIDFromEvent(event: unknown): string | null {
  const sessionID = (event as any)?.properties?.sessionID
  if (typeof sessionID === "string" && sessionID.length > 0) {
    return sessionID
  }
  return null
}

async function getElapsedSinceLastPrompt(
  client: PluginInput["client"],
  sessionID: string
): Promise<number | null> {
  try {
    const response = await client.session.messages({ path: { id: sessionID } })
    const messages = response.data ?? []

    let lastUserMessageTime: number | null = null
    for (const msg of messages) {
      const info = msg.info
      if (info.role === "user" && typeof info.time?.created === "number") {
        if (lastUserMessageTime === null || info.time.created > lastUserMessageTime) {
          lastUserMessageTime = info.time.created
        }
      }
    }

    if (lastUserMessageTime !== null) {
      return (Date.now() - lastUserMessageTime) / 1000
    }
  } catch {
  }

  return null
}

async function isChildSession(
  client: PluginInput["client"],
  sessionID: string
): Promise<boolean> {
  try {
    const response = await client.session.get({ path: { id: sessionID } })
    const parentID = response.data?.parentID
    return !!parentID
  } catch {
    return false
  }
}

async function handleEventWithElapsedTime(
  client: PluginInput["client"],
  config: NotifierConfig,
  eventType: EventType,
  projectName: string | null,
  event: unknown
): Promise<void> {
  const minDuration = config.command?.minDuration
  const shouldLookupElapsed =
    !!config.command?.enabled &&
    typeof config.command?.path === "string" &&
    config.command.path.length > 0 &&
    typeof minDuration === "number" &&
    Number.isFinite(minDuration) &&
    minDuration > 0

  let elapsedSeconds: number | null = null
  if (shouldLookupElapsed) {
    const sessionID = getSessionIDFromEvent(event)
    if (sessionID) {
      elapsedSeconds = await getElapsedSinceLastPrompt(client, sessionID)
    }
  }

  await handleEvent(config, eventType, projectName, elapsedSeconds)
}

export const NotifierPlugin: Plugin = async ({ client, directory }) => {
  const config = loadConfig()
  const projectName = directory ? basename(directory) : null

  return {
    event: async ({ event }) => {
      if (event.type === "permission.updated") {
        await handleEventWithElapsedTime(client, config, "permission", projectName, event)
      }

      if ((event as any).type === "permission.asked") {
        await handleEventWithElapsedTime(client, config, "permission", projectName, event)
      }

      if (event.type === "session.idle") {
        const sessionID = getSessionIDFromEvent(event)
        if (sessionID) {
          const isChild = await isChildSession(client, sessionID)
          if (!isChild) {
            await handleEventWithElapsedTime(client, config, "complete", projectName, event)
          } else {
            await handleEventWithElapsedTime(client, config, "subagent_complete", projectName, event)
          }
        } else {
          await handleEventWithElapsedTime(client, config, "complete", projectName, event)
        }
      }

      if (event.type === "session.error") {
        await handleEventWithElapsedTime(client, config, "error", projectName, event)
      }
    },
    "permission.ask": async () => {
      await handleEvent(config, "permission", projectName, null)
    },
    "tool.execute.before": async (input) => {
      if (input.tool === "question") {
        await handleEvent(config, "question", projectName, null)
      }
    },
  }
}

export default NotifierPlugin
