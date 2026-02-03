declare module "detect-terminal" {
  export default function detectTerminal(options?: { preferOuter?: boolean }): string | null
}
