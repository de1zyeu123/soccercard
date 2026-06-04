const DATA_URL = "../../PRD/足球命格_96球员图文配对清单_v1.md";
const ASSET_BASE = "../../assets/generated/player-archetypes-v1/";

const state = {
  players: [],
  selectedStyle: "翩翩公子",
  currentResult: null,
  galleryPage: 0,
  galleryPageSize: 8,
};

const scoreLabels = [
  ["aggression", "凶狠"],
  ["elegance", "优雅"],
  ["control", "控场"],
  ["explosive", "爆点"],
  ["finishing", "终结"],
  ["chaos", "抽象"],
];

const personaRules = [
  { name: "球场恶汉", key: "aggression", positions: ["中后卫", "后腰"] },
  { name: "冷脸会计", key: "control", positions: ["后腰", "中前卫"] },
  { name: "翩翩公子", key: "elegance", positions: ["前腰", "中前卫", "右中场"] },
  { name: "舞动精灵", key: "elegance", positions: ["前腰", "左边锋", "右边锋", "边锋"] },
  { name: "内切老汉", key: "explosive", positions: ["右边锋", "左边锋", "边锋"] },
  { name: "禁区杀手", key: "finishing", positions: ["中锋", "影锋"] },
  { name: "门线贵族", key: "control", positions: ["门将"] },
  { name: "快乐抽象派", key: "chaos", positions: ["中锋", "前腰", "中后卫", "门将"] },
];

function $(selector) {
  return document.querySelector(selector);
}

function showScreen(name) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.dataset.screen === name);
  });
}

function parsePlayers(markdown) {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\| \d{2} \|/.test(line))
    .map((line) => {
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
      const id = Number(cells[0]);
      const file = cells[1].replaceAll("`", "");
      const copy = cells[2];
      const role = match(copy, /角色：(.+?)。/);
      const summary = match(copy, /梗概括：(.+?)。/);
      const position = match(copy, /位置：(.+?)。/);
      const reading = match(copy, /命格解读：(.+?)。/);

      return {
        id,
        file,
        image: ASSET_BASE + file,
        role,
        summary,
        position,
        reading,
        copy,
      };
    });
}

function match(text, regex) {
  const result = text.match(regex);
  return result ? result[1] : "";
}

function hashText(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function getFormData() {
  return {
    nickname: $("#nickname").value.trim() || "匿名球员",
    gender: $("#gender").value,
    birthplace: $("#birthplace").value.trim() || "未知城市",
    birthdate: $("#birthdate").value || "2000-01-01",
    birthtime: $("#birthtime").value,
    selfStyle: state.selectedStyle,
  };
}

function calculateProfile(input) {
  const seed = hashText(`${input.gender}|${input.birthplace}|${input.birthdate}|${input.birthtime}`);
  const date = new Date(`${input.birthdate}T12:00:00`);
  const month = Number.isNaN(date.getTime()) ? 1 : date.getMonth() + 1;
  const day = Number.isNaN(date.getTime()) ? 1 : date.getDate();
  const hour = input.birthtime === "unknown" ? 12 : Number(input.birthtime);

  const elements = {
    木: 38 + ((seed >>> 1) % 26),
    火: 38 + ((seed >>> 4) % 26),
    土: 38 + ((seed >>> 7) % 26),
    金: 38 + ((seed >>> 10) % 26),
    水: 38 + ((seed >>> 13) % 26),
  };

  if ([2, 3, 4].includes(month)) elements.木 += 18;
  if ([5, 6, 7].includes(month)) elements.火 += 18;
  if ([3, 6, 9, 12].includes(month)) elements.土 += 12;
  if ([8, 9, 10].includes(month)) elements.金 += 18;
  if ([11, 12, 1].includes(month)) elements.水 += 18;

  elements[["木", "火", "土", "金", "水"][day % 5]] += 10;
  elements[["木", "火", "土", "金", "水"][hour % 5]] += 8;

  const traits = {
    七杀: seed % 3 === 0,
    伤官: seed % 4 === 0,
    食神: seed % 5 === 0,
    正官: seed % 7 === 0,
    财星: seed % 6 === 0,
    印旺: seed % 8 === 0,
    比劫: seed % 9 === 0,
    冲多: seed % 10 < 4,
    合多: seed % 11 < 3,
    身强: seed % 100 > 48,
  };

  const scores = {
    aggression: 44 + elements.金 * 0.23 + elements.土 * 0.12,
    elegance: 42 + elements.水 * 0.18 + elements.木 * 0.14,
    control: 42 + elements.水 * 0.24 + elements.土 * 0.16,
    explosive: 42 + elements.木 * 0.22 + elements.火 * 0.2,
    finishing: 42 + elements.金 * 0.16 + elements.火 * 0.22,
    chaos: 36 + elements.火 * 0.14 + ((seed >>> 16) % 28),
  };

  if (traits.七杀) scores.aggression += 14;
  if (traits.伤官) {
    scores.explosive += 9;
    scores.chaos += 11;
  }
  if (traits.食神) scores.elegance += 12;
  if (traits.正官) scores.control += 12;
  if (traits.财星) scores.finishing += 12;
  if (traits.印旺) {
    scores.control += 8;
    scores.elegance += 6;
  }
  if (traits.比劫) {
    scores.aggression += 8;
    scores.explosive += 4;
  }
  if (traits.冲多) {
    scores.chaos += 8;
    scores.explosive += 5;
  }
  if (traits.合多) {
    scores.control += 6;
    scores.elegance += 5;
    scores.aggression -= 3;
  }
  if (traits.身强) {
    scores.aggression += 4;
    scores.finishing += 4;
  } else {
    scores.elegance += 3;
    scores.chaos += 4;
  }

  Object.keys(scores).forEach((key) => {
    scores[key] = clamp(scores[key]);
  });
  Object.keys(elements).forEach((key) => {
    elements[key] = clamp(elements[key], 20, 96);
  });

  const maxScore = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const persona = choosePersona(scores, maxScore[0]);
  const position = choosePosition(scores, elements);
  const confidence = input.birthtime === "unknown" ? 78 + (seed % 10) : 88 + (seed % 8);

  return { seed, elements, traits, scores, maxScore, persona, position, confidence };
}

function choosePersona(scores, topKey) {
  if (scores.chaos >= 82) return "快乐抽象派";
  if (topKey === "aggression") return scores.control > 74 ? "武僧铁卫" : "球场恶汉";
  if (topKey === "control") return "冷脸会计";
  if (topKey === "elegance") return "翩翩公子";
  if (topKey === "explosive") return "内切老汉";
  if (topKey === "finishing") return "禁区杀手";
  return "中场陀螺";
}

function choosePosition(scores, elements) {
  if (scores.control > 82 && elements.水 > 70 && scores.explosive < 72) return "门将";
  if (scores.aggression > 82 && elements.土 + elements.金 > 135) return "中后卫";
  if (scores.finishing >= Math.max(scores.explosive, scores.control, scores.elegance)) return "中锋";
  if (scores.explosive >= Math.max(scores.control, scores.elegance)) return elements.木 > elements.火 ? "左边锋" : "右边锋";
  if (scores.control > 76 && scores.aggression > 66) return "后腰";
  if (scores.elegance > 76) return "前腰";
  return "中前卫";
}

function pickPlayer(profile) {
  const preferred = state.players.filter((player) => {
    if (profile.persona === "门线贵族") return player.position === "门将";
    if (profile.position === "边锋") return player.position.includes("边锋");
    return player.position === profile.position;
  });
  const pool = preferred.length >= 4 ? preferred : state.players;
  const ranked = pool
    .map((player) => {
      let score = 0;
      if (player.position === profile.position) score += 40;
      if (profile.persona.includes("抽象") && /抽象|快乐|喜剧|问号|蝎子|航母|林皇|挡/.test(player.copy)) score += 35;
      if (profile.persona.includes("恶汉") && /武僧|飞踹|铁血|铲车|七杀|高危/.test(player.copy)) score += 35;
      if (profile.persona.includes("公子") && /优雅|翩翩|圆月|睡皮|小白|贵族/.test(player.copy)) score += 30;
      if (profile.persona.includes("禁区") && /中锋|神锋|杀手|终结|射手|重炮/.test(player.copy)) score += 30;
      if (profile.persona.includes("内切") && /边锋|爆点|内切|左路|右路|速度/.test(player.copy)) score += 30;
      score += hashText(`${profile.seed}-${player.id}`) % 25;
      return { player, score };
    })
    .sort((a, b) => b.score - a.score);

  return ranked[0].player;
}

function buildResult(input) {
  const profile = calculateProfile(input);
  const player = pickPlayer(profile);
  return { input, profile, player };
}

function renderResult(result) {
  const { input, profile, player } = result;
  state.currentResult = result;

  $("#result-image").src = player.image;
  $("#result-image").alt = player.role;
  $("#result-id").textContent = `RESULT ${String(player.id).padStart(2, "0")} · ${input.nickname}`;
  $("#result-role").textContent = player.role;
  $("#result-summary").textContent = player.summary;
  $("#result-position").textContent = player.position;
  $("#result-persona").textContent = profile.persona;
  $("#result-confidence").textContent = `置信度 ${profile.confidence}%`;
  $("#result-reading").textContent = player.reading;
  $("#self-style").textContent = input.selfStyle;
  $("#system-style").textContent = profile.persona;

  const [topKey, topValue] = profile.maxScore;
  const topLabel = scoreLabels.find(([key]) => key === topKey)[1];
  $("#top-score").textContent = `${topLabel} ${topValue}`;

  $("#score-grid").innerHTML = scoreLabels
    .map(([key, label]) => {
      const value = profile.scores[key];
      return `
        <div class="score-item">
          <span>${label}</span>
          <div class="track"><div class="bar" style="width:${value}%"></div></div>
          <strong>${value}</strong>
        </div>
      `;
    })
    .join("");

  $("#element-row").innerHTML = Object.entries(profile.elements)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => `<span>${name} ${value}</span>`)
    .join("");

  updateSavedBox();
}

function renderGallery() {
  const start = state.galleryPage * state.galleryPageSize;
  const pagePlayers = state.players.slice(start, start + state.galleryPageSize);
  const grid = $("#gallery-grid");
  grid.classList.toggle("compact", state.galleryPageSize === 16);
  grid.innerHTML = pagePlayers
    .map((player) => `
      <article class="gallery-item" role="button" tabindex="0" data-id="${player.id}">
        <img src="${player.image}" alt="${player.role}" />
        <div class="gallery-caption">
          <strong>${String(player.id).padStart(2, "0")} ${player.role}</strong>
          <span>${player.position} · ${player.summary}</span>
        </div>
      </article>
    `)
    .join("");
  renderGalleryControls();
}

function renderGalleryControls() {
  const totalPages = Math.ceil(state.players.length / state.galleryPageSize);
  $("#gallery-page-label").textContent = `${state.galleryPage + 1} / ${totalPages}`;
  $("#gallery-prev").disabled = state.galleryPage === 0;
  $("#gallery-next").disabled = state.galleryPage >= totalPages - 1;
  document.querySelectorAll("[data-page-size]").forEach((button) => {
    button.classList.toggle("selected", Number(button.dataset.pageSize) === state.galleryPageSize);
  });
}

function selectGalleryPlayer(target) {
  const item = target.closest(".gallery-item");
  if (!item) return;
  const player = state.players.find((entry) => entry.id === Number(item.dataset.id));
  if (!player) return;
  const input = getFormData();
  const profile = calculateProfile(input);
  const result = { input, profile: { ...profile, position: player.position }, player };
  renderResult(result);
  showScreen("result");
}

function bindGalleryEvents() {
  $("#gallery-grid").addEventListener("click", (event) => {
    selectGalleryPlayer(event.target);
  });

  $("#gallery-grid").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectGalleryPlayer(event.target);
  });

  $("#gallery-prev").addEventListener("click", () => {
    state.galleryPage = Math.max(0, state.galleryPage - 1);
    renderGallery();
  });

  $("#gallery-next").addEventListener("click", () => {
    const totalPages = Math.ceil(state.players.length / state.galleryPageSize);
    state.galleryPage = Math.min(totalPages - 1, state.galleryPage + 1);
    renderGallery();
  });

  document.querySelectorAll("[data-page-size]").forEach((button) => {
    button.addEventListener("click", () => {
      state.galleryPageSize = Number(button.dataset.pageSize);
      state.galleryPage = 0;
      renderGallery();
    });
  });
}

function attachImagePaths(players) {
  return players.map((player) => ({
    ...player,
    image: ASSET_BASE + player.file,
  }));
}

async function loadPlayers() {
  if (Array.isArray(window.PLAYER_DATA) && window.PLAYER_DATA.length > 0) {
    return attachImagePaths(window.PLAYER_DATA);
  }

  const response = await fetch(DATA_URL);
  const markdown = await response.text();
  return parsePlayers(markdown);
}

function updateSavedBox() {
  const saved = localStorage.getItem("footballBirthrightResult");
  if (!saved) return;
  const parsed = JSON.parse(saved);
  $("#saved-box").innerHTML = `
    <span>RESULT STORE</span>
    <strong>已保存 ${parsed.role} · ${parsed.position}</strong>
  `;
}

async function init() {
  state.players = await loadPlayers();
  renderGallery();
  bindGalleryEvents();
  updateSavedBox();

  $("#style-grid").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-style]");
    if (!button) return;
    state.selectedStyle = button.dataset.style;
    document.querySelectorAll("#style-grid button").forEach((entry) => {
      entry.classList.toggle("selected", entry === button);
    });
  });

  $("#birth-form").addEventListener("submit", (event) => {
    event.preventDefault();
    showScreen("loading");
    const input = getFormData();
    const result = buildResult(input);
    setTimeout(() => {
      renderResult(result);
      showScreen("result");
    }, 900);
  });

  $("#regen").addEventListener("click", () => showScreen("form"));
  $("#open-gallery").addEventListener("click", () => showScreen("gallery"));
  $("#close-gallery").addEventListener("click", () => showScreen("result"));
  $("#save-result").addEventListener("click", () => {
    if (!state.currentResult) return;
    const { player, profile } = state.currentResult;
    const saved = {
      resultId: player.id,
      role: player.role,
      position: player.position,
      persona: profile.persona,
      image: player.image,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem("footballBirthrightResult", JSON.stringify(saved));
    updateSavedBox();
    $("#save-result").textContent = "已保存";
    setTimeout(() => {
      $("#save-result").textContent = "保存结果";
    }, 1200);
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get("auto") === "1") {
    const result = buildResult(getFormData());
    renderResult(result);
    showScreen("result");
  }
  if (params.get("gallery") === "1") {
    showScreen("gallery");
  }
}


init().catch((error) => {
  console.error(error);
  $("#loading-line").textContent = "素材读取失败，请从本地服务器打开预览。";
});
