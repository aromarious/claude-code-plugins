export type NowText = string

declare module 'claude-code' {
  interface PluginState {
    'todo-pane': { text: NowText; pin: NowText; past: string; wrap: boolean; pinWrap: boolean; title: string | null | undefined }
  }
}
