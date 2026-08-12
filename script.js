"use strict";

const STORAGE_KEY = "wordspark-data-v1";
const SOUND_SETTINGS_KEY = "wordspark-sound-settings-v1";
const icons = ["🐶", "🍎", "🏫", "🌍", "🎨", "⭐"];

const demoData = {
  sets: [{
    id: "animals-demo",
    name: "Animals",
    icon: "🐶",
    words: [
      ["dog", "собака"], ["cat", "кошка"], ["rabbit", "кролик"], ["bear", "медведь"], ["fox", "лиса"],
      ["wolf", "волк"], ["elephant", "слон"], ["monkey", "обезьяна"], ["lion", "лев"], ["tiger", "тигр"]
    ].map(([english, translation], index) => ({ id: `animal-${index}`, english, translation, mistakeCount: 0, correctStreak: 0, learned: false }))
  }],
  sessions: 0
};

let data = loadData();
let session = null;
const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const confirmDialog = document.querySelector("#confirm-dialog");
const nameDialog = document.querySelector("#name-dialog");
const soundDialog = document.querySelector("#sound-dialog");

const soundFiles = {
  click: "assets/sounds/click.mp3", flip: "assets/sounds/flip.mp3",
  correct: "assets/sounds/correct.mp3", wrong: "assets/sounds/wrong.mp3",
  next: "assets/sounds/next.mp3", reward: "assets/sounds/reward.mp3",
  complete: "assets/sounds/complete.mp3", sparky: "assets/sounds/sparky.mp3"
};
const fallbackSoundNotes = {
  click: [520], flip: [390, 570], correct: [523, 659, 784], wrong: [310, 245],
  next: [440, 600], reward: [659, 784, 988], complete: [523, 659, 784, 1047], sparky: [740, 988]
};
let soundSettings = loadSoundSettings();
let activeEffect = null;
let audioContext = null;
let lastSoundAt = 0;

function loadSoundSettings() {
  try { return { enabled: true, volume: 0.35, ...JSON.parse(localStorage.getItem(SOUND_SETTINGS_KEY) || "{}") }; }
  catch (_) { return { enabled: true, volume: 0.35 }; }
}

function saveSoundSettings() {
  localStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(soundSettings));
}

// Every interface effect passes through this function. Pronunciation uses a separate API.
function playSound(soundName) {
  if (!soundSettings.enabled || soundSettings.volume <= 0 || !fallbackSoundNotes[soundName]) return;
  const now = performance.now();
  if (activeEffect === soundName && now - lastSoundAt < 90) return;
  activeEffect = soundName; lastSoundAt = now;

  const fileAudio = new Audio(soundFiles[soundName]);
  fileAudio.volume = soundSettings.volume;
  fileAudio.play().catch(() => playSynthesizedSound(soundName));
}

function playSynthesizedSound(soundName) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext ||= new AudioContextClass();
  const notes = fallbackSoundNotes[soundName];
  const start = audioContext.currentTime;
  notes.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const noteStart = start + index * 0.075;
    oscillator.type = soundName === "wrong" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, soundSettings.volume * 0.12), noteStart + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.11);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(noteStart); oscillator.stop(noteStart + 0.12);
  });
}

function loadData() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && Array.isArray(stored.sets)) return stored;
  } catch (error) {
    console.warn("WordSpark could not read saved data:", error);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(demoData));
  return JSON.parse(JSON.stringify(demoData));
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function makeId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const speechIsAvailable = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

// Pronounce one English word or phrase without allowing utterances to overlap.
function speakEnglishWord(word) {
  if (!speechIsAvailable || !word) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  utterance.pitch = 1;

  const voices = window.speechSynthesis.getVoices();
  const preferredNames = /natural|samantha|ava|jenny|aria|guy|google|microsoft/i;
  utterance.voice = voices.find(voice => /^en-US$/i.test(voice.lang) && preferredNames.test(voice.name))
    || voices.find(voice => /^en-US$/i.test(voice.lang))
    || voices.find(voice => /^en\b/i.test(voice.lang))
    || null;
  window.speechSynthesis.speak(utterance);
}

function pronunciationButton(word, label = word) {
  if (!speechIsAvailable) return "";
  return `<button class="pronounce-button" type="button" data-pronounce="${escapeHtml(word)}" aria-label="Pronounce ${escapeHtml(label)}" title="Pronounce English word">🔊</button>`;
}

function bindPronunciationButtons(container = document) {
  container.querySelectorAll("[data-pronounce]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      speakEnglishWord(button.dataset.pronounce);
    });
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function render(content, pageClass = "") {
  document.body.classList.toggle("training-menu-page", pageClass === "training-menu");
  document.body.classList.toggle("flashcard-page", pageClass === "flashcard");
  document.body.classList.toggle("multiple-choice-page", pageClass === "multiple-choice");
  document.body.classList.toggle("write-word-page", pageClass === "write-word");
  app.innerHTML = `<div class="screen">${content}</div>`;
  window.scrollTo({ top: 0, behavior: "smooth" });
  app.focus({ preventScroll: true });
}

function totals() {
  const words = data.sets.flatMap(set => set.words);
  return {
    total: words.length,
    learned: words.filter(word => word.learned).length,
    difficult: words.filter(word => word.mistakeCount > 0).length
  };
}

function renderHome() {
  session = null;
  const stats = totals();
  const colorThemes = ["green", "blue", "purple", "pink"];
  const cards = data.sets.length ? data.sets.map((set, index) => {
    const learned = set.words.filter(word => word.learned).length;
    const progress = set.words.length ? Math.round((learned / set.words.length) * 100) : 0;
    return `
    <article class="set-card theme-${colorThemes[index % colorThemes.length]}">
      <div class="set-menu"><button class="edit-set" data-id="${set.id}" aria-label="Edit ${escapeHtml(set.name)}">•••</button></div>
      <div class="set-icon" aria-hidden="true">${escapeHtml(set.icon || "⭐")}</div>
      <h3>${escapeHtml(set.name)}</h3>
      <p>${set.words.length} ${set.words.length === 1 ? "word" : "words"}</p>
      <div class="set-progress"><div><span class="set-progress-fill" data-width="${progress}"></span></div><strong>${progress}%</strong></div>
      <div class="card-actions">
        <button class="button start-set" data-id="${set.id}">Let's Go! <span>→</span></button>
        <button class="button danger icon-button delete-set" data-id="${set.id}" aria-label="Delete ${escapeHtml(set.name)}" title="Delete">×</button>
      </div>
    </article>`;
  }).join("") : `<div class="empty-state"><h3>No word sets yet</h3><p>Create your first set and start learning.</p></div>`;

  render(`
    <section class="hero" id="home-section">
      <div class="hero-copy"><p class="eyebrow">Your learning adventure</p><h1>Welcome back${data.userName ? `, ${escapeHtml(data.userName)}` : ""}! <span aria-hidden="true">👋</span></h1><p>Ready to learn new words today?</p>
        <div class="hero-badges"><div><span>⭐</span><strong>${stats.learned * 10} XP</strong><small>Total Experience</small></div><div><span>🔥</span><strong>${data.sessions || 0}</strong><small>Training Sessions</small></div></div>
      </div>
      <div class="hero-mascot"><span class="sparkle s1">✦</span><span class="sparkle s2">★</span><img src="assets/sparky.png" alt="Sparky waves while holding a vocabulary book"><div class="speech-bubble">Let's make your<br>vocabulary shine! ⭐</div></div>
    </section>
    <div class="dashboard-grid">
      <section aria-labelledby="sets-title" id="sets-section" class="sets-area">
        <div class="section-heading"><div><h2 id="sets-title">My Word Sets</h2><p class="muted">Pick a collection and keep your streak alive.</p></div><button class="button" id="create-set">＋ Create New Set</button></div>
        <div class="card-grid">${cards}<button class="create-card" id="create-card"><span>＋</span><strong>Create<br>New Set</strong></button></div>
        <div class="motivation-strip"><img src="assets/sparky.png" alt=""><p>Small steps every day<br><strong>create big results!</strong></p><span>learn ⭐</span><span>practice ♥</span><span>remember ✦</span></div>
      </section>
      <aside class="dashboard-side" id="stats-section">
        <section class="progress-card"><h3>📚 Vocabulary Progress</h3><div class="donut" data-progress="${stats.total ? Math.round(stats.learned / stats.total * 100) : 0}"><strong>${stats.total ? Math.round(stats.learned / stats.total * 100) : 0}%</strong></div><dl><div><dt>Total words</dt><dd>${stats.total}</dd></div><div><dt><i class="dot learned"></i>Learned</dt><dd>${stats.learned}</dd></div><div><dt><i class="dot practice"></i>To practice</dt><dd>${stats.difficult}</dd></div><div><dt><i class="dot new"></i>New</dt><dd>${stats.total - stats.learned}</dd></div></dl></section>
        <section class="quick-card"><h3>⚡ Quick Start</h3><p>Jump right into learning!</p><button class="quick-start" ${data.sets.length ? "" : "disabled"}>▶ Start Training</button></section>
        <section class="goal-card"><h3>🎯 Daily Goal</h3><p>Learn 10 new words today</p><div class="goal-row"><div><span data-goal="${Math.min(stats.learned, 10)}"></span></div><strong>${Math.min(stats.learned, 10)} / 10</strong><b>🏆</b></div></section>
      </aside>
    </div>
    <footer>© 2026 WordSpark · Learn · Practice · Remember <span>♥</span></footer>`);

  document.querySelectorAll(".set-progress-fill").forEach(bar => { bar.style.width = `${bar.dataset.width}%`; });
  const donut = document.querySelector(".donut");
  donut.style.setProperty("--value", `${donut.dataset.progress * 3.6}deg`);
  const goal = document.querySelector("[data-goal]");
  goal.style.width = `${goal.dataset.goal * 10}%`;

  document.querySelector("#create-set").addEventListener("click", () => renderSetForm());
  document.querySelector("#create-card").addEventListener("click", () => renderSetForm());
  document.querySelector(".quick-start").addEventListener("click", () => data.sets[0] && renderTrainingMenu(data.sets[0].id));
  document.querySelectorAll(".start-set").forEach(button => button.addEventListener("click", () => renderTrainingMenu(button.dataset.id)));
  document.querySelectorAll(".edit-set").forEach(button => button.addEventListener("click", () => renderSetForm(button.dataset.id)));
  document.querySelectorAll(".delete-set").forEach(button => button.addEventListener("click", () => confirmDeleteSet(button.dataset.id)));
  if (!data.userName) requestAnimationFrame(showNameDialog);
}

function openSoundSettings() {
  const enabled = document.querySelector("#sound-enabled");
  const volume = document.querySelector("#sound-volume");
  enabled.checked = soundSettings.enabled;
  volume.value = Math.round(soundSettings.volume * 100);
  document.querySelector("#sound-volume-output").value = `${volume.value}%`;
  soundDialog.showModal();
}

document.querySelector("#sound-enabled").addEventListener("change", event => {
  soundSettings.enabled = event.target.checked;
  saveSoundSettings();
  if (soundSettings.enabled) playSound("click");
});
document.querySelector("#sound-volume").addEventListener("input", event => {
  soundSettings.volume = Number(event.target.value) / 100;
  document.querySelector("#sound-volume-output").value = `${event.target.value}%`;
  saveSoundSettings();
});
document.querySelector("#sound-volume").addEventListener("change", () => playSound("click"));

// Generic UI click feedback. Training controls have their own meaningful effects.
document.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button || button.disabled || button.matches(".choice, .flash-answer, #next-question, #check-answer, [data-pronounce]")) return;
  playSound("click");
});

function showNameDialog() {
  if (!nameDialog.open) nameDialog.showModal();
  requestAnimationFrame(() => document.querySelector("#learner-name").focus());
}

document.querySelector("#name-form").addEventListener("submit", event => {
  event.preventDefault();
  const input = document.querySelector("#learner-name");
  const name = input.value.trim();
  if (!name) {
    document.querySelector("#name-error").textContent = "Please enter your name.";
    input.focus();
    return;
  }
  data.userName = name;
  saveData();
  nameDialog.close();
  renderHome();
  showToast(`Nice to meet you, ${name}!`);
});
nameDialog.addEventListener("cancel", event => event.preventDefault());

function renderSetForm(setId = null) {
  const set = setId ? data.sets.find(item => item.id === setId) : null;
  const initialWords = set ? set.words : [{ english: "", translation: "" }, { english: "", translation: "" }];
  render(`
    <div class="topline"><button class="back-button" id="form-back" aria-label="Back to word sets">←</button><div><p class="eyebrow">Word set</p><h1>${set ? "Edit Set" : "Create New Set"}</h1></div></div>
    <form class="panel" id="set-form" novalidate>
      <div class="field"><label for="set-name">Set Name</label><input id="set-name" maxlength="40" autocomplete="off" placeholder="e.g. Food" value="${set ? escapeHtml(set.name) : ""}" required></div>
      <h2>Vocabulary words</h2>
      <div id="word-rows"></div>
      <button class="button secondary" id="add-word" type="button">＋ Add Word</button>
      <p class="validation" id="form-error" role="alert"></p>
      <div class="button-row"><button class="button" type="submit">Save Set</button><button class="button ghost" id="cancel-form" type="button">Cancel</button></div>
    </form>`);

  const rows = document.querySelector("#word-rows");
  initialWords.forEach(word => addWordRow(rows, word));
  document.querySelector("#add-word").addEventListener("click", () => { addWordRow(rows); rows.lastElementChild.querySelector("input").focus(); });
  document.querySelector("#form-back").addEventListener("click", renderHome);
  document.querySelector("#cancel-form").addEventListener("click", renderHome);
  document.querySelector("#set-form").addEventListener("submit", event => saveSetForm(event, set));
}

function addWordRow(container, word = { english: "", translation: "" }) {
  const row = document.createElement("div");
  row.className = "word-row";
  row.innerHTML = `
    <label>English word<input class="english-input" maxlength="70" value="${escapeHtml(word.english || "")}" placeholder="apple" aria-label="English word"></label>
    <label>Translation<input class="translation-input" maxlength="70" value="${escapeHtml(word.translation || "")}" placeholder="яблоко" aria-label="Translation"></label>
    <button class="button danger icon-button remove-word" type="button" aria-label="Remove this word">×</button>`;
  row.querySelector(".remove-word").addEventListener("click", () => {
    if (container.children.length <= 2) return showToast("A set needs at least 2 words.");
    row.remove();
  });
  container.append(row);
}

function saveSetForm(event, existingSet) {
  event.preventDefault();
  const name = document.querySelector("#set-name").value.trim();
  const rows = [...document.querySelectorAll(".word-row")];
  const pairs = rows.map(row => ({ english: row.querySelector(".english-input").value.trim(), translation: row.querySelector(".translation-input").value.trim() }));
  const completePairs = pairs.filter(pair => pair.english && pair.translation);
  const error = document.querySelector("#form-error");
  if (!name) { error.textContent = "Please give your vocabulary set a name."; document.querySelector("#set-name").focus(); return; }
  if (pairs.some(pair => (pair.english && !pair.translation) || (!pair.english && pair.translation))) { error.textContent = "Please complete both fields in every started word row."; return; }
  if (completePairs.length < 2) { error.textContent = "Please add at least 2 complete vocabulary words."; return; }

  if (existingSet) {
    existingSet.name = name;
    existingSet.words = completePairs.map((pair, index) => {
      const old = existingSet.words[index];
      return old && old.english === pair.english && old.translation === pair.translation ? old : { id: makeId("word"), ...pair, mistakeCount: 0, correctStreak: 0, learned: false };
    });
  } else {
    data.sets.push({ id: makeId("set"), name, icon: icons[data.sets.length % icons.length], words: completePairs.map(pair => ({ id: makeId("word"), ...pair, mistakeCount: 0, correctStreak: 0, learned: false })) });
  }
  saveData();
  renderHome();
  showToast(existingSet ? "Set updated!" : "New set created!");
}

function confirmDeleteSet(setId) {
  const set = data.sets.find(item => item.id === setId);
  document.querySelector("#confirm-message").textContent = `“${set.name}” and its learning progress will be removed.`;
  confirmDialog.showModal();
  confirmDialog.addEventListener("close", () => {
    if (confirmDialog.returnValue === "confirm") {
      data.sets = data.sets.filter(item => item.id !== setId);
      saveData(); renderHome(); showToast("Set deleted.");
    }
  }, { once: true });
}

function renderTrainingMenu(setId) {
  const set = data.sets.find(item => item.id === setId);
  if (!set) return renderHome();
  const difficult = set.words.filter(word => word.mistakeCount > 0).length;
  render(`
    <section class="set-training-hero">
      <button class="set-back" id="menu-back" aria-label="Back to word sets">←</button>
      <div class="set-title"><p class="eyebrow">Ready to learn?</p><h1>${escapeHtml(set.name)}</h1><p>${set.words.length} words</p></div>
      <span class="set-star star-one">★</span><span class="set-star star-two">✦</span>
      <div class="set-mascot"><img src="assets/sparky.png" alt="Sparky invites you to learn"><span>Let's learn<br>together! ⭐</span></div>
    </section>
    <section class="training-menu-panel" aria-labelledby="direction-title">
      <h2 id="direction-title"><span>❯</span> Choose a direction <span>❮</span></h2>
      <div class="direction-box training-directions">
        <label class="direction-option"><input type="radio" name="direction" value="en-ru" checked><span><i>🔤</i> English → Russian</span></label>
        <label class="direction-option"><input type="radio" name="direction" value="ru-en"><span><i>Я</i> Russian → English</span></label>
        <label class="direction-option"><input type="radio" name="direction" value="random"><span><i>🔀</i> Random</span></label>
      </div>
      <div class="mode-grid training-mode-grid">
        <button class="mode-card mode-flash" data-mode="flash"><span class="mode-icon">🃏</span><strong>Flashcards</strong><small>Flip cards and<br>rate your recall.</small><b>Start <i>→</i></b></button>
        <button class="mode-card mode-choice" data-mode="choice"><span class="mode-icon">✅</span><strong>Multiple Choice</strong><small>Pick the right answer<br>from four options.</small><b>Start <i>→</i></b></button>
        <button class="mode-card mode-write" data-mode="write"><span class="mode-icon">✏️</span><strong>Write the Word</strong><small>Type the answer<br>from memory.</small><b>Start <i>→</i></b></button>
      </div>
      <button class="practice-mistakes-row" id="practice-mistakes" ${difficult ? "" : "disabled"}><span class="practice-fire">🔥</span><span><strong>Practice Mistakes${difficult ? ` (${difficult})` : ""}</strong><small>${difficult ? "Review the words you found difficult." : "Words you miss will appear here for extra practice."}</small></span><i>›</i></button>
    </section>
    <div class="training-decor books" aria-hidden="true">📚🌿</div><div class="training-decor sign" aria-hidden="true"><span>Learn</span><span>Practice</span><span>Remember</span></div>`, "training-menu");
  document.querySelector("#menu-back").addEventListener("click", renderHome);
  document.querySelectorAll(".mode-card").forEach(button => button.addEventListener("click", () => startSession(set, button.dataset.mode, false)));
  document.querySelector("#practice-mistakes").addEventListener("click", () => startSession(set, "choice", true));
}

function startSession(set, mode, mistakesOnly) {
  const direction = document.querySelector('input[name="direction"]:checked')?.value || "en-ru";
  const sourceWords = mistakesOnly ? set.words.filter(word => word.mistakeCount > 0) : set.words;
  if (!sourceWords.length) return showToast("There are no difficult words to practice yet.");
  session = { set, mode, direction, mistakesOnly, words: shuffle(sourceWords), index: 0, score: 0, mistakes: new Set(), answered: false, attempt: 0, side: null };
  renderQuestion();
}

function getSides(word) {
  let direction = session.direction;
  if (direction === "random") direction = Math.random() < .5 ? "en-ru" : "ru-en";
  return direction === "en-ru"
    ? { prompt: word.english, answer: word.translation, promptLanguage: "English", answerLanguage: "translation" }
    : { prompt: word.translation, answer: word.english, promptLanguage: "translation", answerLanguage: "English word" };
}

function sessionHeader() {
  const current = Math.min(session.index + 1, session.words.length);
  const percent = session.words.length ? ((session.index) / session.words.length) * 100 : 0;
  return `<div class="session-header"><div class="session-meta"><span>⭐ Score: ${session.score}</span><span>Question ${current} of ${session.words.length}</span></div><div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${session.words.length}" aria-valuenow="${session.index}"><div class="progress-fill" data-progress="${percent}"></div></div></div>`;
}

function setProgressWidth() {
  const progress = document.querySelector(".progress-fill");
  if (progress) progress.style.width = `${progress.dataset.progress}%`;
}

function renderQuestion() {
  if (session.index >= session.words.length) return renderResults();
  session.answered = false; session.attempt = 0;
  session.side = getSides(session.words[session.index]);
  if (session.mode === "flash") renderFlashcard();
  else if (session.mode === "choice") renderMultipleChoice();
  else renderWriteWord();
}

function renderFlashcard() {
  const word = session.words[session.index];
  const frontSpeech = session.side.promptLanguage === "English" ? pronunciationButton(word.english) : "";
  const backSpeech = session.side.answerLanguage === "translation" ? pronunciationButton(word.english) : pronunciationButton(word.english);
  render(`<div class="flash-topbar"><div>⭐ <strong>Score: ${session.score}</strong></div><div class="flash-logo">WordSpark<span>✦</span></div><div>Question ${session.index + 1} of ${session.words.length}</div></div>
    <div class="flash-progress"><span data-progress="${(session.index / session.words.length) * 100}"></span></div>
    <section class="flash-training-panel">
    <div class="flash-instruction">💡 <strong>Click the card${session.side.promptLanguage === "English" ? " or tap the speaker" : ""} to reveal the ${escapeHtml(session.side.answerLanguage)}!</strong></div>
    <div class="flash-mascot"><img src="assets/sparky.png" alt="Sparky cheers you on"></div>
    <div class="flashcard-scene" id="flash-scene" role="button" tabindex="0" aria-label="Flip vocabulary card">
      <div class="flashcard" id="flashcard"><div class="flash-face"><span class="card-spark spark-a">✦</span><span class="card-spark spark-b">★</span><span class="vocab-with-speech">${escapeHtml(session.side.prompt)} ${frontSpeech}</span><span class="flash-hint">☝ Tap the card to flip</span></div><div class="flash-face back"><span class="card-spark spark-a">✦</span><span class="card-spark spark-b">★</span><span class="vocab-with-speech">${escapeHtml(session.side.answer)} ${session.side.answerLanguage === "English word" ? backSpeech : ""}</span><span class="flash-hint">How did you do?</span></div></div>
    </div>
    <div class="flash-actions"><button class="flash-answer dont-know" id="dont-know"><span>×</span>I don’t know</button><button class="flash-answer know" id="know"><span>✓</span>I know</button></div>
    <div class="flash-encouragement">⭐ Not sure? That’s okay! Every step helps you grow! <span>♥</span></div>
  </section>`, "flashcard");
  const progress = document.querySelector(".flash-progress span");
  requestAnimationFrame(() => { progress.style.width = `${progress.dataset.progress}%`; });
  bindPronunciationButtons();
  const flip = () => document.querySelector("#flashcard").classList.toggle("flipped");
  const flipWithSound = () => { flip(); playSound("flip"); };
  document.querySelector("#flash-scene").addEventListener("click", flipWithSound);
  document.querySelector("#flash-scene").addEventListener("keydown", event => {
    if (event.target.closest(".pronounce-button")) return;
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); flipWithSound(); }
  });
  document.querySelector("#dont-know").addEventListener("click", () => completeAnswer(word, false));
  document.querySelector("#know").addEventListener("click", () => completeAnswer(word, true));
}

function renderMultipleChoice() {
  const word = session.words[session.index];
  const answerField = session.side.answerLanguage === "English word" ? "english" : "translation";
  const distractors = shuffle(session.set.words.filter(item => item.id !== word.id).map(item => item[answerField]));
  // Small sets still show four buttons; distractors repeat only when fewer than three exist.
  while (distractors.length < 3) distractors.push(distractors[distractors.length % Math.max(1, distractors.length)] || "—");
  const options = shuffle([session.side.answer, ...distractors.slice(0, 3)]);
  render(`<div class="quiz-topbar"><div>⭐ <strong>Score: ${session.score}</strong></div><div class="quiz-logo">WordSpark<span>✦</span></div><div>Question ${session.index + 1} of ${session.words.length}</div></div>
    <div class="quiz-progress"><span data-progress="${(session.index / session.words.length) * 100}"></span></div>
    <section class="choice-training-panel">
      <div class="choice-mascot"><img src="assets/sparky.png" alt="Sparky thinks about the answer"><span>?</span></div>
      <div class="question-pill">❔ <strong>What does this mean?</strong></div>
      <h2 class="question choice-question"><span>“${escapeHtml(session.side.prompt)}”</span>${session.side.promptLanguage === "English" ? pronunciationButton(word.english) : ""}</h2>
      <div class="choice-grid playful-choices">${options.map((option, index) => `<div class="choice-wrap choice-color-${index + 1}"><button class="choice" data-answer="${escapeHtml(option)}"><span class="choice-letter">${String.fromCharCode(65 + index)}</span><strong>${escapeHtml(option)}</strong></button>${answerField === "english" ? pronunciationButton(option) : ""}</div>`).join("")}</div>
      <p class="feedback" id="feedback" role="status"></p><button class="quiz-next" id="next-question" hidden>Next <span>→</span></button>
    </section>
    <div class="quiz-encouragement">💡 Listen carefully and choose the right answer! <span>♥</span></div>
    <div class="quiz-meadow" aria-hidden="true">🌿　🌸　🌱　🌼　🌿</div>`, "multiple-choice");
  const progress = document.querySelector(".quiz-progress span");
  requestAnimationFrame(() => { progress.style.width = `${progress.dataset.progress}%`; });
  bindPronunciationButtons();
  document.querySelectorAll(".choice").forEach(button => button.addEventListener("click", () => {
    if (session.answered) return;
    session.answered = true;
    const correct = button.dataset.answer === session.side.answer;
    playSound(correct ? "correct" : "wrong");
    document.querySelectorAll(".choice").forEach(choice => { choice.disabled = true; if (choice.dataset.answer === session.side.answer) choice.classList.add("correct"); });
    if (!correct) button.classList.add("incorrect");
    const feedback = document.querySelector("#feedback");
    feedback.textContent = correct ? "✅ Correct!" : "❌ Incorrect — the correct answer is highlighted.";
    feedback.className = `feedback ${correct ? "correct" : "incorrect"}`;
    recordResult(word, correct);
    document.querySelector("#next-question").hidden = false;
    document.querySelector("#next-question").focus();
  }));
  document.querySelector("#next-question").addEventListener("click", nextQuestion);
}

function renderWriteWord() {
  const word = session.words[session.index];
  const inputHint = session.side.answerLanguage === "English word" ? "Type in English…" : "Type the translation…";
  render(`<div class="write-topbar"><div>⭐ <strong>Score: ${session.score}</strong></div><div class="write-logo">WordSpark<span>✦</span></div><div>Question ${session.index + 1} of ${session.words.length}</div></div>
    <div class="write-progress"><span data-progress="${(session.index / session.words.length) * 100}"></span></div>
    <section class="write-training-panel">
      <div class="write-mascot"><img src="assets/sparky.png" alt="Sparky helps you write the answer"><span>✎</span></div>
      <div class="write-prompt-pill">✏️ <strong>Type the ${escapeHtml(session.side.answerLanguage)}</strong></div>
      <h2 class="question write-question"><span>${escapeHtml(session.side.prompt)}</span>${session.side.promptLanguage === "English" ? pronunciationButton(word.english) : ""}</h2>
      <form class="write-answer-form" id="answer-form">
        <label for="written-answer"><span>❯</span> Your answer <span>❮</span></label>
        <div class="write-input-wrap"><input id="written-answer" autocomplete="off" autocapitalize="off" placeholder="${inputHint}"></div>
        <p class="feedback" id="feedback" role="status"></p>
        <div class="write-buttons"><button class="write-check" id="check-answer" type="submit"><span>✓</span> Check Answer</button><button class="write-next" id="next-question" type="button" hidden>Next <span>→</span></button></div>
      </form>
    </section>
    <div class="write-encouragement">💡 Spell it carefully! You can do it! <span>♥</span></div>
    <div class="write-meadow" aria-hidden="true">🌿　🌸　🌱　🌼　🌿</div>`, "write-word");
  const progress = document.querySelector(".write-progress span");
  requestAnimationFrame(() => { progress.style.width = `${progress.dataset.progress}%`; });
  bindPronunciationButtons();
  document.querySelector("#written-answer").focus();
  document.querySelector("#answer-form").addEventListener("submit", event => {
    event.preventDefault();
    if (session.answered) return;
    const input = document.querySelector("#written-answer");
    const correct = input.value.trim().toLocaleLowerCase() === session.side.answer.trim().toLocaleLowerCase();
    const feedback = document.querySelector("#feedback");
    if (correct) {
      playSound("correct");
      session.answered = true; feedback.textContent = "✅ Correct!"; feedback.className = "feedback correct"; recordResult(word, true); finishWriteQuestion();
    } else if (session.attempt === 0) {
      playSound("wrong");
      session.attempt = 1; feedback.textContent = "❌ Try again! You have one more attempt."; feedback.className = "feedback incorrect"; input.select();
    } else {
      playSound("wrong");
      session.answered = true;
      feedback.innerHTML = `❌ Correct answer: ${escapeHtml(session.side.answer)} ${session.side.answerLanguage === "English word" ? pronunciationButton(word.english) : ""}`;
      feedback.className = "feedback incorrect";
      bindPronunciationButtons(feedback);
      recordResult(word, false); finishWriteQuestion();
    }
  });
  document.querySelector("#next-question").addEventListener("click", nextQuestion);
}

function finishWriteQuestion() {
  document.querySelector("#written-answer").disabled = true;
  document.querySelector("#check-answer").hidden = true;
  document.querySelector("#next-question").hidden = false;
  document.querySelector("#next-question").focus();
}

// Difficult words graduate after two correct answers in a row. Any mistake resets the streak.
function recordResult(word, correct) {
  if (correct) {
    session.score += 1;
    word.learned = true;
    if (word.mistakeCount > 0) {
      word.correctStreak = (word.correctStreak || 0) + 1;
      if (word.correctStreak >= 2) {
        word.mistakeCount = 0; word.correctStreak = 0;
        setTimeout(() => playSound("reward"), 180);
      }
    }
  } else {
    word.mistakeCount = (word.mistakeCount || 0) + 1;
    word.correctStreak = 0;
    session.mistakes.add(word.id);
  }
  saveData();
}

function completeAnswer(word, correct) { playSound(correct ? "correct" : "wrong"); recordResult(word, correct); setTimeout(nextQuestion, 170); }
function nextQuestion() {
  session.index += 1;
  if (session.index < session.words.length) playSound("next");
  renderQuestion();
}

function renderResults() {
  data.sessions = (data.sessions || 0) + 1;
  saveData();
  playSound("complete");
  const mistakes = session.words.filter(word => session.mistakes.has(word.id));
  const accuracy = Math.round((session.score / session.words.length) * 100);
  render(`<section class="panel training-panel">
    <div class="result-icon" aria-hidden="true">${mistakes.length ? "🎉" : "🏆"}</div><p class="eyebrow">Session finished</p><h1>Training Complete!</h1>
    <div class="result-score"><strong>${session.score} / ${session.words.length}</strong><span>Score · ${accuracy}% accuracy</span></div>
    ${mistakes.length ? `<h2>Words to Practice</h2><ul class="mistake-list">${mistakes.map(word => `<li>❌ <strong>${escapeHtml(word.english)}</strong> — ${escapeHtml(word.translation)}</li>`).join("")}</ul>` : `<h2>Excellent! You knew every word!</h2><p class="muted">That was a perfect round.</p>`}
    <div class="button-row result-actions"><button class="button secondary" id="results-practice" ${session.set.words.some(word => word.mistakeCount > 0) ? "" : "disabled"}>🔁 Practice Mistakes</button><button class="button" id="train-again">Train Again</button><button class="button ghost" id="results-home">Back to Word Sets</button></div>
  </section>`);
  if (!mistakes.length) setTimeout(() => playSound("sparky"), 420);
  document.querySelector("#results-practice").addEventListener("click", () => {
    const freshSet = data.sets.find(item => item.id === session.set.id);
    startSessionFromResults(freshSet, session.mode, true, session.direction);
  });
  document.querySelector("#train-again").addEventListener("click", () => {
    const freshSet = data.sets.find(item => item.id === session.set.id);
    startSessionFromResults(freshSet, session.mode, false, session.direction);
  });
  document.querySelector("#results-home").addEventListener("click", renderHome);
}

function startSessionFromResults(set, mode, mistakesOnly, direction) {
  const words = mistakesOnly ? set.words.filter(word => word.mistakeCount > 0) : set.words;
  session = { set, mode, direction, mistakesOnly, words: shuffle(words), index: 0, score: 0, mistakes: new Set(), answered: false, attempt: 0, side: null };
  renderQuestion();
}

document.querySelector("#brand-button").addEventListener("click", renderHome);
document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
  button.classList.add("active");
  if (button.dataset.nav === "home") return renderHome();
  if (button.dataset.nav === "sets") { renderHome(); requestAnimationFrame(() => document.querySelector("#sets-section")?.scrollIntoView()); return; }
  if (button.dataset.nav === "stats") { renderHome(); requestAnimationFrame(() => document.querySelector("#stats-section")?.scrollIntoView()); return; }
  if (button.dataset.nav === "settings") return openSoundSettings();
  if (button.dataset.nav === "training") return data.sets.length ? renderTrainingMenu(data.sets[0].id) : showToast("Create a word set first.");
  const setWithMistakes = data.sets.find(set => set.words.some(word => word.mistakeCount > 0));
  if (setWithMistakes) renderTrainingMenu(setWithMistakes.id); else showToast("No difficult words yet — great work!");
}));
renderHome();
