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
