const STORAGE_KEY = "m365-copilot-leaderboard-v1";

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

processButton.addEventListener("click", processImport);
exportButton.addEventListener("click", exportLeaderboard);
resetButton.addEventListener("click", resetScores);
undoImportButton.addEventListener("click", undoLastImport);

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

  if (!state.history.length) {
    importSummary.innerHTML = "No upload yet. Drop in today's export and the dashboard will score reacted messages automatically.";
  }
}

function renderHeroBadges() {
  const totalPoints = Object.values(state.scores).reduce((sum, score) => sum + score, 0);
  const leader = getSortedRoster()[0];
  const uploads = state.history.length;

  heroBadges.innerHTML = [
    createHeroBadge("Total points", totalPoints.toString()),
    createHeroBadge("Daily uploads", uploads.toString()),
    createHeroBadge("Current leader", leader ? leader.name.split(" ")[0] : "Ready")
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
    const profileTitle = node.querySelector(".profile-title");
    const scorePill = node.querySelector(".score-pill");

    avatar.textContent = getInitials(person.name);
    avatar.style.background = `linear-gradient(135deg, ${person.colors[0]}, ${person.colors[1]})`;
    personName.textContent = person.name;
    profileTitle.textContent = person.profile;
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