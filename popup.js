// タブ切り替え
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`${tab.dataset.tab}-panel`).classList.add('active');
    if (tab.dataset.tab === 'analysis') renderAnalysis();
    if (tab.dataset.tab === 'history') renderHistory();
  });
});

// 今月を YYYYMM 形式で返す
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// 初期ロード：今月をデフォルトにセット
const _now = new Date();
document.getElementById('from-month').value =
  `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}`;

chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, (data) => {
  if (data.nc_last_scraped) {
    const d = new Date(data.nc_last_scraped);
    document.getElementById('last-scraped').textContent =
      `取得済: ${d.toLocaleDateString('ja-JP')}`;
    showMeta(data.nc_history || []);
  }
});

// スクレイプ開始
document.getElementById('btn-scrape').addEventListener('click', () => {
  const btn = document.getElementById('btn-scrape');
  const status = document.getElementById('scrape-status');
  btn.disabled = true;
  status.textContent = '⏳ 取得中... しばらくお待ちください（〜2分）';

  const input = document.getElementById('from-month').value || '';
  const fromMonth = input ? input.slice(0, 4) + input.slice(5, 7) : currentMonth();
  chrome.runtime.sendMessage({ type: 'START_SCRAPE', fromMonth }, (result) => {
    btn.disabled = false;
    if (result) {
      const hasWarn = result.warnings && result.warnings.length > 0;
      status.innerHTML = `✅ 完了: ${result.total}件取得（${result.months}ヶ月）`
        + (hasWarn ? ` <span style="color:#f59e0b;font-weight:600;">⚠️ ${result.warnings.length}件の警告</span>` : '');
      if (hasWarn) {
        const warnEl = document.getElementById('scrape-warnings');
        warnEl.style.display = 'block';
        warnEl.innerHTML = result.warnings.map(w =>
          `<div style="margin-bottom:4px;">⚠️ ${w}</div>`
        ).join('');
      }
      // scrapeAll後はストレージ再取得せずに件数を反映
      document.getElementById('last-scraped').textContent =
        `取得済: ${new Date().toLocaleDateString('ja-JP')}`;
      chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, (data) => showMeta(data.nc_history || []));
    } else {
      status.textContent = '❌ エラーが発生しました。ログイン状態を確認してください。';
    }
  });
});

function showMeta(history) {
  const meta = document.getElementById('meta-info');
  if (history.length === 0) { meta.style.display = 'none'; return; }
  meta.style.display = 'block';
  const months = [...new Set(history.map(r => r.month))].length;
  meta.innerHTML = `
    レッスン総数: <b>${history.length}件</b><br>
    記録期間: <b>${months}ヶ月</b>
  `;
}

// ---- 分析 ----
function renderAnalysis() {
  chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, (data) => {
    const history = data.nc_history || [];
    const el = document.getElementById('analysis-content');
    if (history.length === 0) {
      el.innerHTML = '<div class="empty">先に「取得」タブで履歴を取得してください。</div>';
      return;
    }
    el.innerHTML = buildAnalysisHTML(history);
  });
}

function buildAnalysisHTML(history) {
  // コース別集計
  const courseCount = {};
  const topicCount = {};
  const levelCount = {};
  const monthCount = {};

  for (const r of history) {
    if (r.course) courseCount[r.course] = (courseCount[r.course] || 0) + 1;
    if (r.topic)  topicCount[r.topic]  = (topicCount[r.topic]  || 0) + 1;
    if (r.level)  levelCount[r.level]  = (levelCount[r.level]  || 0) + 1;
    if (r.month)  monthCount[r.month]  = (monthCount[r.month]  || 0) + 1;
  }

  const topCourses = sortedTop(courseCount, 10);
  const topTopics  = sortedTop(topicCount, 15);
  const topLevels  = sortedTop(levelCount, 10);

  // アクティブ月数
  const activeMonths = Object.keys(monthCount).length;
  const avgPerMonth = (history.length / activeMonths).toFixed(1);

  // 最も多いコース
  const topCourse = topCourses[0]?.[0] || '—';

  // 合計時間・平均時間を計算
  const durations = history.map(r => r.duration_min).filter(d => d != null && d > 0);
  const totalMin = durations.reduce((a, b) => a + b, 0);
  const totalHours = Math.floor(totalMin / 60);
  const totalMinRem = totalMin % 60;
  const totalTimeStr = totalMin > 0
    ? (totalHours > 0 ? `${totalHours}h ${totalMinRem}m` : `${totalMinRem}m`)
    : '—';
  const avgMin = durations.length > 0 ? (totalMin / durations.length).toFixed(1) : '—';

  let html = `
    <div class="summary-grid">
      <div class="summary-card"><div class="num">${history.length}</div><div class="lbl">総レッスン数</div></div>
      <div class="summary-card"><div class="num">${avgPerMonth}</div><div class="lbl">月平均レッスン数</div></div>
    </div>
    <div class="summary-grid">
      <div class="summary-card"><div class="num">${activeMonths}</div><div class="lbl">受講月数</div></div>
      <div class="summary-card"><div class="num" style="font-size:18px">${totalTimeStr}</div><div class="lbl">累計受講時間</div></div>
    </div>
    <div class="summary-grid">
      <div class="summary-card"><div class="num" style="font-size:16px">${avgMin === '—' ? '—' : avgMin + 'm'}</div><div class="lbl">平均レッスン時間</div></div>
      <div class="summary-card" style="grid-column:${avgMin === '—' ? '2' : '2'}"><div class="lbl" style="margin-bottom:4px">最多コース</div><div style="font-size:11px;font-weight:600;color:#333">${topCourse}</div></div>
    </div>
  `;

  html += `<div class="section-title">コース別</div>` + barChart(topCourses);
  html += `<div class="section-title">トピック TOP15</div>` + barChart(topTopics);
  if (topLevels.length > 0) {
    html += `<div class="section-title">レベル別</div>` + barChart(topLevels);
  }

  // 時間帯別
  const timeZones = { '🌅 朝 (5〜11時)': 0, '☀️ 昼 (11〜17時)': 0, '🌙 夜 (17〜5時)': 0 };
  for (const r of history) {
    try {
      const h = parseInt(r.timestamp.slice(11, 13));
      if      (h >= 5  && h < 11) timeZones['🌅 朝 (5〜11時)']++;
      else if (h >= 11 && h < 17) timeZones['☀️ 昼 (11〜17時)']++;
      else                         timeZones['🌙 夜 (17〜5時)']++;
    } catch(e) {}
  }
  const tzTotal = Object.values(timeZones).reduce((a, b) => a + b, 0);
  const tzEntries = Object.entries(timeZones);
  const tzMax = Math.max(...tzEntries.map(([,v]) => v));

  html += `<div class="section-title">時間帯別</div>`;
  html += tzEntries.map(([label, count]) => {
    const pct = tzTotal > 0 ? (count / tzTotal * 100).toFixed(1) : '0.0';
    return `
      <div class="bar-row">
        <div class="bar-label">${label}</div>
        <div class="bar-wrap"><div class="bar-fill" style="width:${tzMax > 0 ? Math.round(count/tzMax*100) : 0}%"></div></div>
        <div class="bar-count" style="width:52px">${count} <span style="color:#bbb">${pct}%</span></div>
      </div>`;
  }).join('');

  return html;
}

function sortedTop(obj, n) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
}

function barChart(entries) {
  if (entries.length === 0) return '<div style="color:#bbb;font-size:11px;padding:4px">データなし</div>';
  const max = entries[0][1];
  return entries.map(([label, count]) => `
    <div class="bar-row">
      <div class="bar-label" title="${label}">${label}</div>
      <div class="bar-wrap"><div class="bar-fill" style="width:${Math.round(count/max*100)}%"></div></div>
      <div class="bar-count">${count}</div>
    </div>
  `).join('');
}

// ---- 履歴一覧 ----
function renderHistory() {
  chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, (data) => {
    const history = data.nc_history || [];
    document.getElementById('toolbar-count').textContent = `${history.length}件`;
    const el = document.getElementById('history-list');
    if (history.length === 0) {
      el.innerHTML = '<div class="empty" style="padding:30px;text-align:center;color:#aaa;">データなし</div>';
      return;
    }
    el.innerHTML = history.map(r => `
      <div class="h-item">
        <div class="h-title">${r.topic || r.course || '(不明)'}</div>
        <div class="h-meta">
          <span>${formatDate(r.timestamp)}</span>
          ${r.course ? `<span class="badge">${r.course}</span>` : ''}
          ${r.level  ? `<span class="badge">${r.level}</span>`  : ''}
        </div>
      </div>
    `).join('');
  });
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('ja-JP', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return iso; }
}

// インポート
document.getElementById('btn-import').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const status = document.getElementById('scrape-status');
  status.textContent = '⏳ 読み込み中...';

  const reader = new FileReader();
  reader.onload = (ev) => {
    let imported;
    try {
      imported = JSON.parse(ev.target.result);
    } catch {
      status.textContent = '❌ JSONの解析に失敗しました。';
      return;
    }

    // 配列でなければエラー
    if (!Array.isArray(imported)) {
      status.textContent = '❌ 有効なレッスン履歴JSONではありません。';
      return;
    }

    chrome.runtime.sendMessage({ type: 'IMPORT_HISTORY', records: imported }, (result) => {
      if (result && result.ok) {
        status.textContent = `✅ インポート完了: ${result.added}件追加 / ${result.total}件（合計）`;
        chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, (data) => {
          showMeta(data.nc_history || []);
          document.getElementById('last-scraped').textContent =
            `取得済: ${new Date().toLocaleDateString('ja-JP')}`;
        });
      } else {
        status.textContent = '❌ インポートに失敗しました。';
      }
    });
  };
  reader.readAsText(file);
  // ファイル選択をリセット（同じファイルを再度選べるように）
  e.target.value = '';
});

// エクスポート
document.getElementById('btn-export').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, (data) => {
    const history = data.nc_history || [];
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nativecamp-history-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
});

// 消去
document.getElementById('btn-clear').addEventListener('click', () => {
  if (confirm('履歴をすべて消去しますか？')) {
    chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' }, () => {
      renderHistory();
      document.getElementById('meta-info').style.display = 'none';
      document.getElementById('scrape-status').textContent = '';
      document.getElementById('last-scraped').textContent = '未取得';
    });
  }
});
