import { gradeFromPercent, gradeLabel, labelMode } from "./common.js";

export function createHistoryModule({ state, elements, persistHistory }) {
  function recordSession(session, direction) {
    const total = Math.max(0, Number(session.questions?.length) || 0);
    const correct = Math.max(0, Number(session.correct) || 0);
    const wrong = Math.max(0, Number(session.wrong) || Math.max(0, total - correct));
    const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
    const grade = gradeFromPercent(percent);

    const entry = {
      date: new Date().toISOString(),
      mode: session.mode,
      direction,
      total,
      correct,
      wrong,
      points: Math.max(0, Number(session.points) || 0),
      durationSeconds: Math.max(0, Math.round(Number(session.durationSeconds) || 0)),
      rewardBonusPoints: Math.max(0, Number(session.rewardBonusPoints) || 0),
      weekKey: typeof session.weekKey === "string" ? session.weekKey : "",
      percent,
      grade
    };

    state.history.unshift(entry);
    state.history = state.history.slice(0, 60);
    persistHistory();

    return entry;
  }

  function renderSummary(result, wrongItems) {
    elements.summaryPanel.classList.remove("hidden");
    elements.summaryGrid.innerHTML = "";

    const cards = [
      ["Richtig", String(result.correct)],
      ["Falsch", String(result.wrong)],
      ["Trefferquote", `${result.percent}%`],
      ["Punkte", String(result.points)],
      ["Zeit", formatDuration(result.durationSeconds)],
      ["Modus", labelMode(result.mode)]
    ];

    cards.forEach(([key, value]) => {
      const box = document.createElement("article");
      box.className = "stat-box";
      box.innerHTML = `<p class="k">${key}</p><p class="v">${value}</p>`;
      elements.summaryGrid.append(box);
    });

    elements.gradeText.textContent = `Note: ${result.grade} (${gradeLabel(result.grade)})`;

    elements.mistakeList.innerHTML = "";
    if (wrongItems.length === 0) {
      const item = document.createElement("li");
      item.textContent = "Keine Fehler in dieser Runde.";
      elements.mistakeList.append(item);
      return;
    }

    wrongItems.forEach((itemData) => {
      const item = document.createElement("li");
      item.textContent = `${itemData.prompt} -> ${itemData.expected}`;
      elements.mistakeList.append(item);
    });
  }

  function renderHistory() {
    const history = normalizeHistoryForView(state.history);
    if (history.changed) {
      state.history = history.items;
      persistHistory();
    }

    const safeHistory = history.items;

    elements.historyGrid.innerHTML = "";
    elements.recentRunsList.innerHTML = "";

    if (safeHistory.length === 0) {
      const box = document.createElement("article");
      box.className = "stat-box";
      box.innerHTML = `<p class="k">Verlauf</p><p class="v">Noch keine Runde</p>`;
      elements.historyGrid.append(box);

      const item = document.createElement("li");
      item.className = "recent-item";
      item.textContent = "Sobald du die erste Runde abschließt, erscheint sie hier.";
      elements.recentRunsList.append(item);
      return;
    }

    const rounds = safeHistory.length;
    const avgPercent = Math.round(
      safeHistory.reduce((sum, item) => sum + item.percent, 0) / rounds
    );
    const avgGrade = (
      safeHistory.reduce((sum, item) => sum + item.grade, 0) / rounds
    ).toFixed(2);
    const bestRun = Math.max(0, ...safeHistory.map((item) => item.correct));
    const totalAnswered = safeHistory.reduce((sum, item) => sum + item.total, 0);
    const totalDurationSeconds = safeHistory.reduce(
      (sum, item) => sum + Math.max(0, Number(item.durationSeconds) || 0),
      0
    );

    const cards = [
      ["Runden", String(rounds)],
      ["Ø Trefferquote", `${avgPercent}%`],
      ["Ø Note", avgGrade],
      ["Bester Durchlauf", `${bestRun} richtig`],
      ["Antworten gesamt", String(totalAnswered)],
      ["Trainingszeit", formatDuration(totalDurationSeconds)]
    ];

    cards.forEach(([key, value]) => {
      const box = document.createElement("article");
      box.className = "stat-box";
      box.innerHTML = `<p class="k">${key}</p><p class="v">${value}</p>`;
      elements.historyGrid.append(box);
    });

    safeHistory.slice(0, 8).forEach((run) => {
      const item = document.createElement("li");
      item.className = "recent-item";
      item.innerHTML = `
        <p class="recent-head">${formatRunDate(run.date)} · ${labelMode(run.mode)}</p>
        <p>${run.correct}/${run.total} richtig · ${run.percent}% · Note ${run.grade}</p>
        <p class="recent-sub">Richtung: ${String(run.direction || "--").toUpperCase()} · Punkte: ${run.points} · Zeit: ${formatDuration(run.durationSeconds)}</p>
      `;
      elements.recentRunsList.append(item);
    });
  }

  return {
    recordSession,
    renderSummary,
    renderHistory
  };
}

function normalizeHistoryForView(history) {
  if (!Array.isArray(history)) {
    return { items: [], changed: true };
  }

  let changed = false;
  const items = history.map((entry) => {
    const source = entry && typeof entry === "object" ? entry : {};
    const total = Math.max(0, Number(source.total) || 0);
    const correct = Math.max(0, Math.min(total, Number(source.correct) || 0));
    const wrongFromEntry = Number(source.wrong);
    const wrong = Math.max(
      0,
      Number.isFinite(wrongFromEntry) ? Math.round(wrongFromEntry) : Math.max(0, total - correct)
    );
    const computedPercent = total > 0 ? Math.round((correct / total) * 100) : 0;
    const percent = Number.isFinite(Number(source.percent)) ? Math.max(0, Math.min(100, Math.round(Number(source.percent)))) : computedPercent;
    const gradeFromEntry = Number(source.grade);
    const grade = Number.isFinite(gradeFromEntry) && gradeFromEntry >= 1 && gradeFromEntry <= 6
      ? Math.round(gradeFromEntry)
      : gradeFromPercent(percent);

    const normalized = {
      date: typeof source.date === "string" ? source.date : new Date().toISOString(),
      mode: source.mode === "learn" || source.mode === "quiz" || source.mode === "test" ? source.mode : "test",
      direction: typeof source.direction === "string" ? source.direction : "en-de",
      total,
      correct,
      wrong,
      points: Math.max(0, Number(source.points) || 0),
      durationSeconds: Math.max(0, Math.round(Number(source.durationSeconds) || 0)),
      rewardBonusPoints: Math.max(0, Number(source.rewardBonusPoints) || 0),
      weekKey: typeof source.weekKey === "string" ? source.weekKey : "",
      percent,
      grade
    };

    if (
      normalized.date !== source.date ||
      normalized.mode !== source.mode ||
      normalized.direction !== source.direction ||
      normalized.total !== source.total ||
      normalized.correct !== source.correct ||
      normalized.wrong !== source.wrong ||
      normalized.points !== source.points ||
      normalized.durationSeconds !== source.durationSeconds ||
      normalized.rewardBonusPoints !== source.rewardBonusPoints ||
      normalized.weekKey !== source.weekKey ||
      normalized.percent !== source.percent ||
      normalized.grade !== source.grade
    ) {
      changed = true;
    }

    return normalized;
  });

  return { items, changed };
}

function formatDuration(valueSeconds) {
  const seconds = Math.max(0, Math.round(Number(valueSeconds) || 0));
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes} min`;
  }
  return `${hours} h ${minutes} min`;
}

function formatRunDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unbekannt";
  }

  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
