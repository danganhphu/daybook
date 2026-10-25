import type { Temporal } from "temporal-polyfill/implementation";
import { z } from "zod";

import type {
  MessageReader,
  ReaderAnswer,
  ReaderFailure,
} from "@/features/reading/application/message-reader";
import type { Reader } from "@/features/reading/domain/interpretation";
import { readingSchema } from "@/features/reading/domain/reading";
import type { Content } from "@/shared/domain/content";
import { err, ok, type Result } from "@/shared/domain/result";

import { promptVersion, responseFormat, systemPrompt } from "./reading-prompt";

// The one call this adapter makes on the Workers AI binding
export type ModelRunner = {
  run(
    model: string,
    inputs: Record<string, unknown>,
    options: { readonly signal: AbortSignal },
  ): Promise<unknown>;
};

type Model = { readonly id: string; readonly inputs: Record<string, unknown> };

// Chosen by measurement (ADR 0012): the first reads every message, the second only when the first fails. Thinking
// stays off, as it was measured.
const first: Model = {
  id: "@cf/google/gemma-4-26b-a4b-it",
  inputs: { chat_template_kwargs: { enable_thinking: false } },
};
const second: Model = { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", inputs: {} };

// Step 0 answered in 2 to 5 seconds; past this a person has long stopped waiting
const answerWithinMilliseconds = 20_000;

// Measured answers run under 100 tokens; this stops a runaway one
const maxAnswerTokens = 500;

// The parts of a chat completion this reads: the answer, as text or already parsed, and its cost
const outputSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullish() }) })).optional(),
  response: z.unknown().optional(),
  usage: z.object({ neurons: z.number().nonnegative().optional() }).optional(),
});

function answerIn(output: z.infer<typeof outputSchema>): unknown {
  const content = output.choices?.[0]?.message.content;
  if (typeof content !== "string") {
    return output.response;
  }
  try {
    return JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1));
  } catch {
    return undefined;
  }
}

// Workers AI's codes (developers.cloudflare.com/workers-ai/platform/errors): 3036 is the day's free Neurons spent,
// 3007 and 3008 a request that timed out or was aborted
function failureOf(error: unknown): ReaderFailure["failure"] {
  const said: string[] = [];
  for (let current = error; current instanceof Error; current = current.cause) {
    said.push(current.name, current.message);
  }
  const text = said.join(" ");
  if (/\b3036\b|daily free allocation/i.test(text)) {
    return "quota";
  }
  if (/\b300[78]\b|TimeoutError|AbortError/.test(text)) {
    return "timeout";
  }

  return "error";
}

async function readWith(
  ai: ModelRunner,
  model: Model,
  text: Content,
  today: Temporal.PlainDate,
): Promise<Result<ReaderAnswer, ReaderFailure>> {
  const reader: Reader = { model: model.id, promptVersion };
  let raw: unknown;
  try {
    raw = await ai.run(
      model.id,
      {
        messages: [
          { role: "system", content: systemPrompt(today) },
          { role: "user", content: text },
        ],
        response_format: responseFormat,
        temperature: 0,
        max_tokens: maxAnswerTokens,
        ...model.inputs,
      },
      { signal: AbortSignal.timeout(answerWithinMilliseconds) },
    );
  } catch (error) {
    return err({ failure: failureOf(error), reader, neurons: undefined });
  }

  const output = outputSchema.safeParse(raw);
  const neurons = output.success ? output.data.usage?.neurons : undefined;
  const reading = output.success ? readingSchema.safeParse(answerIn(output.data)) : undefined;

  return reading?.success === true
    ? ok({ reading: reading.data, reader, neurons })
    : err({ failure: "schema", reader, neurons });
}

function plus(a: number | undefined, b: number | undefined): number | undefined {
  return a === undefined && b === undefined ? undefined : (a ?? 0) + (b ?? 0);
}

// Reads with the first model, and once more with the second when it fails - unless the day's Neurons are spent,
// which every model on the account shares. What both calls cost is counted on the answer kept.
export function createWorkersAiReader(ai: ModelRunner): MessageReader {
  return {
    async read(text, today) {
      const tried = await readWith(ai, first, text, today);
      if (tried.ok || tried.error.failure === "quota") {
        return tried;
      }

      const again = await readWith(ai, second, text, today);
      const spent = plus(tried.error.neurons, again.ok ? again.value.neurons : again.error.neurons);

      return again.ok
        ? ok({ ...again.value, neurons: spent })
        : err({ ...again.error, neurons: spent });
    },
  };
}
