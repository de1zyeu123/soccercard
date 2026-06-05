const DATA_URL = "../../PRD/足球命格_96球员图文配对清单_v1.md";
const ASSET_BASE = "../../assets/generated/player-archetypes-v1/";
const QR_IMAGE_SRC = "./product-qr.png";
const PRODUCT_URL = "https://de1zyeu.tech/soccercard/";

const state = {
  players: [],
  selectedStyle: "",
  currentResult: null,
  galleryPage: 0,
  galleryPageSize: 16,
  sharePosterBlob: null,
  sharePosterUrl: "",
};

const scoreLabels = [
  ["aggression", "凶狠"],
  ["elegance", "优雅"],
  ["control", "控场"],
  ["explosive", "爆点"],
  ["finishing", "终结"],
  ["chaos", "抽象"],
];

const countryPrefixes = [
  "科特迪瓦",
  "塞尔维亚",
  "克罗地亚",
  "哥伦比亚",
  "阿根廷",
  "葡萄牙",
  "英格兰",
  "意大利",
  "西班牙",
  "乌拉圭",
  "比利时",
  "喀麦隆",
  "乌克兰",
  "威尔士",
  "大英",
  "法国",
  "瑞典",
  "荷兰",
  "巴西",
  "德国",
  "韩国",
  "挪威",
  "波兰",
  "埃及",
];

const roleDisplayExceptions = new Set(["韩国欧巴"]);

const playerOverrides = {
  1: {
    role: "球场武僧",
    summary: "少林足球第一人",
    reading: "强硬写在你的比赛开关里，局面越乱，你越容易进入状态。你适合守在核心身边，把对手的火气先按住；球场武僧这张牌，讲的就是“先过我再说”的防守本能。",
    persona: "球场恶汉",
    extraTag: "总裁保镖",
    analysisSummary: "少林足球第一人，总裁身边第一道防线。",
  },
};

const styleBias = {
  后防中坚: { aggression: 20, control: 10, explosive: -8, chaos: -5 },
  中场指挥官: { control: 24, elegance: 8, aggression: -6, chaos: -6 },
  跑不死后腰: { control: 18, aggression: 12, elegance: -6 },
  边路快马: { explosive: 24, finishing: 6, control: -6 },
  禁区杀手: { finishing: 24, aggression: 6, elegance: -5 },
  门线英雄: { control: 24, elegance: 6, chaos: -8 },
  快乐抽象派: { chaos: 24, explosive: 8, control: -8 },
  球王: { finishing: 15, elegance: 12, control: 8, chaos: -8 },
  假摔一哥: { chaos: 20, elegance: 10, aggression: -5 },
  暴力野兽: { aggression: 24, finishing: 8, elegance: -8 },
};

const personaRules = [
  { name: "球场恶汉", key: "aggression", positions: ["中后卫", "后腰"] },
  { name: "冷脸会计", key: "control", positions: ["后腰", "中前卫"] },
  { name: "球场艺术家", key: "elegance", positions: ["前腰", "中前卫", "右中场"] },
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
      const summary = normalizeSummary(match(copy, /梗概括：(.+?)(?=位置：)/));
      const position = match(copy, /位置：(.+?)。/);
      const tags = splitTags(match(copy, /标签：(.+?)。/));
      const reading = match(copy, /天命解读：(.+)$/);

      return applyPlayerOverride({
        id,
        file,
        image: ASSET_BASE + file,
        role,
        summary,
        position,
        reading,
        tags,
        copy,
      });
    });
}

function match(text, regex) {
  const result = text.match(regex);
  return result ? result[1] : "";
}

function normalizeSummary(value) {
  return value.trim().replace(/。$/u, "");
}

function applyPlayerOverride(player) {
  return {
    ...player,
    ...(playerOverrides[player.id] || {}),
  };
}

function splitTags(value) {
  return value
    ? value.split(/[、,，]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 3)
    : [];
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

function shapeScoreByRank(rawScore, rank, seed) {
  const bands = [
    [84, 96],
    [66, 80],
    [48, 62],
    [34, 48],
    [24, 40],
    [18, 34],
  ];
  const [min, max] = bands[rank] || bands[bands.length - 1];
  const normalized = Math.max(0, Math.min(1, (rawScore - 34) / 62));
  const wobble = ((seed >>> (rank * 4 + 3)) % 7) - 3;
  return clamp(min + normalized * (max - min) + wobble, 16, 96);
}

function polarizeScores(rawScores, seed) {
  const shaped = {};
  const ranked = scoreLabels
    .map(([key]) => [key, rawScores[key]])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  ranked.forEach(([key, value], rank) => {
    shaped[key] = shapeScoreByRank(value, rank, seed);
  });

  return shaped;
}

function getFormData() {
  return {
    nickname: $("#nickname").value.trim(),
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
    aggression: 30 + elements.金 * 0.22 + elements.土 * 0.1,
    elegance: 28 + elements.水 * 0.17 + elements.木 * 0.12,
    control: 30 + elements.水 * 0.23 + elements.土 * 0.15,
    explosive: 28 + elements.木 * 0.21 + elements.火 * 0.18,
    finishing: 28 + elements.金 * 0.15 + elements.火 * 0.2,
    chaos: 24 + elements.火 * 0.12 + ((seed >>> 16) % 24),
  };

  if (traits.七杀) scores.aggression += 16;
  if (traits.伤官) {
    scores.explosive += 10;
    scores.chaos += 14;
  }
  if (traits.食神) scores.elegance += 15;
  if (traits.正官) scores.control += 16;
  if (traits.财星) scores.finishing += 16;
  if (traits.印旺) {
    scores.control += 10;
    scores.elegance += 5;
  }
  if (traits.比劫) {
    scores.aggression += 11;
    scores.explosive += 5;
  }
  if (traits.冲多) {
    scores.chaos += 11;
    scores.explosive += 6;
  }
  if (traits.合多) {
    scores.control += 8;
    scores.elegance += 5;
    scores.aggression -= 6;
  }
  if (traits.身强) {
    scores.aggression += 5;
    scores.finishing += 5;
  } else {
    scores.elegance += 4;
    scores.chaos += 5;
  }

  Object.entries(styleBias[input.selfStyle] || {}).forEach(([key, value]) => {
    scores[key] += value;
  });

  const shapedScores = polarizeScores(scores, seed);
  Object.keys(elements).forEach((key) => {
    elements[key] = clamp(elements[key], 20, 96);
  });

  const maxScore = Object.entries(shapedScores).sort((a, b) => b[1] - a[1])[0];
  const persona = choosePersona(shapedScores, maxScore[0]);
  const position = choosePosition(shapedScores, elements, input.selfStyle);
  const confidence = input.birthtime === "unknown" ? 78 + (seed % 10) : 88 + (seed % 8);
  const overall = calculateOverall(shapedScores, confidence);

  return { seed, elements, traits, scores: shapedScores, maxScore, persona, position, confidence, overall };
}

function calculateOverall(scores, confidence) {
  const values = Object.values(scores);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const sorted = [...values].sort((a, b) => b - a);
  const peak = sorted[0];
  const second = sorted[1];
  return clamp(peak * 0.52 + second * 0.18 + average * 0.2 + confidence * 0.1, 45, 98);
}

function buildPlayerPreviewProfile(input, player) {
  const text = `${player.role} ${player.summary} ${player.position} ${(player.tags || []).join(" ")}`;
  const seed = hashText(`${player.id}|${text}`);
  const scores = {
    aggression: 32 + (seed % 21),
    elegance: 32 + ((seed >>> 3) % 21),
    control: 32 + ((seed >>> 6) % 21),
    explosive: 32 + ((seed >>> 9) % 21),
    finishing: 32 + ((seed >>> 12) % 21),
    chaos: 28 + ((seed >>> 15) % 24),
  };

  if (/武僧|屠夫|恶汉|飞踹|铲车|铁血|野兽|暴力|咆哮|铁卫|队魂/u.test(text)) {
    scores.aggression += 30;
    scores.chaos += 10;
  }
  if (/球王|艺术家|指挥官|优雅|贵族|定位球|舞|桑巴|魔术|油炸|诗人|小碎步/u.test(text)) {
    scores.elegance += 28;
    scores.control += 8;
  }
  if (/后腰|中前卫|指挥|节拍|发牌|导航|底盘|会计|补锅/u.test(text)) {
    scores.control += 30;
  }
  if (/边锋|快马|爆点|内切|腾云|高速|冲刺|永动机|单刀/u.test(text)) {
    scores.explosive += 30;
  }
  if (/中锋|射手|杀手|终结|进球|重炮|魔人|禁区|天神|坦克|支点/u.test(text)) {
    scores.finishing += 30;
  }
  if (/抽象|快乐|喜剧|问号|庆祝|挡拆|航母|蝎子|内马滚/u.test(text)) {
    scores.chaos += 30;
  }
  if (/门将|门神|门线|手套|扑救/u.test(text)) {
    scores.control += 30;
    scores.elegance += 8;
  }

  const shapedScores = polarizeScores(scores, seed);

  const elements = {
    木: clamp(shapedScores.explosive - 4, 20, 96),
    火: clamp(Math.max(shapedScores.finishing, shapedScores.chaos) - 3, 20, 96),
    土: clamp(shapedScores.control - 2, 20, 96),
    金: clamp(shapedScores.aggression - 2, 20, 96),
    水: clamp(shapedScores.elegance - 2, 20, 96),
  };
  const maxScore = Object.entries(shapedScores).sort((a, b) => b[1] - a[1])[0];
  const confidence = 88 + (seed % 9);
  const ratingLift = 4
    + (/球王|GOAT|天神|艺术家|指挥官|优雅|禁区诗人|暴力终结|重炮射手/u.test(text) ? 7 : 0)
    + (/少年|未来|灵感|阳光|冷脸/u.test(text) ? 3 : 0)
    - (/喜剧|快乐抽象|航母|挡拆|庆祝|问号/u.test(text) ? 2 : 0);
  const overall = clamp(calculateOverall(shapedScores, confidence) + ratingLift, 58, 96);

  return {
    seed,
    elements,
    traits: {},
    scores: shapedScores,
    maxScore,
    persona: player.tags?.[1] || choosePersona(shapedScores, maxScore[0]),
    position: player.position,
    confidence,
    overall,
  };
}

function choosePersona(scores, topKey) {
  if (scores.chaos >= 82) return "快乐抽象派";
  if (topKey === "aggression") return scores.control > 74 ? "武僧铁卫" : "球场恶汉";
  if (topKey === "control") return "冷脸会计";
  if (topKey === "elegance") return "球场艺术家";
  if (topKey === "explosive") return "内切老汉";
  if (topKey === "finishing") return "禁区杀手";
  return "中场陀螺";
}

function choosePosition(scores, elements, selfStyle) {
  if (selfStyle === "门线英雄") return "门将";
  if (selfStyle === "后防中坚") return "中后卫";
  if (selfStyle === "跑不死后腰") return "后腰";
  if (selfStyle === "边路快马") return elements.木 > elements.火 ? "左边锋" : "右边锋";
  if (selfStyle === "禁区杀手") return "中锋";
  if (selfStyle === "中场指挥官") return scores.elegance > scores.control ? "前腰" : "中前卫";
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
      if (profile.persona.includes("抽象") && /抽象|快乐|喜剧|问号|蝎子|航母|庆祝|挡/.test(player.copy)) score += 35;
      if (profile.persona.includes("恶汉") && /武僧|飞踹|铁血|铲车|屠夫|暴力/.test(player.copy)) score += 35;
      if (profile.persona.includes("艺术家") && /优雅|定位球|睡眼|油炸|贵族|魔术|艺术家/.test(player.copy)) score += 30;
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
  $("#result-image").alt = getDisplayRole(player);
  $("#result-id").textContent = `命中球缘 · ${getDisplayNickname(input)}`;
  renderResultContrast(input, player);
  $("#result-role").textContent = getDisplayRole(player);
  $("#result-summary").textContent = player.summary;
  const resultTags = getResultTags(player, profile);
  $("#result-position").textContent = resultTags[0] || "";
  $("#result-persona").textContent = resultTags[1] || "";
  $("#result-extra-tag").textContent = resultTags[2] || "";
  $("#reading-summary").textContent = buildAnalysisSummary(profile, player);
  $("#result-reading").textContent = buildPlainReading(input, profile, player);
  setReadingPanelOpen(false);

  $("#top-score").textContent = `综合能力值 ${profile.overall}`;
  renderRadar(profile.scores);

  updateSavedBox();
}

function setReadingPanelOpen(isOpen) {
  const panel = $("#reading-panel");
  const drawer = $("#reading-drawer");
  const button = $("#reading-toggle");
  if (!panel || !drawer || !button) return;
  panel.classList.toggle("open", isOpen);
  $("#result-card")?.classList.toggle("drawer-open", isOpen);
  drawer.setAttribute("aria-hidden", String(!isOpen));
  button.setAttribute("aria-expanded", String(isOpen));
  updateReadingPanelLabel();
}

function updateReadingPanelLabel() {
  const panel = $("#reading-panel");
  const button = $("#reading-toggle");
  if (!panel || !button) return;
  button.textContent = panel.classList.contains("open") ? "收起" : "展开";
}

function buildAnalysisSummary(profile, player) {
  if (player.reading) {
    return summarizeReading(player.reading);
  }

  if (player.analysisSummary) {
    return player.analysisSummary;
  }

  const [topKey] = profile.maxScore;
  const summary = {
    aggression: "硬仗不退，越乱越敢上身体。",
    elegance: "不靠嗓门，靠脚下那一下聪明劲。",
    control: "场面越乱，你越想先把节奏拿回来。",
    explosive: "平时不显山露水，一有空当就突然加速。",
    finishing: "机会不一定多，但门前那一下很认真。",
    chaos: "你的强项在反常规，别人很难提前猜到。",
  }[topKey];
  return summary;
}

function summarizeReading(reading) {
  return reading
    .split("。")[0]
    .trim();
}

function buildPlainReading(input, profile, player) {
  if (player.reading) {
    return asSentence(player.reading);
  }

  const [topKey] = profile.maxScore;
  const elementLeader = Object.entries(profile.elements).sort((a, b) => b[1] - a[1])[0][0];
  const traitLine = {
    aggression: "对抗感很强，遇到五五开不会先躲，第一反应是把强度顶上去",
    elegance: "脚下有聪明劲，不靠嗓门赢球，靠那一下轻巧处理让人闭嘴",
    control: "越乱越想把节奏拿回来，别人慌的时候你反而开始读秒",
    explosive: "平时不显山露水，一有空当就突然加速，像偷偷按了加速键",
    finishing: "机会不一定多，但门前那一下很认真，适合把小缝隙变成大结果",
    chaos: "你的球风反常规，强在别人猜不到，越离谱的局越容易有你的戏份",
  }[topKey];

  const elementLine = {
    木: "反应快、点子多，适合从缝里长出来",
    火: "越有镜头越来劲，越被看见越敢做动作",
    土: "底盘稳，硬仗里更像能扛事的人",
    金: "判断硬、下脚果断，危险球面前不太让路",
    水: "会读局，知道什么时候该慢，什么时候该突然变速",
  }[elementLeader];

  return `从你的出生节奏看，你${traitLine}；${elementLine}。这类配置更适合${getPositionFit(player.position)}。这张牌落到「${getDisplayRole(player)}」很合理：${asSentence(player.summary)}`;
}

function asSentence(text) {
  return /[。！？!?]$/.test(text) ? text : `${text}。`;
}

function getPositionFit(position) {
  if (/门将/.test(position)) return "守最后一道门，越关键越能把对手心态拿住";
  if (/中后卫/.test(position)) return "当后防闸门，别人乱冲时你负责让场面冷下来";
  if (/后腰/.test(position)) return "站在中场腹地扫雷、补锅、顺手把节奏抢回来";
  if (/中前卫|右中场/.test(position)) return "在中场做发动机，既能接住混乱，也能把球送到正确的人脚下";
  if (/前腰|影锋/.test(position)) return "藏在前场缝隙里做答案，一脚把普通回合变成名场面";
  if (/边锋|左边锋|右边锋/.test(position)) return "沿着边路把对手拉开，靠速度、胆量和小动作制造爆点";
  if (/左后卫|右后卫/.test(position)) return "在边路攻防两头来回切换，把一条边线跑成自己的地盘";
  if (/中锋/.test(position)) return "站到禁区最危险的位置，把身体、嗅觉和最后一脚都用上";
  return "在球场上找到最适合自己的位置，把优势踢得很明显";
}

function renderRadar(scores) {
  const center = 82;
  const outer = 48;
  const inner = 24;
  const axis = scoreLabels.map(([, label], index) => {
    const angle = (-90 + index * 60) * Math.PI / 180;
    return {
      label,
      x: center + Math.cos(angle) * outer,
      y: center + Math.sin(angle) * outer,
      lx: center + Math.cos(angle) * 68,
      ly: center + Math.sin(angle) * 68,
      angle,
    };
  });
  const gridOuter = axis.map((point) => `${point.x},${point.y}`).join(" ");
  const gridInner = axis
    .map((point) => `${center + Math.cos(point.angle) * inner},${center + Math.sin(point.angle) * inner}`)
    .join(" ");
  const statPoints = scoreLabels
    .map(([key], index) => {
      const angle = (-90 + index * 60) * Math.PI / 180;
      const radius = 6 + scores[key] / 100 * 42;
      return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
    })
    .join(" ");

  $("#radar-chart").innerHTML = `
    <polygon class="radar-grid" points="${gridOuter}"></polygon>
    <polygon class="radar-grid radar-grid-inner" points="${gridInner}"></polygon>
    ${axis.map((point) => `<line class="radar-axis" x1="${center}" y1="${center}" x2="${point.x}" y2="${point.y}"></line>`).join("")}
    <polygon class="radar-shape" points="${statPoints}"></polygon>
    ${axis.map((point) => `<text class="radar-label" x="${point.lx}" y="${point.ly}">${point.label}</text>`).join("")}
  `;
}

function renderGallery() {
  const start = state.galleryPage * state.galleryPageSize;
  const pagePlayers = state.players.slice(start, start + state.galleryPageSize);
  const grid = $("#gallery-grid");
  grid.classList.add("compact");
  grid.innerHTML = pagePlayers
    .map((player) => `
      <article class="gallery-item" role="button" tabindex="0" data-id="${player.id}">
        <img src="${player.image}" alt="${getDisplayRole(player)}" />
        <div class="gallery-caption">
          <strong>${formatGalleryRole(player.role)}</strong>
          <span>${player.position} · ${player.summary}</span>
        </div>
      </article>
    `)
    .join("");
  renderGalleryControls();
}

function formatGalleryRole(role) {
  if (roleDisplayExceptions.has(role)) return role;
  const prefix = countryPrefixes.find((country) => role.startsWith(country));
  return prefix ? role.slice(prefix.length) : role;
}

function getDisplayRole(player) {
  return formatGalleryRole(player.role);
}

function renderResultContrast(input, player) {
  const contrast = $("#result-contrast");
  if (!contrast) return;
  if (!input.selfStyle) {
    contrast.hidden = true;
    contrast.textContent = "";
    return;
  }
  contrast.textContent = `你以为你是${input.selfStyle}，\n实际你是${getDisplayRole(player)}`;
  contrast.hidden = false;
}

function getDisplayNickname(input) {
  return input.nickname || "无名小卒";
}

function getResultTags(player, profile) {
  if (Array.isArray(player.tags) && player.tags.length >= 3) {
    return player.tags.slice(0, 3);
  }

  return [
    player.position,
    player.persona || profile.persona,
    player.extraTag || getDisplayRole(player),
  ];
}

function renderGalleryControls() {
  const totalPages = Math.ceil(state.players.length / state.galleryPageSize);
  $("#gallery-page-label").textContent = `${state.galleryPage + 1} / ${totalPages}`;
  $("#gallery-prev").disabled = state.galleryPage === 0;
  $("#gallery-next").disabled = state.galleryPage >= totalPages - 1;
}

function selectGalleryPlayer(target) {
  const item = target.closest(".gallery-item");
  if (!item) return;
  const player = state.players.find((entry) => entry.id === Number(item.dataset.id));
  if (!player) return;
  const input = getFormData();
  const profile = buildPlayerPreviewProfile(input, player);
  const result = { input, profile, player };
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

}

function attachImagePaths(players) {
  return players.map((player) => ({
    ...applyPlayerOverride(player),
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

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = new URL(src, window.location.href);
    if (url.origin === window.location.origin && url.protocol !== "file:") {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url.href;
  });
}

function drawCoverImage(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = 0;
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
  const chars = Array.from(text);
  let line = "";
  let lineCount = 0;

  chars.forEach((char, index) => {
    const test = line + char;
    const isLast = index === chars.length - 1;
    if (ctx.measureText(test).width > maxWidth && line) {
      lineCount += 1;
      const suffix = lineCount === maxLines && !isLast ? "..." : "";
      ctx.fillText(line + suffix, x, y);
      y += lineHeight;
      line = char;
      if (lineCount >= maxLines) line = "";
      return;
    }
    line = test;
  });

  if (line && lineCount < maxLines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }

  return y;
}

function drawRadarCanvas(ctx, scores, x, y, radius) {
  const centerX = x;
  const centerY = y;
  const points = scoreLabels.map(([, label], index) => {
    const angle = (-90 + index * 60) * Math.PI / 180;
    return {
      label,
      angle,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    };
  });

  ctx.save();
  ctx.fillStyle = "rgba(6, 15, 12, 0.78)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.26)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  [0.45, 0.72].forEach((level) => {
    ctx.beginPath();
    points.forEach((point, index) => {
      const px = centerX + Math.cos(point.angle) * radius * level;
      const py = centerY + Math.sin(point.angle) * radius * level;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  const statPoints = scoreLabels.map(([key], index) => {
    const angle = (-90 + index * 60) * Math.PI / 180;
    const statRadius = radius * (0.08 + scores[key] / 100 * 0.86);
    return {
      x: centerX + Math.cos(angle) * statRadius,
      y: centerY + Math.sin(angle) * statRadius,
    };
  });
  ctx.beginPath();
  statPoints.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(244, 196, 49, 0.72)";
  ctx.strokeStyle = "#f4c431";
  ctx.lineWidth = 4;
  ctx.fill();
  ctx.stroke();

  ctx.font = "700 24px PingFang SC, sans-serif";
  ctx.fillStyle = "#fffdf4";
  ctx.textAlign = "center";
  points.forEach((point) => {
    ctx.fillText(point.label, centerX + Math.cos(point.angle) * (radius + 32), centerY + Math.sin(point.angle) * (radius + 32) + 8);
  });
  ctx.restore();
}

function drawCanvasChip(ctx, label, x, y) {
  ctx.font = "900 28px PingFang SC, sans-serif";
  const width = Math.ceil(ctx.measureText(label).width) + 42;
  roundedRect(ctx, x, y, width, 52, 26);
  ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
  ctx.fill();
  ctx.fillStyle = "#fffdf4";
  ctx.fillText(label, x + 21, y + 36);
  return x + width + 14;
}

async function buildSharePosterBlob() {
  const { input, profile, player } = state.currentResult;
  const displayRole = getDisplayRole(player);
  const [playerImage, qrImage] = await Promise.all([
    loadImage(player.image),
    loadImage(QR_IMAGE_SRC),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  const nickname = getDisplayNickname(input);
  const contrast = state.selectedStyle ? `你以为你是${state.selectedStyle}，实际你是${displayRole}` : `你测出来是${displayRole}`;
  const safeUrl = PRODUCT_URL.replace("https://", "").replace(/\/$/, "");

  ctx.fillStyle = "#050b08";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawCoverImage(ctx, playerImage, 0, 0, canvas.width, canvas.height);

  const topGradient = ctx.createLinearGradient(0, 0, 0, 420);
  topGradient.addColorStop(0, "rgba(0, 0, 0, 0.74)");
  topGradient.addColorStop(1, "rgba(0, 0, 0, 0.06)");
  ctx.fillStyle = topGradient;
  ctx.fillRect(0, 0, canvas.width, 420);

  const sideGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  sideGradient.addColorStop(0, "rgba(0, 0, 0, 0.38)");
  sideGradient.addColorStop(0.48, "rgba(0, 0, 0, 0)");
  sideGradient.addColorStop(1, "rgba(0, 0, 0, 0.38)");
  ctx.fillStyle = sideGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const bottomGradient = ctx.createLinearGradient(0, 740, 0, canvas.height);
  bottomGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  bottomGradient.addColorStop(0.48, "rgba(0, 0, 0, 0.72)");
  bottomGradient.addColorStop(1, "rgba(2, 6, 4, 0.96)");
  ctx.fillStyle = bottomGradient;
  ctx.fillRect(0, 740, canvas.width, canvas.height - 740);

  ctx.fillStyle = "#f4c431";
  ctx.font = "900 34px PingFang SC, sans-serif";
  ctx.fillText("测测你的命中球缘", 118, 92);
  ctx.fillStyle = "rgba(255, 253, 244, 0.82)";
  ctx.font = "800 24px PingFang SC, sans-serif";
  ctx.fillText(`${nickname} 的球场报告`, 118, 136);

  roundedRect(ctx, 760, 58, 198, 72, 36);
  ctx.fillStyle = "rgba(244, 196, 49, 0.94)";
  ctx.fill();
  ctx.fillStyle = "#10150e";
  ctx.font = "900 28px PingFang SC, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`能力值 ${profile.overall}`, 859, 104);
  ctx.textAlign = "left";

  ctx.fillStyle = "rgba(255, 253, 244, 0.9)";
  ctx.font = "900 34px PingFang SC, sans-serif";
  wrapText(ctx, contrast, 118, 1080, 760, 48, 2);

  ctx.fillStyle = "#fffdf4";
  const roleLength = Array.from(displayRole).length;
  const roleFontSize = Math.max(82, Math.min(112, Math.floor(760 / Math.max(roleLength, 5))));
  ctx.font = `900 ${roleFontSize}px PingFang SC, sans-serif`;
  const titleEndY = wrapText(ctx, displayRole, 118, 1198, 760, 118, 2);
  ctx.font = "900 42px PingFang SC, sans-serif";
  wrapText(ctx, player.summary, 120, titleEndY + 18, 760, 54, 2);

  let tagX = 118;
  [player.position, player.persona, player.extraTag].filter(Boolean).slice(0, 3).forEach((tag) => {
    tagX = drawCanvasChip(ctx, tag, tagX, 1426);
  });

  roundedRect(ctx, 96, 1514, 888, 306, 34);
  ctx.fillStyle = "rgba(8, 18, 14, 0.86)";
  ctx.fill();
  ctx.strokeStyle = "rgba(244, 196, 49, 0.34)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#f4c431";
  ctx.font = "900 34px PingFang SC, sans-serif";
  ctx.fillText("扫码开测", 132, 1586);
  ctx.fillStyle = "#fffdf4";
  ctx.font = "900 42px PingFang SC, sans-serif";
  wrapText(ctx, "看看你命里是哪种球场角色", 132, 1646, 520, 54, 2);
  ctx.font = "700 24px PingFang SC, sans-serif";
  ctx.fillStyle = "rgba(255, 253, 244, 0.66)";
  wrapText(ctx, safeUrl, 132, 1758, 500, 32, 2);

  roundedRect(ctx, 720, 1548, 226, 226, 20);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.drawImage(qrImage, 736, 1564, 194, 194);
  ctx.fillStyle = "rgba(255, 253, 244, 0.78)";
  ctx.font = "800 24px PingFang SC, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("一键生成你的命中球缘", 833, 1806);
  ctx.textAlign = "left";

  return new Promise((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (nextBlob) resolve(nextBlob);
      else reject(new Error("Canvas export failed"));
    }, "image/png", 0.95);
  });
}

function revokeSharePosterUrl() {
  if (!state.sharePosterUrl) return;
  URL.revokeObjectURL(state.sharePosterUrl);
  state.sharePosterUrl = "";
}

async function openSharePoster() {
  if (!state.currentResult) return;
  const blob = await buildSharePosterBlob();
  revokeSharePosterUrl();
  state.sharePosterBlob = blob;
  state.sharePosterUrl = URL.createObjectURL(blob);
  $("#share-poster").src = state.sharePosterUrl;
  $("#share-sheet").classList.add("open");
  $("#share-sheet").classList.remove("clean");
  $("#share-sheet").setAttribute("aria-hidden", "false");
  window.lastShareCardExport = {
    role: getDisplayRole(state.currentResult.player),
    size: blob.size,
    url: PRODUCT_URL,
    at: new Date().toISOString(),
  };
}

function closeSharePoster() {
  $("#share-sheet").classList.remove("open", "clean");
  $("#share-sheet").setAttribute("aria-hidden", "true");
}

function downloadPosterBlob() {
  if (!state.sharePosterBlob || !state.currentResult) return;
  const displayRole = getDisplayRole(state.currentResult.player);
  const safeRole = displayRole.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, "-");
  const link = document.createElement("a");
  const url = URL.createObjectURL(state.sharePosterBlob);
  link.href = url;
  link.download = `命中球缘-${safeRole}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadShareCard() {
  if (!state.sharePosterBlob) {
    state.sharePosterBlob = await buildSharePosterBlob();
  }
  downloadPosterBlob();
}

function updateSavedBox() {
  const savedBox = $("#saved-box");
  if (!savedBox) return;
  const saved = localStorage.getItem("footballBirthrightResult");
  if (!saved) return;
  const parsed = JSON.parse(saved);
  savedBox.innerHTML = `
    <span>已保存结果</span>
    <strong>已保存 ${parsed.role} · ${parsed.position}</strong>
  `;
}

async function init() {
  state.players = await loadPlayers();
  renderGallery();
  bindGalleryEvents();
  updateSavedBox();
  $("#reading-toggle")?.addEventListener("click", (event) => {
    event.preventDefault();
    const panel = $("#reading-panel");
    const button = event.currentTarget;
    const screen = $(".screen-result");
    const scrollTop = screen?.scrollTop || 0;
    setReadingPanelOpen(!panel?.classList.contains("open"));
    button.blur();
    requestAnimationFrame(() => {
      if (screen) screen.scrollTop = scrollTop;
    });
    setTimeout(() => {
      if (screen) screen.scrollTop = scrollTop;
    }, 260);
  });
  updateReadingPanelLabel();

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
  $("#open-gallery")?.addEventListener("click", () => showScreen("gallery"));
  $("#close-gallery").addEventListener("click", () => {
    showScreen(state.currentResult ? "result" : "form");
  });
  $("#share-close").addEventListener("click", closeSharePoster);
  $("#share-clean-mode").addEventListener("click", () => {
    $("#share-sheet").classList.add("clean");
  });
  $("#share-poster-wrap").addEventListener("click", () => {
    $("#share-sheet").classList.remove("clean");
  });
  $("#download-poster").addEventListener("click", async () => {
    const button = $("#download-poster");
    button.textContent = "下载中";
    button.disabled = true;
    try {
      await downloadShareCard();
      button.textContent = "已触发";
    } catch (error) {
      console.error(error);
      button.textContent = "下载失败";
    } finally {
      setTimeout(() => {
        button.textContent = "下载图片";
        button.disabled = false;
      }, 1000);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSharePoster();
  });
  $("#save-result").addEventListener("click", async () => {
    if (!state.currentResult) return;
    const { player, profile } = state.currentResult;
    const saved = {
      resultId: player.id,
      role: getDisplayRole(player),
      position: player.position,
      persona: player.persona || profile.persona,
      image: player.image,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem("footballBirthrightResult", JSON.stringify(saved));
    updateSavedBox();
    const button = $("#save-result");
    button.textContent = "生成中";
    button.disabled = true;
    try {
      await openSharePoster();
      button.textContent = "可以分享了";
    } catch (error) {
      console.error(error);
      button.textContent = "生成失败";
    } finally {
      setTimeout(() => {
        button.textContent = "分享给你的朋友";
        button.disabled = false;
      }, 1200);
    }
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get("auto") === "1") {
    const result = buildResult(getFormData());
    renderResult(result);
    showScreen("result");
  }
  if (params.get("gallery") === "1" && params.get("internal") === "1") {
    showScreen("gallery");
  }
  if (/\/library\/?$/u.test(window.location.pathname)) {
    showScreen("gallery");
  }
}


init().catch((error) => {
  console.error(error);
  $("#loading-line").textContent = "素材读取失败，请从本地服务器打开预览。";
});
