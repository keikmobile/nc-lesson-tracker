// NativeCamp Lesson Tracker - Unit Tests
// 実行: node --test test.js  (Node.js 18+ 必須)

const { test } = require('node:test');
const assert = require('node:assert/strict');

// chrome API のスタブ（純粋関数のロードには不要だが background.js がリスナー登録するため必要）
global.chrome = {
  runtime: { onMessage: { addListener: () => {} } },
  storage: { local: { get: () => {}, set: () => {} } },
};

const { mergeRecords, generateMonths, parseHTML, sanityCheck } = require('./background.js');

// escapeHtml は popup.js がDOM依存のためここに直接定義してテスト
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// mergeRecords
// ============================================================
test('mergeRecords: 新規レコードを追加する', () => {
  const existing = [{ source: 'nativecamp', timestamp: '2025-01-01T09:00:00', lesson_type: 'A' }];
  const incoming = [{ source: 'nativecamp', timestamp: '2025-01-02T09:00:00', lesson_type: 'B' }];
  const result = mergeRecords(existing, incoming);
  assert.equal(result.length, 2);
});

test('mergeRecords: 同じ timestamp は重複除去され新規優先で上書きされる', () => {
  const existing = [{ source: 'nativecamp', timestamp: '2025-01-01T09:00:00', lesson_type: 'OLD' }];
  const incoming = [{ source: 'nativecamp', timestamp: '2025-01-01T09:00:00', lesson_type: 'NEW' }];
  const result = mergeRecords(existing, incoming);
  assert.equal(result.length, 1);
  assert.equal(result[0].lesson_type, 'NEW');
});

test('mergeRecords: source が違えば別レコードとして扱う', () => {
  const existing = [{ source: 'nativecamp', timestamp: '2025-01-01T09:00:00' }];
  const incoming = [{ source: 'dmm',        timestamp: '2025-01-01T09:00:00' }];
  const result = mergeRecords(existing, incoming);
  assert.equal(result.length, 2);
});

test('mergeRecords: timestamp 降順にソートされる', () => {
  const existing = [{ source: 'nativecamp', timestamp: '2025-01-01T09:00:00' }];
  const incoming = [{ source: 'nativecamp', timestamp: '2025-03-01T09:00:00' }];
  const result = mergeRecords(existing, incoming);
  assert.equal(result[0].timestamp, '2025-03-01T09:00:00');
});

test('mergeRecords: timestamp が null のレコードは無視される', () => {
  const existing = [];
  const incoming = [{ source: 'nativecamp', timestamp: null }];
  const result = mergeRecords(existing, incoming);
  assert.equal(result.length, 0);
});

// ============================================================
// generateMonths
// ============================================================
test('generateMonths: 同月を指定すると1件返る', () => {
  const result = generateMonths('202501');
  assert.ok(result.includes('202501'));
});

test('generateMonths: fromMonth から今月までの月を含む', () => {
  const result = generateMonths('202401');
  assert.ok(result.includes('202401'));
  assert.ok(result.includes('202501'));
});

test('generateMonths: YYYYMM 形式で返る', () => {
  const result = generateMonths('202501');
  assert.ok(result.every(m => /^\d{6}$/.test(m)));
});

// ============================================================
// parseHTML
// ============================================================

// NC レッスン履歴ページの li ブロックを模した最小 HTML
const SAMPLE_HTML = `
<ul>
<li>
  <div>
    <p>2025年01月15日 (水) 09:59</p>
    <a class="t_link" href="https://nativecamp.net/textbook/page-detail/1/10001">
      <span>デイリートピック</span>
      <span>ビジネス/経済</span>
      Ways to Stay Motivated at Work
    </a>
    <div attr-time-duration="26:00"></div>
    <p class="teacher-name">
      <a href="/teacher/1"><b>John</b> (ジョン)</a>
      <span class="country_name">フィリピン</span>
    </p>
  </div>
</li>
</ul>
`;

test('parseHTML: timestamp を正しくパースする', () => {
  const records = parseHTML(SAMPLE_HTML, '202501');
  assert.equal(records.length, 1);
  assert.equal(records[0].timestamp, '2025-01-15T09:59:00');
});

test('parseHTML: lesson_type を取得する', () => {
  const records = parseHTML(SAMPLE_HTML, '202501');
  assert.equal(records[0].lesson_type, 'デイリートピック');
});

test('parseHTML: level を取得する', () => {
  const records = parseHTML(SAMPLE_HTML, '202501');
  assert.equal(records[0].level, 'ビジネス/経済');
});

test('parseHTML: duration_min を取得する', () => {
  const records = parseHTML(SAMPLE_HTML, '202501');
  assert.equal(records[0].duration_min, 26);
});

test('parseHTML: teacher_en を取得する', () => {
  const records = parseHTML(SAMPLE_HTML, '202501');
  assert.equal(records[0].teacher_en, 'John');
});

test('parseHTML: teacher_country を取得する', () => {
  const records = parseHTML(SAMPLE_HTML, '202501');
  assert.equal(records[0].teacher_country, 'フィリピン');
});

test('parseHTML: source が nativecamp になる', () => {
  const records = parseHTML(SAMPLE_HTML, '202501');
  assert.equal(records[0].source, 'nativecamp');
});

test('parseHTML: 日時がなければレコードを返さない', () => {
  const html = '<li><div>no date here</div></li>';
  const records = parseHTML(html, '202501');
  assert.equal(records.length, 0);
});

// ============================================================
// sanityCheck
// ============================================================
test('sanityCheck: レコード0件で警告を返す', () => {
  const warnings = sanityCheck([], '202501');
  assert.ok(warnings.length > 0);
});

test('sanityCheck: 正常データでは警告なし', () => {
  const records = Array.from({ length: 10 }, (_, i) => ({
    timestamp: `2025-01-${String(i + 1).padStart(2, '0')}T09:00:00`,
    lesson_type: 'デイリートピック',
    duration_min: 25,
  }));
  const warnings = sanityCheck(records, '202501');
  assert.equal(warnings.length, 0);
});

test('sanityCheck: timestamp 欠損 >30% で警告', () => {
  const records = Array.from({ length: 10 }, (_, i) => ({
    timestamp: i < 4 ? null : `2025-01-${String(i + 1).padStart(2, '0')}T09:00:00`,
    lesson_type: 'デイリートピック',
    duration_min: 25,
  }));
  const warnings = sanityCheck(records, '202501');
  assert.ok(warnings.some(w => w.includes('timestamp')));
});

test('sanityCheck: duration 欠損 >50% で警告', () => {
  const records = Array.from({ length: 10 }, (_, i) => ({
    timestamp: `2025-01-${String(i + 1).padStart(2, '0')}T09:00:00`,
    lesson_type: 'デイリートピック',
    duration_min: i < 6 ? null : 25,
  }));
  const warnings = sanityCheck(records, '202501');
  assert.ok(warnings.some(w => w.includes('duration')));
});

// ============================================================
// escapeHtml
// ============================================================
test('escapeHtml: < > & " をエスケープする', () => {
  assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
});

test('escapeHtml: null / undefined は空文字を返す', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('escapeHtml: 通常の文字列はそのまま返す', () => {
  assert.equal(escapeHtml('John Smith'), 'John Smith');
});
