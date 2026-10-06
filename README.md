# claude-code-plugins

[日本語](README.ja.md)

aromarious's plugin marketplace for Claude Code.

## Install

```
/plugin marketplace add aromarious/claude-code-plugins
/plugin install <plugin>@aromarious
```

## Plugins

| Plugin | Description |
|---|---|
| [todo-pane](plugins/todo-pane/) | Keeps Claude's current task list in a pane next to the conversation |

## Branches and publishing

- There is only one branch, `main`, and `main` is the stable version.
- Changes are made on a feature branch, and a pull request is opened and merged into `main`. The repository is public, so feature branches and pull requests are public too.
- A plugin that is still in progress is not listed in `.claude-plugin/marketplace.json`. Leaving it out keeps it off the install list, but anyone can read the files under `plugins/` on GitHub.
- To try a plugin locally, load it directly with `claude --plugin-dir ./plugins/<plugin>`, or add this directory as a local-path marketplace with `/plugin marketplace add`.

## When releasing a beta

When a beta is needed, create a `beta` branch and have testers register with `#beta`.

```
/plugin marketplace add aromarious/claude-code-plugins#beta
```

- The marketplace name is `aromarious`, the same as on `main`, so the stable and beta versions cannot be registered at the same time. You pick one.
- To go back to the stable version, remove the marketplace, register it again without `#beta`, and reinstall the plugin.

  ```
  /plugin marketplace remove aromarious
  /plugin marketplace add aromarious/claude-code-plugins
  /plugin install <plugin>@aromarious
  ```

  - Removing the marketplace also uninstalls the plugins installed from it, which is why a reinstall is needed. The plugin's settings and saved data (`~/.claude/plugins/data/<id>/`) are deleted as well.
  - After reinstalling, the `main` version is installed even if the beta has a larger version number.
  - Running only `add` without `#beta` and without removing first leaves the registration on `beta`.

- To make both usable at once, prepare a second marketplace with a different name and point each plugin entry's `ref` at a different branch ([Run release channels](https://code.claude.com/docs/en/plugins/host-marketplace#run-release-channels)).

## License

MIT ([LICENSE](LICENSE))
