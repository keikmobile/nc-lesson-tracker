# NativeCamp Lesson Tracker

Chrome extension to collect and analyze NativeCamp lesson history.
ネイティブキャンプのレッスン履歴を収集・分析する Chrome 拡張機能。

## Overview / 概要

Scrapes NativeCamp lesson history pages (`/lesson-history`), stores lesson data locally, and provides analytics. No data is sent to any external service.
ネイティブキャンプのレッスン履歴ページ（`/lesson-history`）をスクレイピングし、受講データをローカルに保存・分析する。外部サービスへのデータ送信は一切行わない。

## Installation / インストール

1. Clone this repository or download as ZIP / このリポジトリをクローンまたは ZIP でダウンロード
2. Open `chrome://extensions` in Chrome / Chrome のアドレスバーに `chrome://extensions` を入力
3. Enable Developer mode (top right) / 右上の「デベロッパーモード」をオン
4. Click "Load unpacked" → select this directory / 「パッケージ化されていない拡張機能を読み込む」→ このフォルダを選択

**Prerequisite / 前提**: Must be logged in to NativeCamp. / ネイティブキャンプにログイン済みであること。

---

## Features / 機能

### Fetch Tab / 取得タブ

| Item / 項目 | Description / 内容 |
|------|------|
| Start month / 取得開始月 | Defaults to current month. Change via calendar. / デフォルトは今月。カレンダーで任意の月に変更可能 |
| Fetch history / 履歴を取得 | Scrapes all pages from the specified month to current. / 指定月から今月まで全ページを順番にスクレイピング |
| JSON import / JSONインポート | Load an existing JSON file and merge into storage. / 既存の JSON ファイルを読み込んでストレージにマージ |
| JSON export / JSONエクスポート | Saves as `nativecamp-history-YYYY-MM-DD.json` |
| Clear / 消去 | Deletes all data from storage. / ストレージの全データを削除 |

**Merge behavior / マージ仕様**: Both scraping and import deduplicate by `timestamp`. If the same `timestamp` already exists, the new data overwrites it (supports re-scraping after field additions).
スクレイプとインポートどちらも `timestamp` をキーに重複除去。同じ `timestamp` が既存にある場合は新しいデータで上書きする（フィールド追加時の再取得に対応）。

### Analysis Tab / 分析タブ

| Item / 項目 | Description / 内容 |
|------|------|
| Total lessons / 総レッスン数 | Total record count / 全レコード件数 |
| Monthly average / 月平均レッスン数 | Total ÷ active months / 総件数 ÷ 受講月数 |
| Active months / 受講月数 | Number of months with data / データがある月の数 |
| Total study time / 累計受講時間 | Sum of all `duration_min` (e.g. `399h 22m`) / `duration_min` がある全レコードの合計 |
| Avg lesson time / 平均レッスン時間 | Average of all `duration_min` (minutes) / `duration_min` がある全レコードの平均（分） |
| Teacher TOP15 / 講師 TOP15 | Bar chart of top 15 teachers by lesson count / 受講回数上位15名の棒グラフ |
| Lesson type / レッスン種別 | Bar chart by lesson type / 種別ごとの受講回数棒グラフ |
| Teacher country / 講師の国 | Bar chart by teacher nationality / 国別の受講回数棒グラフ |
| Time of day / 時間帯別 | Morning (5–11) / Afternoon (11–17) / Evening (17–5) counts and percentages / 朝・昼・夜の件数・割合 |
| Monthly trend / 月別推移 | Bar chart of lesson count per month / 月ごとの受講回数バーチャート |
| Topic TOP15 *(NC only)* | Bar chart of top 15 topics / 上位15トピックの棒グラフ |
| Level *(NC only)* | Bar chart by level/category / レベル・カテゴリ別棒グラフ |

---

## Data Specification / データ仕様

### Record Structure / レコード構造

```json
{
  "timestamp":       "2025-01-15T09:59:00",
  "source":          "nativecamp",
  "lesson_type":     "デイリートピック",
  "level":           "ビジネス/経済",
  "topic":           "11496:Ways to Stay Motivated at Work",
  "textbook_url":    "https://nativecamp.net/textbook/page-detail/1/10001",
  "duration_min":    26,
  "teacher_en":      "Teacher Name",
  "teacher_ja":      "講師名",
  "teacher_country": "南アフリカ",
  "month":           "202501"
}
```

| Field / フィールド | Type / 型 | Description / 内容 |
|---|---|---|
| `timestamp` | string (ISO 8601) | Lesson datetime / 受講日時 |
| `source` | string | Data source, fixed `"nativecamp"` / データソース（固定値） |
| `lesson_type` | string \| null | Lesson type (e.g. デイリーニュース) / レッスンタイプ |
| `level` | string \| null | Level or category (e.g. 健康) / レベルまたはカテゴリ |
| `topic` | string \| null | Topic name, may include ID / トピック名（ID付きの場合あり） |
| `textbook_url` | string \| null | Textbook URL / 教材の URL |
| `duration_min` | number \| null | Lesson duration in minutes / 受講時間（分） |
| `teacher_en` | string \| null | Teacher name (English) / 講師名（英語） |
| `teacher_ja` | string \| null | Teacher name (Japanese) / 講師名（日本語） |
| `teacher_country` | string \| null | Teacher nationality / 講師の国籍 |
| `month` | string (YYYYMM) | Lesson month / 受講月 |

### Integration Field Compatibility / 統合時のフィールド互換性

When exchanging JSON with [dmm-lesson-tracker](https://github.com/keikmobile/dmm-lesson-tracker), the following fields are absent on the other side (`null` or omitted). / [dmm-lesson-tracker](https://github.com/keikmobile/dmm-lesson-tracker) と JSON をやりとりする場合、以下のフィールドは相手側に存在しない（`null` または省略）。

| Field / フィールド | DMM | NC |
|---|---|---|
| `teacher_url` | yes | no |
| `lesson_lang` | yes | no |
| `note_url` | yes | no |
| `level` | no | yes |
| `topic` | no | yes |
| `textbook_url` | no | yes |

Use the `source` field (`"dmm"` / `"nativecamp"`) to distinguish records. / `source` フィールド（`"dmm"` / `"nativecamp"`）でレコードを判別できる。

### Storage / ストレージ

Saved in `chrome.storage.local` with the following keys. / `chrome.storage.local` に以下のキーで保存。

| Key / キー | Description / 内容 |
|------|------|
| `nc_history` | Array of records sorted by `timestamp` descending / レコードの配列（`timestamp` 降順） |
| `nc_last_scraped` | Last scrape datetime (ISO 8601) / 最終取得日時（ISO 8601） |

---

## Scraping Specification / スクレイピング仕様

### Target URL / 対象 URL

```
https://nativecamp.net/lesson-history/page:N?month=YYYYMM
```

- Starts from `page:1`; pagination determined by presence of next-page link. / `page:1` から開始し、次ページリンクの有無でページネーションを判定
- 400ms delay between months, 300ms between pages. / 月間 400ms、ページ間 300ms のウェイトを挟む

### HTML Patterns the Parser Depends On / パーサーが依存している HTML 構造

| Data / 取得内容 | Pattern / 依存パターン |
|----------|-------------|
| Datetime / 日時 | Text in `2025年01月15日 (水) 09:59` format |
| Lesson info / 教材情報 | `<span>` inside `<a class="t_link" href="...">` |
| Duration / 受講時間 | `attr-time-duration="26:00"` attribute |
| Teacher name / 講師名 | `<b>` (English) and text node (Japanese) inside `<p class="teacher-name">` — boundary is `</a>`, not `<br>` |
| Teacher nationality / 講師の国籍 | Text of `<span class="country_name">` |

---

## Sanity Check / 仕様変化検知

Automatically checks each month's records after scraping and warns if NativeCamp's HTML structure may have changed. Warnings appear as **⚠️** in the popup.
取得完了後に各月のレコードを自動チェックし、NC 側の HTML 構造変化を検知する。問題があればポップアップに **⚠️ 警告** として表示する。

| Condition / チェック条件 | Threshold / 閾値 | Meaning / 意味 |
|---|---|---|
| 0 records / レコード件数が 0 | — | HTML structure change or not logged in / HTML 構造変化またはログイン切れ |
| `timestamp` failures | >30% | Date format may have changed / 日時フォーマット変化の可能性 |
| `lesson_type` failures | >50% | Lesson link structure may have changed / 教材リンク構造変化の可能性 |
| `duration_min` failures | >50% | Duration attribute may have changed / 受講時間属性変化の可能性 |

### When warnings appear / 警告が出たときの対処

1. Check login status (if 0 records) / ログイン状態を確認（件数 0 の場合）
2. Save the NativeCamp lesson history page locally ("Save As") / ネイティブキャンプのレッスン履歴ページを「名前を付けて保存」で手元に保存
3. Pass the file to an AI to rewrite the `parseHTML` function / そのファイルを AI に渡して `parseHTML` 関数を書き直す

---

## File Structure / ファイル構成

```
nc-tracker/
├── manifest.json    # Extension config (Manifest V3) / 拡張機能設定
├── background.js    # Service Worker (scraping & data management) / スクレイピング・データ管理
├── popup.html       # Popup UI / ポップアップ UI
├── popup.js         # Popup logic / ポップアップのロジック
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Permissions / パーミッション

| Permission / パーミッション | Purpose / 用途 |
|---|---|
| `storage` | Store lesson history / レッスン履歴の保存 |
| `host_permissions: nativecamp.net/lesson-history/*` | Access lesson history pages only / レッスン履歴ページのみにアクセスを限定 |

### Security / セキュリティ

| Measure / 対策 | Detail / 内容 |
|---|---|
| Minimal permissions / 最小権限 | `host_permissions` is scoped to `/lesson-history/*` only — no broader site access. / `host_permissions` をレッスン履歴ページのみに限定し、ドメイン全体へのアクセスを防ぐ |
| Content Security Policy | `script-src 'self'; object-src 'self'` — blocks inline scripts and external script loading. / インラインスクリプトと外部スクリプトの読み込みを禁止する |
| XSS mitigation / XSS 対策 | All scraped data (teacher names, lesson types, topics, etc.) is HTML-escaped via `escapeHtml()` before being inserted into `innerHTML`. / スクレイプデータ（講師名・レッスン種別・トピック等）はすべて `escapeHtml()` でエスケープしてから `innerHTML` に挿入する |
| No external transmission / 外部送信なし | All data stays in `chrome.storage.local`. Nothing leaves the browser. / すべてのデータは `chrome.storage.local` に留まり、外部への送信は一切行わない |

---

## Notes / 注意事項

- **Personal use only / 個人利用のみ** — avoid excessive scraping. / スクレイピングの過度な実行は避けること
- All data is stored locally in `chrome.storage.local`. No external transmission. / データはすべてローカルに保存。外部送信なし
- If NativeCamp changes their HTML structure, the parser may break (detected by sanityCheck). / ネイティブキャンプ側の HTML 構造が変わるとパーサーが壊れる可能性がある（sanityCheck で検知）
