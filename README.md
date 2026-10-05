# claude-code-plugins

aromarious の Claude Code 用 plugin marketplace。

## インストール

```
/plugin marketplace add aromarious/claude-code-plugins
/plugin install <plugin>@aromarious
```

## plugin 一覧

| plugin | 内容 |
|---|---|
| [todo-pane](plugins/todo-pane/) | Claude が今やっている作業のタスクリストを、会話の横のペインに表示しておく plugin |

## ブランチと公開の方針

- ブランチは `main` だけ。`main` が安定版
- 変更は feature ブランチで作り、PR を出して `main` にマージする。リポジトリは公開なので、feature ブランチと PR も公開される。
- 作りかけの plugin は `.claude-plugin/marketplace.json` に載せない。載せなければインストール一覧に出ないが、`plugins/` 以下のファイルは GitHub で誰でも読める。
- 手元で試すときは `claude --plugin-dir ./plugins/<plugin>` で直接読み込むか、このディレクトリをローカルパスで `/plugin marketplace add` する。

## ベータ版を出すとき

ベータ版が必要になったら `beta` ブランチを作り、試す人には `#beta` を付けて登録してもらう。

```
/plugin marketplace add aromarious/claude-code-plugins#beta
```

- marketplace の名前は `main` と同じ `aromarious` になるので、安定版とベータ版は同時に登録できない。どちらか一方を選ぶ形になる。
- 安定版に戻すときは、marketplace を削除してから `#beta` なしで登録し直し、plugin を入れ直す。

  ```
  /plugin marketplace remove aromarious
  /plugin marketplace add aromarious/claude-code-plugins
  /plugin install <plugin>@aromarious
  ```

  - marketplace を削除すると、そこから入れた plugin もアンインストールされる。そのため入れ直しが必要になる。plugin の設定と保存データ（`~/.claude/plugins/data/<id>/`）も消える。
  - 入れ直すと、ベータ版の方がバージョン番号が大きくても、`main` の版が入る。
  - 削除せずに `#beta` なしで `add` だけ実行しても、登録は `beta` のまま変わらない。

- 両方を同時に使えるようにしたくなったら、名前の違う marketplace をもう一つ用意し、各 plugin のエントリで `ref` に別のブランチを指定する（[Run release channels](https://code.claude.com/docs/en/plugins/host-marketplace#run-release-channels)）。

## ライセンス

MIT（[LICENSE](LICENSE)）
