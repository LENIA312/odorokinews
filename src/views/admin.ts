// 管理画面（/admin）。公開サイトのデザインとは切り離した、シンプルな監視用ダッシュボード。
// ページ自体は誰でも開けるが、中身のデータは ADMIN_TOKEN を知っている人だけが
// /api/admin/status・/api/admin/simulate を叩けるため閲覧できる。
// トークンはブラウザのlocalStorageにのみ保存され、サーバー側には保存しない。

export function adminDashboardPage(): string {
  return (
    "<!doctype html>\n" +
    '<html lang="ja">\n' +
    "<head>\n" +
    '<meta charset="utf-8" />\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1" />\n' +
    "<title>管理画面 | odorokinews</title>\n" +
    '<meta name="robots" content="noindex" />\n' +
    "<style>\n" +
    STYLE +
    "\n</style>\n" +
    "</head>\n" +
    "<body>\n" +
    HTML_BODY +
    "\n<script>\n" +
    SCRIPT +
    "\n</script>\n" +
    "</body>\n" +
    "</html>\n"
  );
}

const STYLE = [
  ":root { color-scheme: light dark; --bg:#0f1115; --panel:#1a1d24; --line:#2a2e38; --ink:#e8e8ea; --soft:#9a9fac; --accent:#5b8cff; --ok:#3ecf8e; --bad:#ff5d5d; --warn:#ffb84d; }",
  "* { box-sizing: border-box; }",
  "body { margin:0; background:var(--bg); color:var(--ink); font-family:'Hiragino Sans','Noto Sans JP',sans-serif; }",
  ".wrap { max-width: 960px; margin: 0 auto; padding: 1.5rem 1.2rem 4rem; }",
  "h1 { font-size: 1.3rem; margin: 0 0 0.2rem; }",
  ".sub { color: var(--soft); font-size: 0.8rem; margin-bottom: 1.4rem; }",
  ".panel { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 1rem 1.1rem; margin-bottom: 1rem; }",
  ".row { display:flex; gap:0.8rem; flex-wrap:wrap; align-items:center; }",
  "input[type=password], input[type=text] { background:#0c0e12; border:1px solid var(--line); color:var(--ink); padding:0.5rem 0.7rem; border-radius:6px; font-size:0.9rem; flex:1; min-width:200px; }",
  "button { background: var(--accent); color:#fff; border:none; padding:0.55rem 1rem; border-radius:6px; font-size:0.85rem; cursor:pointer; }",
  "button.secondary { background:#2a2e38; }",
  "button:disabled { opacity:0.5; cursor:default; }",
  ".stat-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px,1fr)); gap:0.8rem; }",
  ".stat { background:#0c0e12; border:1px solid var(--line); border-radius:6px; padding:0.7rem 0.8rem; }",
  ".stat .label { font-size:0.72rem; color:var(--soft); }",
  ".stat .value { font-size:1.15rem; margin-top:0.15rem; }",
  "table { width:100%; border-collapse:collapse; font-size:0.82rem; }",
  "th, td { text-align:left; padding:0.4rem 0.5rem; border-bottom:1px solid var(--line); }",
  "th { color:var(--soft); font-weight:600; }",
  ".badge { display:inline-block; padding:0.1rem 0.5rem; border-radius:999px; font-size:0.72rem; }",
  ".badge.success { background:rgba(62,207,142,0.15); color:var(--ok); }",
  ".badge.failed { background:rgba(255,93,93,0.15); color:var(--bad); }",
  ".badge.running { background:rgba(255,184,77,0.15); color:var(--warn); }",
  ".hidden { display:none; }",
  "#loginError, #actionMsg { font-size:0.82rem; margin-top:0.5rem; }",
  "#loginError { color: var(--bad); }",
  "#actionMsg { color: var(--soft); }",
  ".error-text { color: var(--bad); font-family: monospace; font-size:0.78rem; }",
  "a { color: var(--accent); }",
].join("\n");

const HTML_BODY = [
  '<div class="wrap">',
  "<h1>odorokinews 管理画面</h1>",
  '<div class="sub">世界の進行状況をリアルタイムに近い形で監視し、手動でニュース生成を行えます。</div>',

  '<div class="panel" id="loginPanel">',
  '<div class="row">',
  '<input type="password" id="tokenInput" placeholder="ADMIN_TOKEN を入力" autocomplete="off" />',
  '<button onclick="saveToken()">接続</button>',
  "</div>",
  '<div id="loginError"></div>',
  "</div>",

  '<div id="dashboard" class="hidden">',

  '<div class="panel">',
  '<div class="row" style="justify-content:space-between">',
  '<div class="row">',
  '<button onclick="runSimulation()" id="simulateBtn">今すぐニュースを生成</button>',
  '<button class="secondary" onclick="refresh()">今すぐ更新</button>',
  '<button class="secondary" onclick="logout()">ログアウト</button>',
  "</div>",
  '<div class="sub" id="lastUpdated" style="margin:0">-</div>',
  "</div>",
  '<div id="actionMsg"></div>',
  "</div>",

  '<div class="panel">',
  '<div class="stat-grid" id="statGrid"></div>',
  "</div>",

  '<div class="panel">',
  "<h3>直近の実行履歴</h3>",
  '<table><thead><tr><th>世界日</th><th>状態</th><th>AI呼び出し</th><th>開始</th><th>エラー</th></tr></thead><tbody id="runsBody"></tbody></table>',
  "</div>",

  '<div class="panel">',
  "<h3>最新ニュース</h3>",
  '<div id="newsList" class="sub">-</div>',
  "</div>",

  "</div>", // #dashboard
  "</div>", // .wrap
].join("\n");

// クライアント側スクリプト。テンプレートリテラルの混乱を避けるため
// バッククォートは使わず文字列結合のみで記述する。
const SCRIPT = [
  "var TOKEN_KEY = 'odorokinews_admin_token';",
  "",
  "function getToken() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }",
  "function setToken(v) { try { localStorage.setItem(TOKEN_KEY, v); } catch (e) {} }",
  "function clearToken() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} }",
  "",
  "function escapeHtml(s) {",
  "  return String(s == null ? '' : s)",
  "    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');",
  "}",
  "",
  "var pollTimer = null;",
  "",
  "function saveToken() {",
  "  var v = document.getElementById('tokenInput').value.trim();",
  "  if (!v) return;",
  "  setToken(v);",
  "  document.getElementById('loginError').textContent = '';",
  "  refresh();",
  "}",
  "",
  "function logout() {",
  "  clearToken();",
  "  if (pollTimer) clearInterval(pollTimer);",
  "  document.getElementById('dashboard').classList.add('hidden');",
  "  document.getElementById('loginPanel').classList.remove('hidden');",
  "}",
  "",
  "function fetchStatus() {",
  "  var token = getToken();",
  "  if (!token) return Promise.reject(new Error('no token'));",
  "  return fetch('/api/admin/status', { headers: { 'x-admin-token': token } }).then(function (res) {",
  "    if (!res.ok) throw new Error('status ' + res.status);",
  "    return res.json();",
  "  });",
  "}",
  "",
  "function renderStatus(data) {",
  "  document.getElementById('loginPanel').classList.add('hidden');",
  "  document.getElementById('dashboard').classList.remove('hidden');",
  "",
  "  var grid = document.getElementById('statGrid');",
  "  var lastRun = data.recentRuns[0];",
  "  var stats = [",
  "    ['世界暦', data.world ? data.world.current_date : '-'],",
  "    ['最終実行の状態', lastRun ? lastRun.status : '-'],",
  "    ['最終実行日時 (UTC)', lastRun ? lastRun.started_at : '-'],",
  "    ['自動実行スケジュール', data.schedule.join(' / ')],",
  "  ];",
  "  grid.innerHTML = stats.map(function (s) {",
  "    return '<div class=\"stat\"><div class=\"label\">' + escapeHtml(s[0]) + '</div><div class=\"value\">' + escapeHtml(s[1]) + '</div></div>';",
  "  }).join('');",
  "",
  "  var body = document.getElementById('runsBody');",
  "  body.innerHTML = data.recentRuns.map(function (r) {",
  "    var badgeClass = r.status === 'success' ? 'success' : (r.status === 'failed' ? 'failed' : 'running');",
  "    return '<tr>' +",
  "      '<td>' + escapeHtml(r.world_date) + '</td>' +",
  "      '<td><span class=\"badge ' + badgeClass + '\">' + escapeHtml(r.status) + '</span></td>' +",
  "      '<td>' + escapeHtml(r.ai_calls_used) + '</td>' +",
  "      '<td>' + escapeHtml(r.started_at) + '</td>' +",
  "      '<td class=\"error-text\">' + escapeHtml(r.error || '') + '</td>' +",
  "      '</tr>';",
  "  }).join('') || '<tr><td colspan=\"5\" class=\"sub\">まだ実行履歴がありません</td></tr>';",
  "",
  "  var newsList = document.getElementById('newsList');",
  "  if (data.recentNews.length === 0) {",
  "    newsList.textContent = 'まだニュースがありません。';",
  "  } else {",
  "    newsList.innerHTML = data.recentNews.map(function (n) {",
  "      return '<div style=\"margin-bottom:0.5rem\"><a href=\"/news/' + n.id + '\" target=\"_blank\">' + escapeHtml(n.title) + '</a>' +",
  "        ' <span class=\"sub\">(' + escapeHtml(n.occurred_at) + ' / ' + escapeHtml(n.category) + ')</span></div>';",
  "    }).join('');",
  "  }",
  "",
  "  document.getElementById('lastUpdated').textContent = '最終更新: ' + new Date().toLocaleTimeString('ja-JP');",
  "}",
  "",
  "function refresh() {",
  "  fetchStatus().then(renderStatus).catch(function (err) {",
  "    if (String(err.message).indexOf('401') !== -1 || String(err.message).indexOf('404') !== -1) {",
  "      clearToken();",
  "      document.getElementById('loginError').textContent = 'トークンが正しくないか、設定されていません。';",
  "      document.getElementById('dashboard').classList.add('hidden');",
  "      document.getElementById('loginPanel').classList.remove('hidden');",
  "      if (pollTimer) clearInterval(pollTimer);",
  "    }",
  "  });",
  "}",
  "",
  "function runSimulation() {",
  "  var token = getToken();",
  "  if (!token) return;",
  "  var btn = document.getElementById('simulateBtn');",
  "  var msg = document.getElementById('actionMsg');",
  "  btn.disabled = true;",
  "  msg.textContent = '実行中...';",
  "  fetch('/api/admin/simulate', { method: 'POST', headers: { 'x-admin-token': token } })",
  "    .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })",
  "    .then(function (r) {",
  "      if (r.body.skipped) {",
  "        msg.textContent = 'スキップ: ' + (r.body.reason || '') ;",
  "      } else if (r.body.error) {",
  "        msg.textContent = 'エラー: ' + r.body.error;",
  "      } else {",
  "        msg.textContent = '生成完了 (world_date=' + r.body.worldDate + ', source=' + r.body.source + ')';",
  "      }",
  "      refresh();",
  "    })",
  "    .catch(function (err) { msg.textContent = '通信エラー: ' + err.message; })",
  "    .finally(function () { btn.disabled = false; });",
  "}",
  "",
  "(function init() {",
  "  var token = getToken();",
  "  if (token) {",
  "    refresh();",
  "    pollTimer = setInterval(refresh, 10000);",
  "  }",
  "})();",
].join("\n");
