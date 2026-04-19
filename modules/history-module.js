import { gradeFromPercent, gradeLabel, labelMode } from "./common.js";

export function createHistoryModule({ state, elements, persistHistory }) {
  function recordSession(session, direction) {
    const total = session.questions.length;
    const percent = Math.round((session.correct / total) * 100);
    const grade = gradeFromPercent(percent);

    const entry = {
      date: new Date().toISOString(),
      mode: session.mode,
      direction,
      total,
      correct: session.correct,
      wrong: session.wrong,
      points: session.points,
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
    elements.historyGrid.innerHTML = "";
    elements.recentRunsList.innerHTML = "";

    if (state.history.length === 0) {
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

    const rounds = state.history.length;
    const avgPercent = Math.round(
      state.history.reduce((sum, item) => sum + item.percent, 0) / rounds
    );
    const avgGrade = (
      state.history.reduce((sum, item) => sum + item.grade, 0) / rounds
    ).toFixed(2);
    const bestRun = Math.max(...state.history.map((item) => item.correct));
    const totalAnswered = state.history.reduce((sum, item) => sum + item.total, 0);
    const totalDurationSeconds = state.history.reduce(
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

    state.history.slice(0, 8).forEach((run) => {
      const item = document.createElement("li");
      item.className = "recent-item";
      item.innerHTML = `
        <p class="recent-head">${formatRunDate(run.date)} · ${labelMode(run.mode)}</p>
        <p>${run.correct}/${run.total} richtig · ${run.percent}% · Note ${run.grade}</p>
        <p class="recent-sub">Richtung: ${run.direction.toUpperCase()} · Punkte: ${run.points} · Zeit: ${formatDuration(run.durationSeconds)}</p>
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
