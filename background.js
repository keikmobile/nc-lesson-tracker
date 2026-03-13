// NativeCamp Lesson Tracker - Background Service Worker

// ストレージ取得をPromise化
function storageGet(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

// timestamp キーで重複除去してマージ（既存 + 新規、新規優先）
function mergeRecords(existing, incoming) {
  const map = {};
  for (const r of existing) { if (r.timestamp) map[r.timestamp] = r; }
  for (const r of incoming) { if (r.timestamp) map[r.timestamp] = r; }
  return Object.values(map).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_SCRAPE') {
    scrapeAll(message.fromMonth || '202201').then(result => sendResponse(result));
    return true;
  }
  if (message.type === 'GET_HISTORY') {
    storageGet(['nc_history', 'nc_last_scraped']).then(sendResponse);
    return true;
  }
  if (message.type === 'CLEAR_HISTORY') {
    chrome.storage.local.set({ nc_history: [], nc_last_scraped: null }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }
  if (message.type === 'IMPORT_HISTORY') {
    const incoming = message.records || [];
    storageGet(['nc_history']).then(data => {
      const merged = mergeRecords(data.nc_history || [], incoming);
      const added = merged.length - (data.nc_history || []).length;
      chrome.storage.local.set({ nc_history: merged, nc_last_scraped: new Date().toISOString() }, () => {
        sendResponse({ ok: true, added, total: merged.length });
      });
    });
    return true;
  }
});

// 指定月のURLを生成（fromMonth 〜 今月）
function generateMonths(fromMonth) {
  const months = [];
  const y = parseInt(fromMonth.slice(0, 4));
  const m = parseInt(fromMonth.slice(4, 6));
  let cur = new Date(y, m - 1);
  const now = new Date();
  while (cur <= now) {
    const cy = cur.getFullYear();
    const cm = String(cur.getMonth() + 1).padStart(2, '0');
    months.push(`${cy}${cm}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

// 1月分の全ページを取得
// URL形式: /lesson-history/page:N?month=YYYYMM（page:1から統一）
async function fetchMonth(month) {
  const allRecords = [];
  let page = 1;

  while (true) {
    const url = `https://nativecamp.net/lesson-history/page:${page}?month=${month}`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) break;

    const html = await res.text();
    const records = parseHTML(html, month);
    if (records.length === 0) break;

    allRecords.push(...records);

    if (!html.includes(`/lesson-history/page:${page + 1}?month=${month}`)) break;

    page++;
    await new Promise(r => setTimeout(r, 300));
  }

  return allRecords;
}

// HTMLをパース
function parseHTML(html, month) {
  const records = [];
  const liBlocks = html.split(/(?=<li>)/);

  for (const block of liBlocks) {
    const dateMatch = block.match(/(\d{4})年(\d{2})月(\d{2})日\s*\([^)]+\)\s*(\d{2}:\d{2})/);
    if (!dateMatch) continue;

    const [, year, mon, day, time] = dateMatch;
    const timestamp = `${year}-${mon}-${day}T${time}:00`;

    const tlinkMatch = block.match(
      /<a class="t_link"[^>]*href="(https:\/\/nativecamp\.net\/textbook\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/
    );

    let course = null, level = null, topic = null, textbook_url = null;

    if (tlinkMatch) {
      textbook_url = tlinkMatch[1];
      const inner = tlinkMatch[2];
      const spans = [...inner.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)]
        .map(m => m[1].trim()).filter(Boolean);
      course = spans[0] || null;
      level  = spans[1] || null;
      const noSpan = inner.replace(/<span[^>]*>[\s\S]*?<\/span>/g, '');
      const topicRaw = noSpan.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      topic = topicRaw || null;
    }

    // 受講時間を取得 (attr-time-duration="26:00" 形式)
    const durationMatch = block.match(/attr-time-duration="(\d+:\d+)"/);
    const duration_min = durationMatch
      ? parseInt(durationMatch[1].split(':')[0])
      : null;

    // 講師名（英語・日本語）を取得
    const teacherMatch = block.match(/<p class="teacher-name">[\s\S]*?<b>([\s\S]*?)<\/b>([\s\S]*?)<br>/);
    const teacher_name_en = teacherMatch ? teacherMatch[1].trim() : null;
    const teacher_name_ja = teacherMatch ? teacherMatch[2].replace(/<[^>]+>/g, '').trim() : null;

    // 国籍を取得
    const countryMatch = block.match(/<span class="country_name">([\s\S]*?)<\/span>/);
    const teacher_country = countryMatch ? countryMatch[1].trim() : null;

    records.push({ timestamp, course, level, topic, textbook_url, duration_min, teacher_name_en, teacher_name_ja, teacher_country, month });
  }

  return records;
}

// 全月をスクレイプ（fromMonth以降）
async function scrapeAll(fromMonth) {
  const months = generateMonths(fromMonth);
  const allRecords = [];
  const allWarnings = [];
  let errors = 0;

  for (const month of months) {
    try {
      const records = await fetchMonth(month);
      allWarnings.push(...sanityCheck(records, month));
      allRecords.push(...records);
      await new Promise(r => setTimeout(r, 400));
    } catch (e) {
      errors++;
    }
  }

  const { nc_history: existing = [] } = await storageGet(['nc_history']);
  const merged = mergeRecords(existing, allRecords);
  await chrome.storage.local.set({ nc_history: merged, nc_last_scraped: new Date().toISOString() });

  return { total: allRecords.length, months: months.length, errors, warnings: allWarnings };
}

// 仕様変化検知（パーサーが壊れたことを検知する番犬）
function sanityCheck(records, month) {
  const warnings = [];

  if (records.length === 0) {
    warnings.push(`${month}: レコード0件 — HTML構造変化またはログイン切れの可能性`);
    return warnings;
  }

  const n = records.length;
  const checks = [
    [records.filter(r => !r.timestamp).length,           0.3, 'timestamp取得失敗', '日時フォーマット変化の可能性'],
    [records.filter(r => !r.course).length,               0.5, 'course取得失敗',    '教材リンク構造変化の可能性'],
    [records.filter(r => r.duration_min == null).length,  0.5, 'duration取得失敗',  '受講時間属性変化の可能性'],
  ];
  for (const [count, threshold, label, reason] of checks) {
    if (count > n * threshold) {
      warnings.push(`${month}: ${label} ${count}/${n}件 — ${reason}`);
    }
  }

  return warnings;
}
