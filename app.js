const STORAGE_KEY = "frontier-agents-leaderboard-v3";

const roster = [
  { name: "Amrita Srivastava", profile: "Momentum Maven", colors: ["#ff7a18", "#ef476f"] },
  { name: "Ajay Barun", profile: "Signal Sprinter", colors: ["#118ab2", "#06d6a0"] },
  { name: "Ambikesh Mishra", profile: "Pattern Pilot", colors: ["#8e54e9", "#4776e6"] },
  { name: "Akash Dwivedi", profile: "Prompt Pathfinder", colors: ["#f857a6", "#ff5858"] },
  { name: "Antariksh Shahwal", profile: "Orbit Optimist", colors: ["#00c6ff", "#0072ff"] },
  { name: "Deepika Sharma", profile: "Insight Spark", colors: ["#f7971e", "#ffd200"] },
  { name: "Karanmeet Singh", profile: "Cheer Captain", colors: ["#43cea2", "#185a9d"] },
  { name: "Mallikarjunaswamy Mahadevappa", profile: "Steady Storm", colors: ["#7f00ff", "#e100ff"] },
  { name: "Murugesan U", profile: "Reaction Radar", colors: ["#3a1c71", "#d76d77"] },
  { name: "Namrata Chaurasia", profile: "Velocity Vibe", colors: ["#ff512f", "#dd2476"] },
  { name: "Perinbaraj Thangavel", profile: "North Star", colors: ["#11998e", "#38ef7d"] },
  { name: "Rajat Srivastava", profile: "Idea Igniter", colors: ["#fc4a1a", "#f7b733"] },
  { name: "Sankha Chakraborty", profile: "Curiosity Circuit", colors: ["#654ea3", "#eaafc8"] },
  { name: "Sapna Giddegowda", profile: "Sunrise Strategist", colors: ["#f953c6", "#b91d73"] }
];

const nameLookup = new Map(roster.map((person) => [normalizeName(person.name), person.name]));

const state = loadState();

const heroBadges = document.getElementById("heroBadges");
const leaderboard = document.getElementById("leaderboard");
const activityFeed = document.getElementById("activityFeed");
const importSummary = document.getElementById("importSummary");
const importFile = document.getElementById("importFile");
const pasteArea = document.getElementById("pasteArea");
const processButton = document.getElementById("processButton");
const exportButton = document.getElementById("exportButton");
const resetButton = document.getElementById("resetButton");
const undoImportButton = document.getElementById("undoImportButton");
const leaderboardItemTemplate = document.getElementById("leaderboardItemTemplate");

if (processButton) {
  processButton.addEventListener("click", processImport);
}

if (exportButton) {
  exportButton.addEventListener("click", exportLeaderboard);
}

if (resetButton) {
  resetButton.addEventListener("click", resetScores);
}

if (undoImportButton) {
  undoImportButton.addEventListener("click", undoLastImport);
}

initVisualEffects();

render();

function loadState() {
  const emptyState = {
    scores: Object.fromEntries(roster.map((person) => [person.name, 0])),
    history: []
  };

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return emptyState;
    }

    const parsed = JSON.parse(saved);
    return {
      scores: { ...emptyState.scores, ...(parsed.scores || {}) },
      history: Array.isArray(parsed.history) ? parsed.history : []
    };
  } catch {
    return emptyState;
  }
}

function saveState() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  renderHeroBadges();
  renderLeaderboard();
  renderActivity();

  if (importSummary && !state.history.length) {
    importSummary.innerHTML = "No upload yet. Drop in today's export and the dashboard will score reacted messages automatically.";
  }
}

function renderHeroBadges() {
  if (!heroBadges) {
    return;
  }

  const leader = getSortedRoster()[0];
  const highestScore = leader ? state.scores[leader.name] || 0 : 0;

  heroBadges.innerHTML = [
    createHeroBadge("Current leader", highestScore > 0 ? leader.name.split(" ")[0] : "Standby")
  ].join("");
}

function createHeroBadge(label, value) {
  return `<div class="hero-badge"><span>${label}</span><strong>${value}</strong></div>`;
}

function renderLeaderboard() {
  const fragment = document.createDocumentFragment();
  const sortedPeople = getSortedRoster();

  sortedPeople.forEach((person) => {
    const node = leaderboardItemTemplate.content.firstElementChild.cloneNode(true);
    const avatar = node.querySelector(".avatar");
    const personName = node.querySelector(".person-name");
    const scorePill = node.querySelector(".score-pill");

    avatar.textContent = getInitials(person.name);
    avatar.style.background = `linear-gradient(135deg, ${person.colors[0]}, ${person.colors[1]})`;
    personName.textContent = person.name;
    scorePill.textContent = `${state.scores[person.name] || 0} pts`;

    fragment.appendChild(node);
  });

  leaderboard.replaceChildren(fragment);
}

function renderActivity() {
  activityFeed.innerHTML = "";

  if (!state.history.length) {
    activityFeed.innerHTML = '<div class="empty-state">No imports recorded yet. Your daily uploads will appear here with the points awarded.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  [...state.history]
    .sort((left, right) => new Date(right.importedAt).getTime() - new Date(left.importedAt).getTime())
    .forEach((entry) => {
      const card = document.createElement("article");
      card.className = "activity-card";
      card.innerHTML = `
        <div>
          <div class="activity-source">${escapeHtml(entry.source)}</div>
          <div class="activity-meta">${new Date(entry.importedAt).toLocaleString()} • ${entry.rowsAwarded} reacted messages</div>
        </div>
        <strong>+${entry.pointsAwarded} pts</strong>
      `;
      fragment.appendChild(card);
    });

  activityFeed.appendChild(fragment);
}

function processImport() {
  const file = importFile.files[0];
  const pastedValue = pasteArea.value.trim();

  if (!file && !pastedValue) {
    setSummary("Upload a CSV or JSON file, or paste a daily export first.", true);
    return;
  }

  if (file) {
    const reader = new FileReader();
    reader.onload = () => applyImport(reader.result, file.name);
    reader.onerror = () => setSummary("The selected file could not be read.", true);
    reader.readAsText(file);
    return;
  }

  applyImport(pastedValue, "Pasted daily upload");
}

function applyImport(rawText, sourceName) {
  let rows;

  try {
    rows = parseUpload(rawText);
  } catch (error) {
    setSummary(error.message || "The upload format could not be parsed.", true);
    return;
  }

  const matchedAwards = [];

  rows.forEach((row) => {
    const matchedName = findRosterName(row);
    const reactionCount = getReactionCount(row);

    if (!matchedName || reactionCount < 1) {
      return;
    }

    state.scores[matchedName] = (state.scores[matchedName] || 0) + 5;
    matchedAwards.push({ name: matchedName, points: 5 });
  });

  if (!matchedAwards.length) {
    setSummary("No matching reacted messages were found. Check that the upload includes a known name column and a reaction column.", true);
    return;
  }

  const historyEntry = {
    source: sourceName,
    importedAt: new Date().toISOString(),
    rowsAwarded: matchedAwards.length,
    pointsAwarded: matchedAwards.length * 5,
    awards: matchedAwards
  };

  state.history.push(historyEntry);
  saveState();
  importFile.value = "";
  pasteArea.value = "";

  const spotlight = summarizeAwards(matchedAwards);
  setSummary(`Imported ${matchedAwards.length} reacted messages from ${sourceName}. ${historyEntry.pointsAwarded} points awarded. ${spotlight}`);
  render();
}

function parseUpload(rawText) {
  const trimmed = String(rawText).trim();

  if (!trimmed) {
    throw new Error("The upload is empty.");
  }

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (Array.isArray(parsed.items)) {
      return parsed.items;
    }

    throw new Error("JSON uploads must be an array or contain an items array.");
  }

  return parseCsv(trimmed);
}

function parseCsv(rawText) {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV uploads must include a header row and at least one data row.");
  }

  const headers = splitCsvLine(lines[0]).map(normalizeKey);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function findRosterName(row) {
  const nameValue = getField(row, [
    "name",
    "author",
    "user",
    "sender",
    "messageauthor",
    "postedby",
    "owner"
  ]);

  if (!nameValue) {
    return null;
  }

  const normalized = normalizeName(String(nameValue));
  return nameLookup.get(normalized) || null;
}

function getReactionCount(row) {
  const value = getField(row, [
    "reactions",
    "reaction",
    "reactioncount",
    "likes",
    "emoji",
    "emojicount",
    "totalreactions"
  ]);

  if (value == null || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.length;
  }

  const numericValue = Number(value);
  if (!Number.isNaN(numericValue)) {
    return numericValue;
  }

  const asText = String(value).trim();
  if (!asText) {
    return 0;
  }

  return asText.split(/[|,;]+/).filter(Boolean).length;
}

function getField(row, candidates) {
  const keys = Object.keys(row || {});
  for (const candidate of candidates) {
    const matchedKey = keys.find((key) => normalizeKey(key) === candidate);
    if (matchedKey) {
      return row[matchedKey];
    }
  }
  return null;
}

function resetScores() {
  if (!window.confirm("Reset all scores and import history?")) {
    return;
  }

  roster.forEach((person) => {
    state.scores[person.name] = 0;
  });
  state.history = [];
  saveState();
  setSummary("Scores and history were reset.");
  render();
}

function undoLastImport() {
  const lastImport = state.history[state.history.length - 1];

  if (!lastImport) {
    setSummary("There is no import to undo.", true);
    return;
  }

  lastImport.awards.forEach((award) => {
    state.scores[award.name] = Math.max(0, (state.scores[award.name] || 0) - award.points);
  });

  state.history.pop();
  saveState();
  setSummary(`Undid the last import from ${lastImport.source}.`);
  render();
}

function exportLeaderboard() {
  const payload = getSortedRoster().map((person, index) => ({
    rank: index + 1,
    name: person.name,
    profile: person.profile,
    score: state.scores[person.name] || 0
  }));

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "leaderboard.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function getSortedRoster() {
  return [...roster].sort((left, right) => {
    const scoreDelta = (state.scores[right.name] || 0) - (state.scores[left.name] || 0);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    return left.name.localeCompare(right.name);
  });
}

function summarizeAwards(awards) {
  const grouped = awards.reduce((accumulator, award) => {
    accumulator[award.name] = (accumulator[award.name] || 0) + award.points;
    return accumulator;
  }, {});

  return Object.entries(grouped)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([name, points]) => `${name.split(" ")[0]} +${points}`)
    .join(" • ");
}

function setSummary(message, isError = false) {
  if (!importSummary) {
    return;
  }

  importSummary.textContent = message;
  importSummary.style.borderColor = isError ? "rgba(239, 71, 111, 0.35)" : "rgba(56, 182, 164, 0.25)";
  importSummary.style.background = isError ? "rgba(255, 240, 244, 0.92)" : "rgba(240, 255, 250, 0.92)";
}

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function normalizeName(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeKey(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function initVisualEffects() {
  if (window.Parallax) {
    new window.Parallax(document.getElementById("parallaxScene"), {
      relativeInput: true,
      hoverOnly: true,
      frictionX: 0.08,
      frictionY: 0.08
    });
  }

  if (!window.THREE) {
    return;
  }

  const container = document.getElementById("sceneCanvas");
  const scene = new window.THREE.Scene();
  const camera = new window.THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new window.THREE.WebGLRenderer({ alpha: true, antialias: true });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const geometry = new window.THREE.TorusKnotGeometry(8, 2.2, 180, 32);
  const material = new window.THREE.MeshPhysicalMaterial({
    color: 0x6df7ff,
    emissive: 0x123d75,
    roughness: 0.24,
    metalness: 0.78,
    transparent: true,
    opacity: 0.34
  });
  const knot = new window.THREE.Mesh(geometry, material);
  knot.position.set(20, 10, -42);
  scene.add(knot);

  const ring = new window.THREE.Mesh(
    new window.THREE.TorusGeometry(18, 0.35, 24, 100),
    new window.THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.32 })
  );
  ring.position.set(-26, -10, -60);
  ring.rotation.x = 1.2;
  scene.add(ring);

  const particles = new window.THREE.BufferGeometry();
  const particleCount = 180;
  const positions = new Float32Array(particleCount * 3);

  for (let index = 0; index < particleCount; index += 1) {
    positions[index * 3] = (Math.random() - 0.5) * 140;
    positions[index * 3 + 1] = (Math.random() - 0.5) * 90;
    positions[index * 3 + 2] = (Math.random() - 0.5) * 110;
  }

  particles.setAttribute("position", new window.THREE.BufferAttribute(positions, 3));
  const particleMaterial = new window.THREE.PointsMaterial({
    color: 0x6df7ff,
    size: 0.9,
    transparent: true,
    opacity: 0.55
  });
  const particleField = new window.THREE.Points(particles, particleMaterial);
  scene.add(particleField);

  scene.add(new window.THREE.AmbientLight(0x9cdcff, 0.55));

  const pointLight = new window.THREE.PointLight(0x26ffd4, 22, 220);
  pointLight.position.set(12, 18, 28);
  scene.add(pointLight);

  const fillLight = new window.THREE.PointLight(0x8b5cf6, 16, 180);
  fillLight.position.set(-22, -10, 20);
  scene.add(fillLight);

  camera.position.z = 54;

  const animate = () => {
    knot.rotation.x += 0.0022;
    knot.rotation.y += 0.0034;
    ring.rotation.z += 0.0025;
    particleField.rotation.y += 0.0009;
    renderer.render(scene, camera);
    window.requestAnimationFrame(animate);
  };

  animate();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}