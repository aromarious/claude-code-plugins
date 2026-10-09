export type NowText = string

declare module 'claude-code' {
  interface PluginState {
    'todo-pane': { text: NowText; pin: NowText; wrap: boolean }
  }
}
