import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateStudyMaterial } from "@/lib/ai.functions";
import { uid, type AppData, type Deck, type Quiz } from "@/lib/edu-store";

type Mutate = (body: object) => Promise<void>;
const courseName = (data: AppData, id: string) => data.courses.find((c) => c.id === id)?.name ?? "General";

export function StudyView({ data, mutate }: { data: AppData; mutate: Mutate }) {
  const decks = data.decks ?? [];
  const quizzes = data.quizzes ?? [];
  const [tab, setTab] = useState<"decks" | "quizzes">("decks");
  const [creating, setCreating] = useState(false);
  const [playDeck, setPlayDeck] = useState<string | null>(null);
  const [playQuiz, setPlayQuiz] = useState<string | null>(null);
  const deck = decks.find((d) => d.id === playDeck);
  const quiz = quizzes.find((q) => q.id === playQuiz);

  if (deck) return <DeckPlayer deck={deck} mutate={mutate} onExit={() => setPlayDeck(null)} />;
  if (quiz) return <QuizRunner quiz={quiz} mutate={mutate} onExit={() => setPlayQuiz(null)} />;

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#76847b]">Active recall</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Flashcards & Quizzes</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#758078]">Generate decks and mini quizzes from a topic or your notes, then test yourself.</p>
        </div>
        <button className="primary-button" onClick={() => setCreating(true)}>+ Generate with AI</button>
      </div>
      <div className="mb-5 flex gap-2">
        {(["decks", "quizzes"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? "primary-button" : "secondary-button"}>
            {t === "decks" ? `Flashcard decks (${decks.length})` : `Quizzes (${quizzes.length})`}
          </button>
        ))}
      </div>
      {tab === "decks" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {decks.length === 0 && <p className="text-sm text-[#758078]">No decks yet. Generate one to get started.</p>}
          {decks.map((d) => {
            const m = d.cards.filter((c) => c.mastered).length;
            return (
              <div key={d.id} className="card p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#76847b]">{courseName(data, d.course)}</p>
                <h3 className="mt-1 text-lg font-semibold">{d.title}</h3>
                <p className="mt-1 text-sm text-[#758078]">{d.cards.length} cards · {m} mastered</p>
                <div className="mt-3 h-2 rounded-full bg-black/5"><div className="h-2 rounded-full bg-[#6758D9]" style={{ width: `${d.cards.length ? (m / d.cards.length) * 100 : 0}%` }} /></div>
                <div className="mt-4 flex gap-2">
                  <button className="primary-button" onClick={() => setPlayDeck(d.id)}>Study</button>
                  <button className="secondary-button" onClick={() => confirm("Delete this deck?") && mutate({ action: "delete", collection: "decks", id: d.id })}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {quizzes.length === 0 && <p className="text-sm text-[#758078]">No quizzes yet. Generate one to get started.</p>}
          {quizzes.map((q) => {
            const last = q.attempts[0];
            const best = q.attempts.reduce((b, a) => Math.max(b, a.score / a.total), 0);
            return (
              <div key={q.id} className="card p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#76847b]">{courseName(data, q.course)}</p>
                <h3 className="mt-1 text-lg font-semibold">{q.title}</h3>
                <p className="mt-1 text-sm text-[#758078]">
                  {q.questions.length} questions · {last ? `last ${last.score}/${last.total} · best ${Math.round(best * 100)}%` : "not attempted"}
                </p>
                <div className="mt-4 flex gap-2">
                  <button className="primary-button" onClick={() => setPlayQuiz(q.id)}>Start quiz</button>
                  <button className="secondary-button" onClick={() => confirm("Delete this quiz?") && mutate({ action: "delete", collection: "quizzes", id: q.id })}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {creating && <GenerateDialog data={data} mutate={mutate} onClose={() => setCreating(false)} onDone={(t) => { setTab(t); setCreating(false); }} />}
    </div>
  );
}

function GenerateDialog({ data, mutate, onClose, onDone }: { data: AppData; mutate: Mutate; onClose: () => void; onDone: (t: "decks" | "quizzes") => void }) {
  const gen = useServerFn(generateStudyMaterial);
  const [course, setCourse] = useState(data.courses[0]?.id ?? "");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [kind, setKind] = useState<"both" | "cards" | "quiz">("both");
  const [count, setCount] = useState(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await gen({ data: { topic, course: data.courses.find((c) => c.id === course)?.name, notes, kind, count } });
      if (res.error || !res.result) { setError(res.error ?? "Something went wrong."); return; }
      const now = new Date().toISOString();
      const { cards = [], questions = [] } = res.result;
      if (cards.length) await mutate({ action: "create", collection: "decks", data: { title: topic, course, topic, createdAt: now, cards: cards.map((c) => ({ id: uid(), front: c.front, back: c.back })) } });
      if (questions.length) await mutate({ action: "create", collection: "quizzes", data: { title: `${topic} quiz`, course, topic, createdAt: now, attempts: [], questions: questions.map((q) => ({ id: uid(), ...q })) } });
      onDone(cards.length ? "decks" : "quizzes");
    } catch {
      setError("Could not reach the AI. Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="card w-full max-w-lg space-y-4 bg-white p-6">
        <h2 className="text-xl font-semibold">Generate study material</h2>
        <label className="block"><span className="form-label">Course</span>
          <select className="form-input" value={course} onChange={(e) => setCourse(e.target.value)}>
            {data.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
        <label className="block"><span className="form-label">Topic</span>
          <input className="form-input" required value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Dynamic programming" /></label>
        <label className="block"><span className="form-label">Notes (optional)</span>
          <textarea className="form-input min-h-28" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste lecture notes or a summary…" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="form-label">Create</span>
            <select className="form-input" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="both">Flashcards + quiz</option><option value="cards">Flashcards only</option><option value="quiz">Quiz only</option>
            </select></label>
          <label className="block"><span className="form-label">How many</span>
            <input type="number" min={3} max={20} className="form-input" value={count} onChange={(e) => setCount(Number(e.target.value))} /></label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" disabled={busy}>{busy ? "Generating…" : "Generate"}</button>
        </div>
      </form>
    </div>
  );
}

function DeckPlayer({ deck, mutate, onExit }: { deck: Deck; mutate: Mutate; onExit: () => void }) {
  const [onlyLearning, setOnlyLearning] = useState(false);
  const [order, setOrder] = useState(() => deck.cards.map((c) => c.id));
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const cards = useMemo(() => order.map((id) => deck.cards.find((c) => c.id === id)!).filter((c) => c && (!onlyLearning || !c.mastered)), [order, deck.cards, onlyLearning]);
  const card = cards[Math.min(i, cards.length - 1)];
  const mastered = deck.cards.filter((c) => c.mastered).length;

  const go = (d: number) => { setFlipped(false); setI((x) => Math.max(0, Math.min(cards.length - 1, x + d))); };
  const mark = async (m: boolean) => {
    if (!card) return;
    await mutate({ action: "update", collection: "decks", id: deck.id, data: { cards: deck.cards.map((c) => (c.id === card.id ? { ...c, mastered: m } : c)) } });
    setFlipped(false);
    if (!onlyLearning || !m) setI((x) => Math.min(cards.length - 1, x + 1));
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); setFlipped((f) => !f); }
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button className="secondary-button" onClick={onExit}>← Back</button>
        <p className="text-sm text-[#758078]">{deck.title} · {mastered}/{deck.cards.length} mastered</p>
        <div className="flex gap-2">
          <button className="secondary-button" onClick={() => { setOrder([...order].sort(() => Math.random() - 0.5)); setI(0); setFlipped(false); }}>Shuffle</button>
          <button className="secondary-button" onClick={() => { setOnlyLearning(!onlyLearning); setI(0); }}>{onlyLearning ? "Show all" : "Hide mastered"}</button>
        </div>
      </div>
      {!card ? (
        <div className="card p-10 text-center"><p className="text-lg font-semibold">All cards mastered 🎉</p><button className="primary-button mt-4" onClick={() => setOnlyLearning(false)}>Review all</button></div>
      ) : (
        <>
          <div className="[perspective:1200px] cursor-pointer" onClick={() => setFlipped(!flipped)}>
            <div className="relative h-72 transition-transform duration-500 [transform-style:preserve-3d]" style={{ transform: flipped ? "rotateY(180deg)" : "none" }}>
              <div className="card absolute inset-0 grid place-items-center p-8 text-center [backface-visibility:hidden]">
                <div><p className="text-xs font-bold uppercase tracking-widest text-[#76847b]">Question</p><p className="mt-3 text-xl font-semibold">{card.front}</p></div>
              </div>
              <div className="card absolute inset-0 grid place-items-center bg-[#f4f2ff] p-8 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <div><p className="text-xs font-bold uppercase tracking-widest text-[#6758D9]">Answer</p><p className="mt-3 text-lg">{card.back}</p></div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-[#758078]">Card {Math.min(i, cards.length - 1) + 1} of {cards.length} · click or press Space to flip · ← → to move</p>
          <div className="mt-5 flex justify-center gap-2">
            <button className="secondary-button" onClick={() => go(-1)}>Prev</button>
            <button className="secondary-button" onClick={() => mark(false)}>Need practice</button>
            <button className="primary-button" onClick={() => mark(true)}>Mastered ✓</button>
            <button className="secondary-button" onClick={() => go(1)}>Next</button>
          </div>
        </>
      )}
    </div>
  );
}

function QuizRunner({ quiz, mutate, onExit }: { quiz: Quiz; mutate: Mutate; onExit: () => void }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const done = answers.length === quiz.questions.length;
  const score = answers.filter((a, k) => a === quiz.questions[k]?.correctIndex).length;
  const q = quiz.questions[i];

  const next = async () => {
    if (picked === null) return;
    const all = [...answers, picked];
    setAnswers(all); setPicked(null);
    if (all.length === quiz.questions.length) {
      const s = all.filter((a, k) => a === quiz.questions[k]?.correctIndex).length;
      await mutate({ action: "update", collection: "quizzes", id: quiz.id, data: { attempts: [{ score: s, total: all.length, date: new Date().toISOString() }, ...quiz.attempts].slice(0, 20) } });
    } else setI(i + 1);
  };
  const restart = () => { setI(0); setPicked(null); setAnswers([]); };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between">
        <button className="secondary-button" onClick={onExit}>← Back</button>
        <p className="text-sm text-[#758078]">{quiz.title}</p>
      </div>
      {done ? (
        <div className="card p-6">
          <p className="text-center text-4xl font-semibold">{score}/{quiz.questions.length}</p>
          <p className="mt-1 text-center text-sm text-[#758078]">{Math.round((score / quiz.questions.length) * 100)}% correct</p>
          <ul className="mt-6 space-y-3">
            {quiz.questions.map((qq, k) => {
              const ok = answers[k] === qq.correctIndex;
              return (
                <li key={qq.id} className="rounded-xl border border-black/10 p-3 text-sm">
                  <p className="font-semibold">{ok ? "✓" : "✗"} {qq.question}</p>
                  {!ok && <p className="mt-1 text-red-600">Your answer: {qq.options[answers[k] ?? 0]}</p>}
                  <p className="mt-1 text-green-700">Correct: {qq.options[qq.correctIndex]}</p>
                  <p className="mt-1 text-[#758078]">{qq.explanation}</p>
                </li>
              );
            })}
          </ul>
          <div className="mt-5 flex justify-center gap-2"><button className="primary-button" onClick={restart}>Retry</button><button className="secondary-button" onClick={onExit}>Done</button></div>
        </div>
      ) : q ? (
        <div className="card p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[#76847b]">Question {i + 1} of {quiz.questions.length}</p>
          <h2 className="mt-2 text-xl font-semibold">{q.question}</h2>
          <div className="mt-5 space-y-2">
            {q.options.map((o, k) => (
              <button key={k} onClick={() => setPicked(k)}
                className={`w-full rounded-xl border p-3 text-left text-sm transition ${picked === k ? "border-[#6758D9] bg-[#f4f2ff]" : "border-black/10 hover:bg-black/5"}`}>
                {String.fromCharCode(65 + k)}. {o}
              </button>
            ))}
          </div>
          <div className="mt-5 flex justify-end"><button className="primary-button" disabled={picked === null} onClick={next}>{i + 1 === quiz.questions.length ? "Finish" : "Next"}</button></div>
        </div>
      ) : null}
    </div>
  );
}
