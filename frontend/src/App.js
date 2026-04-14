import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import "@/App.css";
import {
  Sparkles, Search, RotateCcw, Hash, Loader2,
  ChevronLeft, ChevronRight, Check, X, Plus, Minus,
} from "lucide-react";

// ─── Helpers ───────────────────────────────────────────────
function stripAccents(s) {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function norm(w) {
  return stripAccents(w.toLowerCase());
}

function storageKey(center, outer) {
  return `soletra_marks_${center}_${outer.join("")}`.toLowerCase();
}

// Generate combos ONLY within an alphabetical range (efficient pruning)
function generateCombosInRange(allowedArr, length, centerNorm, lowerBound, upperBound) {
  const results = [];
  const lastChar = allowedArr[allowedArr.length - 1];
  const firstChar = allowedArr[0];

  const gen = (prefix) => {
    const pLen = prefix.length;
    if (pLen === length) {
      if (prefix.includes(centerNorm) && prefix > lowerBound && prefix < upperBound) {
        results.push(prefix);
      }
      return;
    }
    // Prune: prefix + all max chars < lower → skip
    const remaining = length - pLen;
    if (prefix + lastChar.repeat(remaining) <= lowerBound) return;
    // Prune: prefix + all min chars > upper → skip
    if (prefix + firstChar.repeat(remaining) >= upperBound) return;

    for (const l of allowedArr) {
      gen(prefix + l);
    }
  };
  gen("");
  return results.sort();
}

// ─── HexInput ──────────────────────────────────────────────
function HexInput({ value, onChange, position, isCenter, testId }) {
  const ref = useRef(null);
  const handleChange = (e) => {
    const v = e.target.value.slice(-1).toUpperCase();
    if (/^[A-Za-zÀ-ÿ]?$/.test(v)) onChange(v);
  };
  return (
    <div className={`hex-pos ${position}`}>
      <input ref={ref} type="text" maxLength={1} value={value} onChange={handleChange}
        onFocus={() => ref.current?.select()}
        className={`hex-input ${isCenter ? "hex-input-center" : "hex-input-outer"}`}
        data-testid={testId} autoComplete="off" />
    </div>
  );
}

// ─── WordBadge ─────────────────────────────────────────────
function WordBadge({ word, isPangram, isSelected, category, mark, onClick, onMark }) {
  const cls = [
    "word-badge",
    isPangram && "word-badge-pangram",
    category === "extra" && "word-badge-extra",
    category === "highlighted" && "word-badge-highlighted",
    category === "combo" && "word-badge-combo",
    isSelected && "word-badge-selected",
    mark === "correct" && "word-badge-correct",
    mark === "wrong" && "word-badge-wrong",
  ].filter(Boolean).join(" ");

  const testId = isPangram ? `pangram-word-${word.toLowerCase()}` : `word-${word.toLowerCase()}`;

  return (
    <span className={cls} data-testid={testId} onClick={onClick}>
      {isPangram && <Sparkles size={14} />}
      {mark === "correct" && <Check size={14} className="text-emerald-600" />}
      {mark === "wrong" && <X size={14} className="text-red-500" />}
      <span className={mark === "wrong" ? "line-through opacity-60" : ""}>{word}</span>
      {isSelected && !mark && (
        <span className="word-mark-btns" onClick={(e) => e.stopPropagation()}>
          <button className="mark-btn mark-correct" onClick={(e) => { e.stopPropagation(); onMark("correct"); }}
            data-testid={`mark-correct-${word.toLowerCase()}`}><Check size={12} /></button>
          <button className="mark-btn mark-wrong" onClick={(e) => { e.stopPropagation(); onMark("wrong"); }}
            data-testid={`mark-wrong-${word.toLowerCase()}`}><X size={12} /></button>
        </span>
      )}
    </span>
  );
}

// ─── GapIndicator ──────────────────────────────────────────
function GapIndicator({ state, onClick, extraCount }) {
  const stateClass = state === 1 ? "gap-state-1" : state >= 2 ? "gap-state-2" : "";

  return (
    <button
      className={`gap-indicator ${stateClass}`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      data-testid="gap-indicator"
    >
      {state >= 2 ? <Minus size={10} /> : <Plus size={10} />}
      {state === 0 && extraCount > 0 && <span>{extraCount}</span>}
    </button>
  );
}

// Small gap between injected extras to open combos
function MiniGap({ onClick }) {
  return (
    <button
      className="gap-indicator gap-state-1"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      data-testid="mini-gap-indicator"
    >
      <Plus size={10} />
    </button>
  );
}

// ─── ResultsGroup with gaps ────────────────────────────────
function ResultsGroup({
  length, words, index, selectedWord, onSelectWord, marks, onMark,
  gapStates, onToggleGap, extraWordsForGroup, gapCombos,
}) {
  // Build set of word indices that border an expanded gap → highlighted yellow
  const highlightedIndices = new Set();
  for (const [key, state] of Object.entries(gapStates)) {
    if (!key.startsWith(`${length}_`) || state < 1) continue;
    const part = key.split("_")[1];
    if (part === "before") {
      highlightedIndices.add(0);
    } else {
      const idx = parseInt(part);
      highlightedIndices.add(idx);
      if (idx + 1 < words.length) highlightedIndices.add(idx + 1);
    }
  }

  const renderWord = (w, wordIdx) => (
    <WordBadge
      key={`w-${w.word}`} word={w.word} isPangram={w.is_pangram}
      category={highlightedIndices.has(wordIdx) ? "highlighted" : "clean"}
      isSelected={selectedWord === w.word} mark={marks[w.word]}
      onClick={() => onSelectWord(w.word)} onMark={(m) => onMark(w.word, m)}
    />
  );

  const renderExtra = (w) => (
    <WordBadge
      key={`e-${w.word}`} word={w.word} isPangram={w.is_pangram} category="extra"
      isSelected={selectedWord === w.word} mark={marks[w.word]}
      onClick={() => onSelectWord(w.word)} onMark={(m) => onMark(w.word, m)}
    />
  );

  const items = [];

  // Gap before first word
  const beforeFirst = extraWordsForGroup.filter((w) => norm(w.word) < norm(words[0]?.word || ""));
  const beforeKey = `${length}_before`;
  const beforeState = gapStates[beforeKey] || 0;
  const beforeCombos = gapCombos[beforeKey] || [];

  items.push(
    <GapIndicator key={beforeKey} state={beforeState} onClick={() => onToggleGap(beforeKey)} extraCount={beforeFirst.length} />
  );
  if (beforeState >= 1) {
    beforeFirst.forEach((w, ei) => {
      items.push(renderExtra(w));
      items.push(<MiniGap key={`mg-before-${ei}`} onClick={() => onToggleGap(beforeKey)} />);
    });
    if (beforeFirst.length === 0) {
      items.push(<MiniGap key={`mg-before-empty`} onClick={() => onToggleGap(beforeKey)} />);
    }
  }
  if (beforeState >= 2) {
    const shown = new Set([...words.map((w) => norm(w.word)), ...beforeFirst.map((w) => norm(w.word))]);
    beforeCombos.filter((c) => !shown.has(c)).slice(0, 200).forEach((c) =>
      items.push(<span key={`c-${c}`} className="word-badge word-badge-combo">{c.toUpperCase()}</span>)
    );
  }

  words.forEach((w, i) => {
    items.push(renderWord(w, i));

    const nextWord = words[i + 1];
    const wNorm = norm(w.word);
    const nextNorm = nextWord ? norm(nextWord.word) : "\uffff";

    const extraInGap = extraWordsForGroup.filter((e) => {
      const en = norm(e.word);
      return en > wNorm && en < nextNorm;
    });
    const gapKey = `${length}_${i}`;
    const gapState = gapStates[gapKey] || 0;
    const gapComboList = gapCombos[gapKey] || [];

    items.push(
      <GapIndicator key={`g-${gapKey}`} state={gapState} onClick={() => onToggleGap(gapKey)} extraCount={extraInGap.length} />
    );
    if (gapState >= 1) {
      extraInGap.forEach((e, ei) => {
        items.push(renderExtra(e));
        items.push(<MiniGap key={`mg-${gapKey}-${ei}`} onClick={() => onToggleGap(gapKey)} />);
      });
      // If no extras, still show a mini gap for combos
      if (extraInGap.length === 0) {
        items.push(<MiniGap key={`mg-${gapKey}-empty`} onClick={() => onToggleGap(gapKey)} />);
      }
    }
    if (gapState >= 2) {
      const shown = new Set([...words.map((x) => norm(x.word)), ...extraInGap.map((x) => norm(x.word))]);
      gapComboList.filter((c) => !shown.has(c)).slice(0, 200).forEach((c) =>
        items.push(<span key={`c-${c}`} className="word-badge word-badge-combo">{c.toUpperCase()}</span>)
      );
    }
  });

  return (
    <div className="fade-in-up mb-6" style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="flex items-center gap-3 border-b border-slate-100 pb-2 mb-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100">
          <Hash size={14} className="text-slate-500" />
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-slate-800" style={{ fontFamily: "Outfit, sans-serif" }}>
          {length} letras
        </h3>
        <span className="text-sm text-slate-400 font-medium">({words.length})</span>
      </div>
      <div className="flex flex-wrap gap-2 items-center">{items}</div>
    </div>
  );
}

// ─── Solve logic ───────────────────────────────────────────
function solveWithDict(dict, centerLetter, outerLetters, category) {
  const center = norm(centerLetter);
  const allowed = new Set(outerLetters.map((c) => norm(c)));
  allowed.add(center);
  const allSeven = new Set(allowed);

  const results = [];
  for (const word of dict) {
    const n = norm(word);
    if (!n.includes(center)) continue;
    let valid = true;
    for (const c of n) { if (!allowed.has(c)) { valid = false; break; } }
    if (!valid) continue;
    const isPangram = [...allSeven].every((l) => new Set(n).has(l));
    results.push({ word: word.toUpperCase(), is_pangram: isPangram, category, length: n.length });
  }
  return results;
}

function groupAndSort(wordList) {
  const groups = {};
  let pangramCount = 0;
  for (const w of wordList) {
    if (!groups[w.length]) groups[w.length] = [];
    groups[w.length].push(w);
    if (w.is_pangram) pangramCount++;
  }
  const sorted = {};
  for (const k of Object.keys(groups).sort((a, b) => a - b)) {
    sorted[k] = groups[k].sort((a, b) => norm(a.word).localeCompare(norm(b.word)));
  }
  return { groups: sorted, pangram_count: pangramCount, total: wordList.length };
}

// ─── Main App ──────────────────────────────────────────────
export default function App() {
  const [centerLetter, setCenterLetter] = useState(() => localStorage.getItem("soletra_center") || "");
  const [outerLetters, setOuterLetters] = useState(() => {
    try { return JSON.parse(localStorage.getItem("soletra_outer")) || ["", "", "", "", "", ""]; }
    catch { return ["", "", "", "", "", ""]; }
  });

  const [dictionary, setDictionary] = useState([]);
  const [extraDict, setExtraDict] = useState([]);
  const [dictLoading, setDictLoading] = useState(true);
  const [extraLoaded, setExtraLoaded] = useState(false);

  const [cleanResults, setCleanResults] = useState(null);
  const [extraResults, setExtraResults] = useState({});
  const [gapCombos, setGapCombos] = useState({}); // combos per gap key
  const [hasResults, setHasResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedWord, setSelectedWord] = useState(null);
  const [gapStates, setGapStates] = useState({});
  const [marks, setMarks] = useState({});

  const outerRefs = useRef([]);

  // Persist letters
  useEffect(() => { localStorage.setItem("soletra_center", centerLetter); }, [centerLetter]);
  useEffect(() => { localStorage.setItem("soletra_outer", JSON.stringify(outerLetters)); }, [outerLetters]);

  // Load/save marks
  useEffect(() => {
    if (!centerLetter || outerLetters.some((l) => !l)) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(centerLetter, outerLetters)));
      if (saved) setMarks(saved);
      else setMarks({});
    } catch { setMarks({}); }
  }, [centerLetter, outerLetters]);

  const saveMarks = useCallback((newMarks) => {
    setMarks(newMarks);
    if (centerLetter && outerLetters.every((l) => l)) {
      localStorage.setItem(storageKey(centerLetter, outerLetters), JSON.stringify(newMarks));
    }
  }, [centerLetter, outerLetters]);

  const handleMark = useCallback((word, mark) => {
    const updated = { ...marks };
    if (updated[word] === mark) delete updated[word];
    else updated[word] = mark;
    saveMarks(updated);
  }, [marks, saveMarks]);

  // Navigation
  const allCleanWords = useMemo(() =>
    cleanResults ? Object.values(cleanResults.groups).flat().map((w) => w.word) : [],
    [cleanResults]
  );
  const selectedIndex = selectedWord ? allCleanWords.indexOf(selectedWord) : -1;

  const navigateWord = useCallback((dir) => {
    if (allCleanWords.length === 0) return;
    let next = selectedIndex === -1 ? 0 : selectedIndex + dir;
    if (next < 0) next = allCleanWords.length - 1;
    if (next >= allCleanWords.length) next = 0;
    setSelectedWord(allCleanWords[next]);
  }, [allCleanWords, selectedIndex]);

  useEffect(() => {
    const handler = (e) => {
      if (!hasResults || allCleanWords.length === 0) return;
      if (e.key === "ArrowRight") { e.preventDefault(); navigateWord(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); navigateWord(-1); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasResults, allCleanWords, navigateWord]);

  // Load filtered dictionary on mount
  useEffect(() => {
    fetch("/br-utf8.txt")
      .then((r) => r.text())
      .then((text) => {
        const words = text.split("\n").map((w) => w.trim()).filter((w) => w.length >= 4 && /^[a-zA-ZÀ-ÿ]+$/.test(w));
        setDictionary(words);
        setDictLoading(false);
      })
      .catch(() => { setError("Erro ao carregar dicionário."); setDictLoading(false); });
  }, []);

  // Load extra dictionary lazily
  const loadExtraDict = useCallback(() => {
    if (extraLoaded) return Promise.resolve();
    return fetch("/br-extra.txt")
      .then((r) => r.text())
      .then((text) => {
        const words = text.split("\n").map((w) => w.trim()).filter((w) => w.length >= 4 && /^[a-zA-ZÀ-ÿ]+$/.test(w));
        setExtraDict(words);
        setExtraLoaded(true);
        return words;
      });
  }, [extraLoaded]);

  // When extra dict loads + we have results, compute extra results
  useEffect(() => {
    if (extraDict.length > 0 && centerLetter && outerLetters.every((l) => l) && cleanResults) {
      const cleanSet = new Set(Object.values(cleanResults.groups).flat().map((w) => norm(w.word)));
      const extras = solveWithDict(extraDict, centerLetter, outerLetters, "extra")
        .filter((w) => !cleanSet.has(norm(w.word)));
      // Group by length
      const grouped = {};
      for (const w of extras) {
        if (!grouped[w.length]) grouped[w.length] = [];
        grouped[w.length].push(w);
      }
      for (const k of Object.keys(grouped)) {
        grouped[k].sort((a, b) => norm(a.word).localeCompare(norm(b.word)));
      }
      setExtraResults(grouped);
    }
  }, [extraDict, centerLetter, outerLetters, cleanResults]);

  const positions = ["hex-top", "hex-top-right", "hex-bottom-right", "hex-bottom", "hex-bottom-left", "hex-top-left"];
  const allFilled = centerLetter && outerLetters.every((l) => l !== "");

  const handleOuterChange = useCallback((index, val) => {
    const updated = [...outerLetters];
    updated[index] = val;
    setOuterLetters(updated);
    if (val && index < 5) {
      const nextEmpty = updated.findIndex((l, i) => i > index && l === "");
      if (nextEmpty !== -1 && outerRefs.current[nextEmpty]) {
        outerRefs.current[nextEmpty].querySelector("input")?.focus();
      }
    }
  }, [outerLetters]);

  const handleSolve = () => {
    if (!allFilled || dictionary.length === 0) return;
    setLoading(true);
    setError("");
    setSelectedWord(null);
    setGapStates({});
    setGapCombos({});
    setExtraResults({});

    // Auto-load extra dict if not loaded
    const extraPromise = !extraLoaded ? loadExtraDict() : Promise.resolve(extraDict);

    setTimeout(() => {
      const clean = solveWithDict(dictionary, centerLetter, outerLetters, "clean");
      const grouped = groupAndSort(clean);
      setCleanResults(grouped);
      setHasResults(true);
      setLoading(false);

      // Solve extras once dict is ready
      extraPromise.then((eDictWords) => {
        const dict = eDictWords || extraDict;
        if (dict.length === 0) return;
        const cleanSet = new Set(clean.map((w) => norm(w.word)));
        const extras = solveWithDict(dict, centerLetter, outerLetters, "extra")
          .filter((w) => !cleanSet.has(norm(w.word)));
        const eg = {};
        for (const w of extras) {
          if (!eg[w.length]) eg[w.length] = [];
          eg[w.length].push(w);
        }
        for (const k of Object.keys(eg)) eg[k].sort((a, b) => norm(a.word).localeCompare(norm(b.word)));
        setExtraResults(eg);
      });
    }, 50);
  };

  const handleReset = () => {
    setCenterLetter("");
    setOuterLetters(["", "", "", "", "", ""]);
    setCleanResults(null);
    setExtraResults({});
    setGapCombos({});
    setHasResults(false);
    setError("");
    setSelectedWord(null);
    setGapStates({});
    setMarks({});
    localStorage.removeItem("soletra_center");
    localStorage.removeItem("soletra_outer");
  };

  // Compute combos for a gap based on its boundaries
  const computeGapCombos = useCallback((gapKey, lowerBound, upperBound, len) => {
    if (gapCombos[gapKey]) return;
    if (!centerLetter || !allFilled) return;

    const allowedSet = new Set(outerLetters.map((c) => norm(c)));
    allowedSet.add(norm(centerLetter));
    const allowedArr = [...allowedSet].sort();
    const combos = generateCombosInRange(allowedArr, len, norm(centerLetter), lowerBound, upperBound);
    setGapCombos((prev) => ({ ...prev, [gapKey]: combos }));
  }, [gapCombos, centerLetter, outerLetters, allFilled]);

  // Toggle a gap: 0 → 1 (extras), 1 → 2 (combos), 2 → 0
  const handleToggleGap = useCallback((gapKey) => {
    const current = gapStates[gapKey] || 0;

    if (current === 0) {
      if (!extraLoaded) loadExtraDict();
      setGapStates((prev) => ({ ...prev, [gapKey]: 1 }));
    } else if (current === 1) {
      // Need to compute combos for this gap — find bounds from clean results
      const len = parseInt(gapKey.split("_")[0]);
      const part = gapKey.split("_")[1];
      const groupWords = cleanResults?.groups[len] || [];
      let lower, upper;

      if (part === "before") {
        lower = "";
        upper = groupWords[0] ? norm(groupWords[0].word) : "\uffff";
      } else {
        const idx = parseInt(part);
        lower = groupWords[idx] ? norm(groupWords[idx].word) : "";
        upper = groupWords[idx + 1] ? norm(groupWords[idx + 1].word) : "\uffff";
      }

      computeGapCombos(gapKey, lower, upper, len);
      setGapStates((prev) => ({ ...prev, [gapKey]: 2 }));
    } else {
      setGapStates((prev) => ({ ...prev, [gapKey]: 0 }));
    }
  }, [gapStates, extraLoaded, loadExtraDict, computeGapCombos, cleanResults]);

  const markedCorrect = Object.values(marks).filter((m) => m === "correct").length;
  const markedWrong = Object.values(marks).filter((m) => m === "wrong").length;

  return (
    <div className="min-h-screen bg-slate-50"
      style={{ backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 1px)", backgroundSize: "16px 16px" }}>

      <header className="pt-10 pb-4 text-center">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-slate-900"
          style={{ fontFamily: "Outfit, sans-serif" }} data-testid="app-title">Soletra Solver</h1>
        <p className="mt-2 text-base text-slate-500" style={{ fontFamily: "Manrope, sans-serif" }}>
          {dictLoading
            ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" />Carregando...</span>
            : `${dictionary.length.toLocaleString("pt-BR")} palavras`}
        </p>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start mt-6">
          {/* Left */}
          <div className="lg:col-span-5 flex flex-col items-center gap-8">
            <div className="hex-container" data-testid="hex-container">
              <HexInput value={centerLetter} onChange={setCenterLetter} position="hex-center" isCenter testId="center-letter-input" />
              {positions.map((pos, i) => (
                <div key={i} ref={(el) => (outerRefs.current[i] = el)}>
                  <HexInput value={outerLetters[i]} onChange={(val) => handleOuterChange(i, val)} position={pos} isCenter={false} testId={`outer-letter-input-${i}`} />
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center gap-3 w-full max-w-xs">
              <button className="btn-generate w-full flex items-center justify-center gap-2"
                onClick={handleSolve} disabled={!allFilled || loading || dictLoading} data-testid="generate-words-button">
                {loading ? <span className="loading-pulse">Buscando...</span> : <><Search size={20} />Gerar Palavras</>}
              </button>
              <button className="text-sm text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5 font-medium"
                onClick={handleReset} data-testid="reset-button" style={{ fontFamily: "Manrope, sans-serif" }}>
                <RotateCcw size={14} />Limpar tudo
              </button>
            </div>

            {hasResults && (markedCorrect > 0 || markedWrong > 0) && (
              <div className="flex items-center gap-4 text-sm font-medium" data-testid="marks-summary">
                {markedCorrect > 0 && <span className="flex items-center gap-1 text-emerald-600"><Check size={14} />{markedCorrect} certa{markedCorrect !== 1 ? "s" : ""}</span>}
                {markedWrong > 0 && <span className="flex items-center gap-1 text-red-500"><X size={14} />{markedWrong} errada{markedWrong !== 1 ? "s" : ""}</span>}
              </div>
            )}
            {error && <p className="text-red-500 text-sm text-center" data-testid="error-message">{error}</p>}
          </div>

          {/* Right */}
          <div className="lg:col-span-7 results-panel p-6 sm:p-8" data-testid="results-section">
            {!hasResults && !loading && (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <Search size={24} className="text-slate-400" />
                </div>
                <p className="text-slate-400 text-lg font-medium" style={{ fontFamily: "Manrope, sans-serif" }} data-testid="empty-state">
                  Preencha as letras e clique em "Gerar Palavras"
                </p>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center min-h-[300px]">
                <div className="loading-pulse text-slate-400 text-lg font-medium">Buscando palavras...</div>
              </div>
            )}

            {hasResults && cleanResults && (
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-6 pb-4 border-b border-slate-100" data-testid="results-summary">
                  <div className="text-2xl font-bold text-slate-900" style={{ fontFamily: "Outfit, sans-serif" }}>
                    {cleanResults.total} palavra{cleanResults.total !== 1 ? "s" : ""}
                  </div>
                  {cleanResults.pangram_count > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 font-semibold text-sm">
                      <Sparkles size={14} />{cleanResults.pangram_count}
                    </div>
                  )}
                  {allCleanWords.length > 0 && (
                    <div className="flex items-center gap-1 ml-auto" data-testid="word-navigator">
                      <button className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                        onClick={() => navigateWord(-1)} data-testid="nav-prev-button">
                        <ChevronLeft size={16} className="text-slate-600" />
                      </button>
                      <span className="text-xs text-slate-400 font-medium min-w-[3rem] text-center">
                        {selectedIndex >= 0 ? `${selectedIndex + 1}/${allCleanWords.length}` : "—"}
                      </span>
                      <button className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                        onClick={() => navigateWord(1)} data-testid="nav-next-button">
                        <ChevronRight size={16} className="text-slate-600" />
                      </button>
                    </div>
                  )}
                </div>

                {cleanResults.total === 0
                  ? <p className="text-slate-400 text-center py-10" data-testid="no-results">Nenhuma palavra encontrada.</p>
                  : Object.entries(cleanResults.groups).map(([len, words], index) => (
                    <ResultsGroup
                      key={len}
                      length={parseInt(len)}
                      words={words}
                      index={index}
                      selectedWord={selectedWord}
                      onSelectWord={(w) => setSelectedWord(w === selectedWord ? null : w)}
                      marks={marks}
                      onMark={handleMark}
                      gapStates={gapStates}
                      onToggleGap={handleToggleGap}
                      extraWordsForGroup={extraResults[len] || []}
                      gapCombos={gapCombos}
                    />
                  ))
                }
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
