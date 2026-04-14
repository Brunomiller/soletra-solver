import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import "@/App.css";
import {
  Sparkles, Search, RotateCcw, Hash, Loader2,
  ChevronLeft, ChevronRight, Check, X, Eye, EyeOff,
} from "lucide-react";

// ─── Helpers ───────────────────────────────────────────────
function stripAccents(s) {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function storageKey(center, outer) {
  return `soletra_marks_${center}_${outer.join("")}`.toLowerCase();
}

// ─── Small components ──────────────────────────────────────
function HexInput({ value, onChange, position, isCenter, testId }) {
  const ref = useRef(null);
  const handleChange = (e) => {
    const v = e.target.value.slice(-1).toUpperCase();
    if (/^[A-Za-zÀ-ÿ]?$/.test(v)) onChange(v);
  };
  return (
    <div className={`hex-pos ${position}`}>
      <input
        ref={ref}
        type="text"
        maxLength={1}
        value={value}
        onChange={handleChange}
        onFocus={() => ref.current?.select()}
        className={`hex-input ${isCenter ? "hex-input-center" : "hex-input-outer"}`}
        data-testid={testId}
        autoComplete="off"
      />
    </div>
  );
}

function WordBadge({ word, isPangram, isSelected, category, mark, onClick, onMark }) {
  const base = "word-badge";
  const cls = [
    base,
    isPangram && "word-badge-pangram",
    category === "extra" && "word-badge-extra",
    isSelected && "word-badge-selected",
    mark === "correct" && "word-badge-correct",
    mark === "wrong" && "word-badge-wrong",
  ].filter(Boolean).join(" ");

  const testId = isPangram
    ? `pangram-word-${word.toLowerCase()}`
    : `word-${word.toLowerCase()}`;

  return (
    <span className={cls} data-testid={testId} onClick={onClick}>
      {isPangram && <Sparkles size={14} />}
      {mark === "correct" && <Check size={14} className="text-emerald-600" />}
      {mark === "wrong" && <X size={14} className="text-red-500" />}
      <span className={mark === "wrong" ? "line-through opacity-60" : ""}>{word}</span>
      {isSelected && !mark && (
        <span className="word-mark-btns" onClick={(e) => e.stopPropagation()}>
          <button
            className="mark-btn mark-correct"
            onClick={(e) => { e.stopPropagation(); onMark("correct"); }}
            data-testid={`mark-correct-${word.toLowerCase()}`}
          >
            <Check size={12} />
          </button>
          <button
            className="mark-btn mark-wrong"
            onClick={(e) => { e.stopPropagation(); onMark("wrong"); }}
            data-testid={`mark-wrong-${word.toLowerCase()}`}
          >
            <X size={12} />
          </button>
        </span>
      )}
    </span>
  );
}

function ResultsGroup({ length, words, index, selectedWord, onSelectWord, marks, onMark }) {
  const cleanCount = words.filter((w) => w.category === "clean").length;
  const extraCount = words.filter((w) => w.category === "extra").length;
  return (
    <div className="fade-in-up mb-6" style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="flex items-center gap-3 border-b border-slate-100 pb-2 mb-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100">
          <Hash size={14} className="text-slate-500" />
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-slate-800" style={{ fontFamily: "Outfit, sans-serif" }}>
          {length} letras
        </h3>
        <span className="text-sm text-slate-400 font-medium">
          ({cleanCount}{extraCount > 0 && <span className="text-amber-500"> +{extraCount}</span>})
        </span>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {words.map((w) => (
          <WordBadge
            key={w.word}
            word={w.word}
            isPangram={w.is_pangram}
            category={w.category}
            isSelected={selectedWord === w.word}
            mark={marks[w.word]}
            onClick={() => onSelectWord(w.word)}
            onMark={(m) => onMark(w.word, m)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Solve logic ───────────────────────────────────────────
function solveWithDict(dict, centerLetter, outerLetters, category) {
  const center = stripAccents(centerLetter.toLowerCase());
  const allowed = new Set(outerLetters.map((c) => stripAccents(c.toLowerCase())));
  allowed.add(center);
  const allSeven = new Set(allowed);

  const results = [];
  for (const word of dict) {
    const norm = stripAccents(word.toLowerCase());
    if (!norm.includes(center)) continue;
    let valid = true;
    for (const c of norm) {
      if (!allowed.has(c)) { valid = false; break; }
    }
    if (!valid) continue;
    const isPangram = [...allSeven].every((l) => new Set(norm).has(l));
    results.push({ word: word.toUpperCase(), is_pangram: isPangram, category, length: norm.length });
  }
  return results;
}

function groupResults(wordList) {
  const groups = {};
  let total = 0;
  let pangramCount = 0;
  for (const w of wordList) {
    if (!groups[w.length]) groups[w.length] = [];
    groups[w.length].push(w);
    total++;
    if (w.is_pangram) pangramCount++;
  }
  const sortedGroups = {};
  for (const k of Object.keys(groups).sort((a, b) => a - b)) {
    sortedGroups[k] = groups[k].sort((a, b) => stripAccents(a.word).localeCompare(stripAccents(b.word)));
  }
  return { total, pangram_count: pangramCount, groups: sortedGroups };
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
  const [extraLoading, setExtraLoading] = useState(false);
  const [extraLoaded, setExtraLoaded] = useState(false);

  const [cleanWords, setCleanWords] = useState([]);
  const [extraWords, setExtraWords] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedWord, setSelectedWord] = useState(null);
  const [viewMode, setViewMode] = useState(0); // 0=clean, 1=+extras
  const [marks, setMarks] = useState({});

  const outerRefs = useRef([]);

  // Persist letters
  useEffect(() => { localStorage.setItem("soletra_center", centerLetter); }, [centerLetter]);
  useEffect(() => { localStorage.setItem("soletra_outer", JSON.stringify(outerLetters)); }, [outerLetters]);

  // Load/save marks
  useEffect(() => {
    if (!centerLetter || outerLetters.some((l) => !l)) return;
    const key = storageKey(centerLetter, outerLetters);
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved) setMarks(saved);
    } catch { /* ignore */ }
  }, [centerLetter, outerLetters]);

  const saveMarks = useCallback((newMarks) => {
    setMarks(newMarks);
    if (centerLetter && outerLetters.every((l) => l)) {
      localStorage.setItem(storageKey(centerLetter, outerLetters), JSON.stringify(newMarks));
    }
  }, [centerLetter, outerLetters]);

  const handleMark = useCallback((word, mark) => {
    const updated = { ...marks };
    if (updated[word] === mark) {
      delete updated[word];
    } else {
      updated[word] = mark;
    }
    saveMarks(updated);
  }, [marks, saveMarks]);

  // Build visible results based on viewMode
  const visibleResults = useMemo(() => {
    const words = viewMode === 0 ? cleanWords : [...cleanWords, ...extraWords];
    return groupResults(words);
  }, [cleanWords, extraWords, viewMode]);

  // Flat word list for navigation
  const allWords = useMemo(() =>
    visibleResults ? Object.values(visibleResults.groups).flat().map((w) => w.word) : [],
    [visibleResults]
  );
  const selectedIndex = selectedWord ? allWords.indexOf(selectedWord) : -1;

  const navigateWord = useCallback((dir) => {
    if (allWords.length === 0) return;
    let next = selectedIndex === -1 ? 0 : selectedIndex + dir;
    if (next < 0) next = allWords.length - 1;
    if (next >= allWords.length) next = 0;
    setSelectedWord(allWords[next]);
  }, [allWords, selectedIndex]);

  useEffect(() => {
    const handler = (e) => {
      if (!visibleResults || allWords.length === 0) return;
      if (e.key === "ArrowRight") { e.preventDefault(); navigateWord(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); navigateWord(-1); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visibleResults, allWords, navigateWord]);

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

  // Load extra dictionary on demand
  const loadExtraDict = useCallback(() => {
    if (extraLoaded || extraLoading) return;
    setExtraLoading(true);
    fetch("/br-extra.txt")
      .then((r) => r.text())
      .then((text) => {
        const words = text.split("\n").map((w) => w.trim()).filter((w) => w.length >= 4 && /^[a-zA-ZÀ-ÿ]+$/.test(w));
        setExtraDict(words);
        setExtraLoaded(true);
        setExtraLoading(false);
      })
      .catch(() => { setExtraLoading(false); });
  }, [extraLoaded, extraLoading]);

  // When extra dict loads and we have letters, solve extras
  useEffect(() => {
    if (extraDict.length > 0 && centerLetter && outerLetters.every((l) => l)) {
      const cleanSet = new Set(cleanWords.map((w) => w.word));
      const extras = solveWithDict(extraDict, centerLetter, outerLetters, "extra")
        .filter((w) => !cleanSet.has(w.word));
      setExtraWords(extras);
    }
  }, [extraDict, centerLetter, outerLetters, cleanWords]);

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
    setTimeout(() => {
      const clean = solveWithDict(dictionary, centerLetter, outerLetters, "clean");
      setCleanWords(clean);

      // If extra dict already loaded, solve extras too
      if (extraDict.length > 0) {
        const cleanSet = new Set(clean.map((w) => w.word));
        const extras = solveWithDict(extraDict, centerLetter, outerLetters, "extra")
          .filter((w) => !cleanSet.has(w.word));
        setExtraWords(extras);
      } else {
        setExtraWords([]);
      }

      setResults(true);
      setLoading(false);
    }, 50);
  };

  const handleReset = () => {
    setCenterLetter("");
    setOuterLetters(["", "", "", "", "", ""]);
    setCleanWords([]);
    setExtraWords([]);
    setResults(null);
    setError("");
    setSelectedWord(null);
    setViewMode(0);
    setMarks({});
    localStorage.removeItem("soletra_center");
    localStorage.removeItem("soletra_outer");
  };

  const handleToggleView = () => {
    if (viewMode === 0) {
      loadExtraDict();
      setViewMode(1);
    } else {
      setViewMode(0);
    }
  };

  const cleanTotal = cleanWords.length;
  const extraTotal = extraWords.length;
  const markedCorrect = Object.values(marks).filter((m) => m === "correct").length;
  const markedWrong = Object.values(marks).filter((m) => m === "wrong").length;

  return (
    <div
      className="min-h-screen bg-slate-50"
      style={{ backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 1px)", backgroundSize: "16px 16px" }}
    >
      <header className="pt-10 pb-4 text-center">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-slate-900" style={{ fontFamily: "Outfit, sans-serif" }} data-testid="app-title">
          Soletra Solver
        </h1>
        <p className="mt-2 text-base text-slate-500" style={{ fontFamily: "Manrope, sans-serif" }}>
          {dictLoading ? (
            <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" />Carregando dicionário...</span>
          ) : (
            `${dictionary.length.toLocaleString("pt-BR")} palavras carregadas`
          )}
        </p>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start mt-6">
          {/* Left: Hexagon + Controls */}
          <div className="lg:col-span-5 flex flex-col items-center gap-8">
            <div className="hex-container" data-testid="hex-container">
              <HexInput value={centerLetter} onChange={setCenterLetter} position="hex-center" isCenter={true} testId="center-letter-input" />
              {positions.map((pos, i) => (
                <div key={i} ref={(el) => (outerRefs.current[i] = el)}>
                  <HexInput value={outerLetters[i]} onChange={(val) => handleOuterChange(i, val)} position={pos} isCenter={false} testId={`outer-letter-input-${i}`} />
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center gap-3 w-full max-w-xs">
              <button className="btn-generate w-full flex items-center justify-center gap-2" onClick={handleSolve} disabled={!allFilled || loading || dictLoading} data-testid="generate-words-button">
                {loading ? <span className="loading-pulse">Buscando...</span> : <><Search size={20} />Gerar Palavras</>}
              </button>
              <button className="text-sm text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5 font-medium" onClick={handleReset} data-testid="reset-button" style={{ fontFamily: "Manrope, sans-serif" }}>
                <RotateCcw size={14} />Limpar tudo
              </button>
            </div>

            {/* Marks summary */}
            {results && (markedCorrect > 0 || markedWrong > 0) && (
              <div className="flex items-center gap-4 text-sm font-medium" data-testid="marks-summary">
                {markedCorrect > 0 && (
                  <span className="flex items-center gap-1 text-emerald-600"><Check size={14} />{markedCorrect} certa{markedCorrect !== 1 ? "s" : ""}</span>
                )}
                {markedWrong > 0 && (
                  <span className="flex items-center gap-1 text-red-500"><X size={14} />{markedWrong} errada{markedWrong !== 1 ? "s" : ""}</span>
                )}
              </div>
            )}

            {error && <p className="text-red-500 text-sm text-center" data-testid="error-message">{error}</p>}
          </div>

          {/* Right: Results */}
          <div className="lg:col-span-7 results-panel p-6 sm:p-8" data-testid="results-section">
            {!results && !loading && (
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

            {results && visibleResults && (
              <div>
                {/* Summary bar */}
                <div className="flex flex-wrap items-center gap-3 mb-6 pb-4 border-b border-slate-100" data-testid="results-summary">
                  <div className="text-2xl font-bold text-slate-900" style={{ fontFamily: "Outfit, sans-serif" }}>
                    {cleanTotal} palavra{cleanTotal !== 1 ? "s" : ""}
                  </div>
                  {visibleResults.pangram_count > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 font-semibold text-sm">
                      <Sparkles size={14} />{visibleResults.pangram_count}
                    </div>
                  )}
                  {/* View toggle */}
                  <button
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${viewMode === 1 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                    onClick={handleToggleView}
                    data-testid="toggle-extras-button"
                  >
                    {extraLoading ? <Loader2 size={14} className="animate-spin" /> : viewMode === 1 ? <EyeOff size={14} /> : <Eye size={14} />}
                    {viewMode === 1 ? `Ocultar extras (${extraTotal})` : "Mostrar extras"}
                  </button>

                  {/* Navigation */}
                  {allWords.length > 0 && (
                    <div className="flex items-center gap-1 ml-auto" data-testid="word-navigator">
                      <button className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors" onClick={() => navigateWord(-1)} data-testid="nav-prev-button">
                        <ChevronLeft size={16} className="text-slate-600" />
                      </button>
                      <span className="text-xs text-slate-400 font-medium min-w-[3rem] text-center">
                        {selectedIndex >= 0 ? `${selectedIndex + 1}/${allWords.length}` : "—"}
                      </span>
                      <button className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors" onClick={() => navigateWord(1)} data-testid="nav-next-button">
                        <ChevronRight size={16} className="text-slate-600" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Word groups */}
                {visibleResults.total === 0 ? (
                  <p className="text-slate-400 text-center py-10" data-testid="no-results">Nenhuma palavra encontrada.</p>
                ) : (
                  Object.entries(visibleResults.groups).map(([len, words], index) => (
                    <ResultsGroup
                      key={len}
                      length={parseInt(len)}
                      words={words}
                      index={index}
                      selectedWord={selectedWord}
                      onSelectWord={(w) => setSelectedWord(w === selectedWord ? null : w)}
                      marks={marks}
                      onMark={handleMark}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
