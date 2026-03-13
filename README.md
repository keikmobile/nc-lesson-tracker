# NativeCamp Lesson Tracker

ネイティブキャンプのレッスン履歴を収集・分析する Chrome 拡張機能。

## 概要

ネイティブキャンプのレッスン履歴ページ（`/lesson-history`）をスクレイピングし、受講データをローカルに保存・分析する。外部サービスへのデータ送信は一切行わない。

## インストール

1. このリポジトリをクローンまたは ZIP でダウンロード
2. Chrome のアドレスバーに `chrome://extensions` を入力
3. 右上の「デベロッパーモード」をオン
4. 「パッケージ化されていない拡張機能を読み込む」→ `nc-tracker` フォルダを選択

**前提**: ネイティブキャンプにログイン済みであること。

---

## 機能

### 取得タブ

| 項目 | 内容 |
|------|------|
| 取得開始月 | デフォルトは今月。カレンダーで任意の月に変更可能 |
| 履歴を取得 | 指定月から今月まで全ページを順番にスクレイピング |
| JSONインポート | 既存の JSON ファイルを読み込んでストレージにマージ |

**マージ仕様**: スクレイプとインポートどちらも `timestamp` をキーに重複除去。同じ `timestamp` が既存にある場合は新しいデータで上書きする（フィールド追加時の再取得に対応）。

### 分析タブ

| 項目 | 内容 |
|------|------|
| 総レッスン数 | 全レコード件数 |
| 月平均レッスン数 | 総件数 ÷ 受講月数 |
| 受講月数 | データがある月の数 |
| 累計受講時間 | `duration_min` がある全レコードの合計（例: `399h 22m`） |
| 平均レッスン時間 | `duration_min` がある全レコードの平均（分） |
| コース別 / トピック TOP15 / レベル別 | 棒グラフ |
| 時間帯別 | 朝（5〜11時）/ 昼（11〜17時）/ 夜（17〜5時）の件数・割合 |

> `duration_min` は再スクレイプで取得されるフィールド。インポートした既存 JSON に含まれない場合は `—` 表示。

### 履歴タブ

- 全レコードを `timestamp` 降順で一覧表示
- **JSONエクスポート**: `nativecamp-history-YYYY-MM-DD.json` として保存
- **消去**: ストレージの全データを削除

---

## データ仕様

### レコード構造

```json
{
  "timestamp":       "2025-01-15T09:59:00",
  "course":          "デイリートピック",
  "level":           "ビジネス/経済",
  "topic":           "11496:Ways to Stay Motivated at Work",
  "textbook_url":    "https://nativecamp.net/textbook/page-detail/1/10001",
  "duration_min":    26,
  "teacher_name_en": "Teacher Name",
  "teacher_name_ja": "講師名",
  "teacher_country": "南アフリカ",
  "month":           "202501"
}
```

| フィールド | 型 | 内容 |
|---|---|---|
| `timestamp` | string (ISO 8601) | 受講日時 |
| `course` | string \| null | コース名（例: デイリーニュース） |
| `level` | string \| null | レベルまたはカテゴリ（例: 健康） |
| `topic` | string \| null | トピック名（ID付きの場合あり） |
| `textbook_url` | string \| null | 教材の URL |
| `duration_min` | number \| null | 受講時間（分） |
| `teacher_name_en` | string \| null | 講師名（英語） |
| `teacher_name_ja` | string \| null | 講師名（日本語） |
| `teacher_country` | string \| null | 講師の国籍 |
| `month` | string (YYYYMM) | 受講月 |

### ストレージ

`chrome.storage.local` に以下のキーで保存。

| キー | 内容 |
|------|------|
| `nc_history` | レコードの配列（`timestamp` 降順） |
| `nc_last_scraped` | 最終取得日時（ISO 8601） |

---

## スクレイピング仕様

### 対象 URL

```
https://nativecamp.net/lesson-history/page:N?month=YYYYMM
```

- `page:1` から開始し、次ページリンクの有無でページネーションを判定
- 月間 400ms、ページ間 300ms のウェイトを挟む

### パーサーが依存している HTML 構造

| 取得内容 | 依存パターン |
|----------|-------------|
| 日時 | `2025年01月15日 (水) 09:59` 形式のテキスト |
| 教材情報 | `<a class="t_link" href="...">` の中の `<span>` |
| 受講時間 | `attr-time-duration="26:00"` 属性 |
| 講師名 | `<p class="teacher-name">` 内の `<b>` タグ（英語）とそのテキスト（日本語） |
| 講師の国籍 | `<span class="country_name">` のテキスト |

---

## 仕様変化検知（sanityCheck）

取得完了後に各月のレコードを自動チェックし、NC 側の HTML 構造変化を検知する。問題があればポップアップに **⚠️ 警告** として表示する。

| チェック条件 | 閾値 | 意味 |
|---|---|---|
| レコード件数が 0 | — | HTML 構造変化またはログイン切れ |
| `timestamp` 取得失敗 | 30% 超 | 日時フォーマット変化の可能性 |
| `course` 取得失敗 | 50% 超 | 教材リンク構造変化の可能性 |
| `duration_min` 取得失敗 | 50% 超 | 受講時間属性変化の可能性 |

### 警告が出たときの対処

1. ログイン状態を確認（件数 0 の場合）
2. ネイティブキャンプのレッスン履歴ページを「名前を付けて保存」で手元に保存
3. そのファイルを AI に渡して `parseHTML` 関数を書き直す

---

## ファイル構成

```
nc-tracker/
├── manifest.json    # 拡張機能設定（Manifest V3）
├── background.js    # Service Worker（スクレイピング・データ管理）
├── popup.html       # ポップアップ UI
├── popup.js         # ポップアップのロジック
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### パーミッション

| パーミッション | 用途 |
|---|---|
| `storage` | レッスン履歴の保存 |
| `host_permissions: nativecamp.net/*` | レッスン履歴ページへのアクセス |

---

## 注意事項

- **個人利用のみ**を想定。スクレイピングの過度な実行は避けること
- データはすべてローカルの `chrome.storage.local` に保存。外部送信なし
- ネイティブキャンプ側の HTML 構造が変わるとパーサーが壊れる可能性がある（sanityCheck で検知）
