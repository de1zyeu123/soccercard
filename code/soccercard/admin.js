const API_URL = window.location.pathname.startsWith("/soccercard")
  ? "/soccercard/api/track?admin=1"
  : "./api/track?admin=1";
const FUNNEL_LABELS = {
  page_view: "进入",
  form_start: "开始填写",
  generate_click: "点击生成",
  loading_view: "进入加载",
  result_view: "看到结果",
  share_click: "点击分享",
  poster_generated: "生成海报",
  poster_download: "下载海报",
};

const $ = (selector) => document.querySelector(selector);

function formatNumber(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function formatTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function renderEmpty(target, text = "暂无数据") {
  target.innerHTML = `<div class="empty">${text}</div>`;
}

function renderFunnel(rows) {
  const target = $("#funnel");
  if (!rows?.length) return renderEmpty(target);
  target.innerHTML = rows.map((row) => `
    <div class="funnel-row">
      <div class="funnel-top">
        <strong>${FUNNEL_LABELS[row.event] || row.event}</strong>
        <span>${formatNumber(row.sessions)} 会话</span>
      </div>
      <div class="bar"><span style="width:${Math.max(3, row.rateOfEntry || 0)}%"></span></div>
      <div class="meta">到达率 ${row.rateOfEntry || 0}% · 上一步流失 ${row.dropoffFromPrevious || 0}%</div>
    </div>
  `).join("");
}

function renderRankList(selector, rows, emptyText) {
  const target = $(selector);
  if (!rows?.length) return renderEmpty(target, emptyText);
  const max = Math.max(...rows.map((row) => row.count), 1);
  target.innerHTML = rows.map((row) => `
    <div class="rank-row">
      <div class="rank-top">
        <strong>${row.label}</strong>
        <span>${formatNumber(row.count)}</span>
      </div>
      <div class="bar"><span style="width:${Math.max(4, Math.round((row.count / max) * 100))}%"></span></div>
      ${row.meta ? `<div class="meta">${row.meta}</div>` : ""}
    </div>
  `).join("");
}

function renderShare(share) {
  $("#share").innerHTML = [
    ["分享点击", share?.clicks],
    ["海报生成", share?.posters],
    ["海报下载", share?.downloads],
    ["扫码回流", share?.inboundSessions],
  ].map(([label, value]) => `
    <div class="share-item">
      <span>${label}</span>
      <strong>${formatNumber(value)}</strong>
    </div>
  `).join("");
}

function renderEvents(rows) {
  const target = $("#events");
  if (!rows?.length) {
    target.innerHTML = `<tr><td colspan="5">暂无事件</td></tr>`;
    return;
  }
  target.innerHTML = rows.map((row) => `
    <tr>
      <td>${formatTime(row.serverTs)}</td>
      <td>${row.event}</td>
      <td>${row.details?.role || row.details?.cardId || "-"}</td>
      <td>${row.page?.path || "-"}</td>
      <td>${row.source?.utmSource || row.source?.referrer || row.server?.referer || "-"}</td>
    </tr>
  `).join("");
}

function render(data) {
  $("#metric-events").textContent = formatNumber(data.summary?.events);
  $("#metric-visitors").textContent = formatNumber(data.summary?.visitors);
  $("#metric-sessions").textContent = formatNumber(data.summary?.sessions);
  $("#metric-posters").textContent = formatNumber(data.share?.posters);
  $("#last-updated").textContent = `更新 ${formatTime(data.generatedAt)}`;
  $("#retention-note").textContent = `${formatNumber(data.retention?.storedEvents)} / ${formatNumber(data.retention?.maxEvents)} 条内存事件`;

  renderFunnel(data.funnel);
  renderRankList("#top-cards", data.topCards, "暂无卡片数据");
  renderRankList("#sources", data.sources, "暂无来源数据");
  renderRankList("#locations", data.locations, "暂无地区数据");
  renderShare(data.share || {});
  renderEvents(data.recentEvents);
}

async function loadDashboard() {
  const status = $("#status-pill");
  status.className = "status-pill";
  status.textContent = "读取中";
  try {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("key") || "";
    const apiUrl = new URL(API_URL, window.location.href);
    if (key) apiUrl.searchParams.set("key", key);
    const response = await fetch(apiUrl.toString(), {
      headers: { "Cache-Control": "no-store" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    render(await response.json());
    status.className = "status-pill ok";
    status.textContent = "已连接";
  } catch (error) {
    status.className = "status-pill error";
    status.textContent = "读取失败";
    renderEmpty($("#funnel"), error.message || "读取失败");
  }
}

$("#refresh").addEventListener("click", loadDashboard);
loadDashboard();
