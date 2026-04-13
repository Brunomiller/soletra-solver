import { useState, useRef, useCallback, useEffect } from "react";
import "@/App.css";
import { Sparkles, Search, RotateCcw, Hash, Loader2 } from "lucide-react";

function HexInput({ value, onChange, position, isCenter, testId }) {
  const inputRef = useRef(null);

  const handleChange = (e) => {
    const val = e.target.value.slice(-1).toUpperCase();
    if (/^[A-Za-zÀ-ÿ]?$/.test(val)) {
      onChange(val);
    }
  };

  const handleFocus = () => {
    if (inputRef.current) inputRef.current.select();
  };

  return (
    <div className={`hex-pos ${position}`}>
      <input
        ref={inputRef}
        type="text"
        maxLength={1}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        className={`hex-input ${isCenter ? "hex-input-center" : "hex-input-outer"}`}
        data-testid={testId}
        autoComplete="off"
      />
    </div>
  );
}

function WordBadge({ word, isPangram }) {
  const testId = isPangram ? `pangram-word-${word.toLowerCase()}` : `word-${word.toLowerCase()}`;
  return (
    <span
      className={`word-badge ${isPangram ? "word-badge-pangram" : ""}`}
      data-testid={testId}
    >
      {isPangram && <Sparkles size={14} />}
      {word}
    </span>
  );
}

function ResultsGroup({ length, words, index }) {
  return (
    <div
      className="fade-in-up mb-6"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="flex items-center gap-3 border-b border-slate-100 pb-2 mb-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100">
          <Hash size={14} className="text-slate-500" />
        </div>
        <h3
          className="text-lg font-semibold tracking-tight text-slate-800"
          style={{ fontFamily: "Outfit, sans-serif" }}
        >
          {length} letras
        </h3>
        <span className="text-sm text-slate-400 font-medium">
          ({words.length})
        </span>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {words.map((w) => (
          <WordBadge key={w.word} word={w.word} isPangram={w.is_pangram} />
        ))}
      </div>
    </div>
  );
}

// Strip accents: "ação" -> "acao"
function stripAccents(s) {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function solveWords(dictionary, centerLetter, outerLetters) {
  const center = stripAccents(centerLetter.toLowerCase());
  const allowed = new Set(outerLetters.map((c) => stripAccents(c.toLowerCase())));
  allowed.add(center);
  const allSeven = new Set(allowed);

  const groups = {};
  let total = 0;
  let pangramCount = 0;

  for (const word of dictionary) {
    const normalized = stripAccents(word.toLowerCase());
    if (!normalized.includes(center)) continue;
    let valid = true;
    for (const c of normalized) {
      if (!allowed.has(c)) { valid = false; break; }
    }
    if (!valid) continue;

    const letters = new Set(normalized);
    const isPangram = [...allSeven].every((l) => letters.has(l));
    if (isPangram) pangramCount++;

    const len = normalized.length;
    if (!groups[len]) groups[len] = [];
    groups[len].push({ word: word.toUpperCase(), is_pangram: isPangram });
    total++;
  }

  // Sort groups by key and words alphabetically
  const sortedGroups = {};
  for (const k of Object.keys(groups).sort((a, b) => a - b)) {
    sortedGroups[k] = groups[k].sort((a, b) =>
      stripAccents(a.word).localeCompare(stripAccents(b.word))
    );
  }

  return { total, pangram_count: pangramCount, groups: sortedGroups };
}

export default function App() {
  const [centerLetter, setCenterLetter] = useState("");
  const [outerLetters, setOuterLetters] = useState(["", "", "", "", "", ""]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dictionary, setDictionary] = useState([]);
  const [dictLoading, setDictLoading] = useState(true);

  const outerRefs = useRef([]);

  // Load dictionary once on mount
  useEffect(() => {
    fetch("/br-utf8.txt")
      .then((res) => res.text())
      .then((text) => {
        const words = text
          .split("\n")
          .map((w) => w.trim())
          .filter((w) => w.length >= 4 && /^[a-zA-ZÀ-ÿ]+$/.test(w));
        setDictionary(words);
        setDictLoading(false);
      })
      .catch(() => {
        setError("Erro ao carregar dicionário.");
        setDictLoading(false);
      });
  }, []);

  const positions = [
    "hex-top",
    "hex-top-right",
    "hex-bottom-right",
    "hex-bottom",
    "hex-bottom-left",
    "hex-top-left",
  ];

  const allFilled = centerLetter && outerLetters.every((l) => l !== "");

  const handleOuterChange = useCallback(
    (index, val) => {
      const updated = [...outerLetters];
      updated[index] = val;
      setOuterLetters(updated);
      if (val && index < 5) {
        const nextEmpty = updated.findIndex((l, i) => i > index && l === "");
        if (nextEmpty !== -1 && outerRefs.current[nextEmpty]) {
          outerRefs.current[nextEmpty].querySelector("input")?.focus();
        }
      }
    },
    [outerLetters]
  );

  const handleSolve = () => {
    if (!allFilled || dictionary.length === 0) return;
    setLoading(true);
    setError("");
    setResults(null);
    // Use setTimeout to let the UI show loading state
    setTimeout(() => {
      const result = solveWords(dictionary, centerLetter, outerLetters);
      setResults(result);
      setLoading(false);
    }, 50);
  };

  const handleReset = () => {
    setCenterLetter("");
    setOuterLetters(["", "", "", "", "", ""]);
    setResults(null);
    setError("");
  };

  return (
    <div
      className="min-h-screen bg-slate-50"
      style={{
        backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 1px)",
        backgroundSize: "16px 16px",
      }}
    >
      {/* Header */}
      <header className="pt-10 pb-4 text-center">
        <h1
          className="text-4xl sm:text-5xl font-black tracking-tighter text-slate-900"
          style={{ fontFamily: "Outfit, sans-serif" }}
          data-testid="app-title"
        >
          Soletra Solver
        </h1>
        <p
          className="mt-2 text-base text-slate-500"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          {dictLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Carregando dicionário...
            </span>
          ) : (
            `${dictionary.length.toLocaleString("pt-BR")} palavras carregadas`
          )}
        </p>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start mt-6">
          {/* Left: Hexagon + Controls */}
          <div className="lg:col-span-5 flex flex-col items-center gap-8">
            {/* Hexagon */}
            <div className="hex-container" data-testid="hex-container">
              <HexInput
                value={centerLetter}
                onChange={setCenterLetter}
                position="hex-center"
                isCenter={true}
                testId="center-letter-input"
              />
              {positions.map((pos, i) => (
                <div key={i} ref={(el) => (outerRefs.current[i] = el)}>
                  <HexInput
                    value={outerLetters[i]}
                    onChange={(val) => handleOuterChange(i, val)}
                    position={pos}
                    isCenter={false}
                    testId={`outer-letter-input-${i}`}
                  />
                </div>
              ))}
            </div>

            {/* Buttons */}
            <div className="flex flex-col items-center gap-3 w-full max-w-xs">
              <button
                className="btn-generate w-full flex items-center justify-center gap-2"
                onClick={handleSolve}
                disabled={!allFilled || loading || dictLoading}
                data-testid="generate-words-button"
              >
                {loading ? (
                  <span className="loading-pulse">Buscando...</span>
                ) : (
                  <>
                    <Search size={20} />
                    Gerar Palavras
                  </>
                )}
              </button>
              <button
                className="text-sm text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5 font-medium"
                onClick={handleReset}
                data-testid="reset-button"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                <RotateCcw size={14} />
                Limpar tudo
              </button>
            </div>

            {error && (
              <p
                className="text-red-500 text-sm text-center"
                data-testid="error-message"
              >
                {error}
              </p>
            )}
          </div>

          {/* Right: Results */}
          <div
            className="lg:col-span-7 results-panel p-6 sm:p-8"
            data-testid="results-section"
          >
            {!results && !loading && (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <Search size={24} className="text-slate-400" />
                </div>
                <p
                  className="text-slate-400 text-lg font-medium"
                  style={{ fontFamily: "Manrope, sans-serif" }}
                  data-testid="empty-state"
                >
                  Preencha as letras e clique em "Gerar Palavras"
                </p>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center min-h-[300px]">
                <div className="loading-pulse text-slate-400 text-lg font-medium">
                  Buscando palavras...
                </div>
              </div>
            )}

            {results && (
              <div>
                {/* Summary */}
                <div
                  className="flex flex-wrap items-center gap-4 mb-8 pb-4 border-b border-slate-100"
                  data-testid="results-summary"
                >
                  <div
                    className="text-2xl font-bold text-slate-900"
                    style={{ fontFamily: "Outfit, sans-serif" }}
                  >
                    {results.total} palavra{results.total !== 1 ? "s" : ""}
                  </div>
                  {results.pangram_count > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 font-semibold text-sm">
                      <Sparkles size={14} />
                      {results.pangram_count} pangram{results.pangram_count !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>

                {/* Grouped Words */}
                {results.total === 0 ? (
                  <p className="text-slate-400 text-center py-10" data-testid="no-results">
                    Nenhuma palavra encontrada com essas letras.
                  </p>
                ) : (
                  Object.entries(results.groups).map(([len, words], index) => (
                    <ResultsGroup
                      key={len}
                      length={parseInt(len)}
                      words={words}
                      index={index}
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
