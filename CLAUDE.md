# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
このファイルは、リポジトリ内のコードを扱う際の Claude Code 向けガイダンスです。

## Project Overview / プロジェクト概要

Chrome Extension (Manifest V3) that scrapes NativeCamp lesson history, stores it locally, and provides analytics. No build process, no npm dependencies — pure vanilla JavaScript.

ネイティブキャンプのレッスン履歴をスクレイピングし、ローカルに保存・分析する Chrome 拡張機能（Manifest V3）。ビルドプロセス・npm 依存なし — 純粋な Vanilla JavaScript。

## Development / 開発

**Load the extension in Chrome / Chrome への読み込み:**
1. Open `chrome://extensions/` / `chrome://extensions/` を開く
2. Enable Developer mode / デベロッパーモードをオン
3. Click "Load unpacked" → select this directory / 「パッケージ化されていない拡張機能を読み込む」→ このディレクトリを選択

**Run tests / テスト実行:**
```
node --test test.js
```
Requires Node.js 18+. No npm install needed. Tests cover pure functions in `background.js` (`mergeRecords`, `generateMonths`, `parseHTML`, `sanityCheck`) and `escapeHtml`.
Node.js 18+ 必須。npm install 不要。`background.js` の純粋関数と `escapeHtml` をカバーする。

**No build or lint commands** — there is no package.json or toolchain.
**ビルド・lint コマンドなし** — package.json やツールチェーンは存在しない。

## Architecture / アーキテクチャ

Single-page Chrome extension with three files:
3ファイル構成のシングルページ Chrome 拡張機能:

- **`background.js`** (Service Worker): Scrapes NativeCamp pages, parses HTML, deduplicates records, manages `chrome.storage.local`
  ネイティブキャンプのページをスクレイピングし、HTML をパース・重複除去して `chrome.storage.local` を管理する
- **`popup.html`** / **`popup.js`**: Two-tab UI (取得/分析) that communicates with the service worker via `chrome.runtime.sendMessage`
  2タブ UI（取得/分析）。`chrome.runtime.sendMessage` でサービスワーカーと通信する

**Data flow / データフロー:** Popup triggers scrape → background.js fetches `https://nativecamp.net/lesson-history/page:N?month=YYYYMM` → parses HTML → deduplicates by `timestamp` → stores in `chrome.storage.local`

## Data Model / データモデル

Storage keys in `chrome.storage.local` / `chrome.storage.local` のストレージキー:
- `nc_history`: Array of lesson records sorted by timestamp descending / レコードの配列（`timestamp` 降順）
- `nc_last_scraped`: ISO 8601 timestamp of last scrape / 最終スクレイプ日時（ISO 8601）

Record fields / レコードフィールド: `timestamp`, `source`, `lesson_type`, `level`, `topic`, `textbook_url`, `duration_min`, `teacher_en`, `teacher_ja`, `teacher_country`, `month` — all nullable except `timestamp` and `source` / `timestamp` と `source` 以外はすべて nullable。

## Key Constraints / 主要な制約

- **Parser fragility / パーサーの脆弱性**: Scraping depends on NativeCamp's HTML structure. background.js has sanity checks that warn when >30% of timestamps or >50% of lesson_type/duration fields are missing — this signals HTML structure changes.
  スクレイピングはネイティブキャンプの HTML 構造に依存する。timestamp が 30% 超・lesson_type や duration が 50% 超で取得失敗した場合は HTML 構造変化として警告する。
- **Merge strategy / マージ戦略**: `timestamp` is the deduplication key; new data overwrites existing records (supports both fresh scrapes and JSON imports).
  `timestamp` が重複除去キー。新データが既存レコードを上書き（再スクレイプとインポートの両方に対応）。
- **Scrape timing / スクレイプ間隔**: 400ms delay between months, 300ms between pages to avoid rate limiting.
  レート制限回避のため、月間 400ms・ページ間 300ms のウェイトを挟む。
- **No external transmission / 外部送信なし**: All data stays in chrome.storage.local.
  すべてのデータは chrome.storage.local に留まる。

## Field Design Policy / フィールド設計方針

Fields are intentionally aligned with a planned DMM Eikaiwa tracker for future data unification. The `source` field (`"nativecamp"`) will allow filtering when both datasets are merged.
フィールド名は将来のDMM英会話トラッカーとの統合を見据えて意図的に揃えてある。`source` フィールド（`"nativecamp"`）は統合後のフィルタリングに使う。

**Shared fields with DMM / DMMと共通のフィールド:** `source`, `lesson_type`, `teacher_en`, `teacher_ja`, `teacher_country`, `duration_min`, `month`

**NativeCamp-specific fields / NC固有フィールド:** `level`, `topic`, `textbook_url`

## Parser Notes / パーサーの注意点

- **`teacher_ja` boundary**: Must match up to `</a>`, not `<br>`. Using `<br>` as the boundary captures trailing tabs, newlines, country name, and other HTML content that follows.
  `teacher_ja` のマッチ境界は `<br>` ではなく `</a>` にすること。`<br>` にすると後続のタブ・改行・国名などを取り込んでしまう（実際に発生した問題）。
