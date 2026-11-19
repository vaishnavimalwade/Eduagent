import { createServerFn } from "@tanstack/react-start";
import { generateResponse, GatewayError } from "@lovable.dev/ai-gateway";

type Msg = { role: "user" | "assistant"; content: string };

const SYSTEM =
  "You are EduAgent, a concise, encouraging university study coach. Explain concepts simply with real-world analogies. For exam plans use exactly three clear steps. Turn assignment briefs into realistic daily tasks. Use Markdown and fenced code when helpful. Never claim to complete graded work for the student.";

export const askCoach = createServerFn({ method: "POST" })
  .inputValidator((input: { message: string; context?: string; history?: Msg[] }) => {
    if (typeof input?.message !== "string" || !input.message.trim() || input.message.length > 6000)
      throw new Error("Enter a message under 6,000 characters.");
    const history = Array.isArray(input.history)
      ? input.history
          .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-12)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 6000) }))
      : [];
    return { message: input.message, context: input.context?.slice(0, 6000), history };
  })
  .handler(async ({ data }) => {
    const userText = data.context ? `Context:\n${data.context}\n\nQuestion:\n${data.message}` : data.message;
    const ownKey = process.env["OPENAI_API_KEY"];
    if (!process.env["LOVABLE_API_KEY"] && ownKey) {
      // Local fallback (exported ZIP): call OpenAI directly with your own key.
      try {
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${ownKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: process.env["OPENAI_MODEL"] || "gpt-4o-mini",
            messages: [{ role: "system", content: SYSTEM }, ...data.history, { role: "user", content: userText }],
          }),
        });
        if (r.status === 429) return { error: "The coach is busy right now. Try again in a minute." };
        if (!r.ok) return { error: `OpenAI error (${r.status}). Check your OPENAI_API_KEY.` };
        const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
        return { answer: j.choices?.[0]?.message?.content || "I couldn't generate a response." };
      } catch (error) {
        console.error(error);
        return { error: "Could not reach OpenAI." };
      }
    }
    if (!process.env["LOVABLE_API_KEY"]) {
      return { error: "AI coach not configured. Add OPENAI_API_KEY to your .env file to use it locally." };
    }
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions: SYSTEM,
        input: [...data.history, { role: "user" as const, content: userText }],
      });
      let answer = "";
      const output = (res as { output?: unknown[] }).output ?? [];
      for (const item of output) {
        const content = (item as { content?: unknown[] }).content;
        if (!Array.isArray(content)) continue;
        for (const c of content) {
          const part = c as { type?: string; text?: string };
          if (part.type === "output_text" && part.text) answer += part.text;
        }
      }
      return { answer: answer || "I couldn't generate a response." };
    } catch (error) {
      if (error instanceof GatewayError) {
        if (error.httpStatus === 429) return { error: "The coach is busy right now. Try again in a minute." };
        if (error.httpStatus === 402) return { error: "AI credits have run out for this workspace." };
      }
      console.error(error);
      return { error: "The AI coach is temporarily unavailable." };
    }
  });

export type StudyMaterial = {
  cards?: { front: string; back: string }[];
  questions?: { question: string; options: string[]; correctIndex: number; explanation: string }[];
};

const STUDY_SYSTEM =
  "You create active-recall study material for university students. Respond with ONLY a JSON object, no Markdown fences. Shape: {\"cards\":[{\"front\":\"short question\",\"back\":\"concise answer\"}],\"questions\":[{\"question\":\"...\",\"options\":[\"a\",\"b\",\"c\",\"d\"],\"correctIndex\":0,\"explanation\":\"why\"}]}. Fronts test one idea each; answers are 1-2 sentences. Quiz options are plausible, exactly 4, one correct, with varied correctIndex.";

async function runText(system: string, user: string): Promise<string> {
  const ownKey = process.env["OPENAI_API_KEY"];
  if (!process.env["LOVABLE_API_KEY"] && ownKey) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${ownKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env["OPENAI_MODEL"] || "gpt-4o-mini", messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    });
    if (!r.ok) throw new Error(`OpenAI ${r.status}`);
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    return j.choices?.[0]?.message?.content ?? "";
  }
  if (!process.env["LOVABLE_API_KEY"]) throw new Error("not-configured");
  const res = await generateResponse({ model: "openai/gpt-6-astra", instructions: system, input: [{ role: "user" as const, content: user }] });
  let text = "";
  for (const item of (res as { output?: unknown[] }).output ?? []) {
    const content = (item as { content?: unknown[] }).content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      const part = c as { type?: string; text?: string };
      if (part.type === "output_text" && part.text) text += part.text;
    }
  }
  return text;
}

export const generateStudyMaterial = createServerFn({ method: "POST" })
  .inputValidator((input: { topic: string; course?: string | undefined; notes?: string; kind: "cards" | "quiz" | "both"; count?: number }) => {
    if (typeof input?.topic !== "string" || !input.topic.trim()) throw new Error("Enter a topic.");
    const kind = input.kind === "cards" || input.kind === "quiz" ? input.kind : "both";
    const count = Math.min(20, Math.max(3, Number(input.count) || 8));
    return { topic: input.topic.slice(0, 300), course: input.course?.slice(0, 200), notes: input.notes?.slice(0, 12000), kind, count };
  })
  .handler(async ({ data }): Promise<{ result?: StudyMaterial; error?: string }> => {
    const want = data.kind === "cards" ? `${data.count} flashcards and no questions` : data.kind === "quiz" ? `${data.count} quiz questions and no cards` : `${data.count} flashcards and ${Math.max(3, Math.round(data.count / 2))} quiz questions`;
    const prompt = `Course: ${data.course || "General"}\nTopic: ${data.topic}\n${data.notes ? `Notes:\n${data.notes}\n` : ""}Create ${want}.`;
    try {
      const text = await runText(STUDY_SYSTEM, prompt);
      const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      const parsed = JSON.parse(json) as StudyMaterial;
      const cards = (parsed.cards ?? []).filter((c) => c && typeof c.front === "string" && typeof c.back === "string");
      const questions = (parsed.questions ?? []).filter(
        (q) => q && typeof q.question === "string" && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < q.options.length,
      );
      if (!cards.length && !questions.length) return { error: "The AI returned nothing usable. Try again with more detail." };
      return { result: { cards, questions } };
    } catch (error) {
      if (error instanceof Error && error.message === "not-configured") return { error: "AI not configured. Add OPENAI_API_KEY to your .env file to use it locally." };
      if (error instanceof GatewayError) {
        if (error.httpStatus === 429) return { error: "The AI is busy right now. Try again in a minute." };
        if (error.httpStatus === 402) return { error: "AI credits have run out for this workspace." };
      }
      console.error(error);
      return { error: "Could not generate study material. Please try again." };
    }
  });
