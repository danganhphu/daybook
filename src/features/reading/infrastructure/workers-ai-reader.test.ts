import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import { err, ok } from "@/shared/domain/result";
import { content } from "@/testing/support/app";
import { aLine, anOrderReading } from "@/testing/support/readings";

import { promptVersion, systemPrompt } from "./reading-prompt";
import { createWorkersAiReader, type ModelRunner } from "./workers-ai-reader";

const gemma = "@cf/google/gemma-4-26b-a4b-it";
const llama = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const monday = Temporal.PlainDate.from("2026-10-26");
const message = content("bán 2 hộp thuốc tê cho chị Lan 500k");
const reading = anOrderReading("chị Lan", [aLine("thuốc tê", 2, "500k")]);

type Call = { readonly model: string; readonly inputs: Record<string, unknown> };

// Answers each call in turn, as Workers AI would: an output, or an error thrown
function runner(...answers: ReadonlyArray<unknown>) {
  const calls: Call[] = [];
  const ai: ModelRunner = {
    async run(model, inputs) {
      calls.push({ model, inputs });
      const answer = answers[calls.length - 1];
      if (answer instanceof Error) {
        throw answer;
      }
      return answer;
    },
  };

  return { ai, calls };
}

// The chat completion shape both models answered with in step 0
function completion(answer: string, neurons?: number) {
  return {
    choices: [{ index: 0, message: { role: "assistant", content: answer } }],
    usage: {
      prompt_tokens: 611,
      completion_tokens: 52,
      ...(neurons === undefined ? {} : { neurons }),
    },
  };
}

describe("the Workers AI reader", () => {
  it("given the first model answers within the schema, when a message is read, then its reading, model and cost are kept and nobody else is asked", async () => {
    const { ai, calls } = runner(completion(JSON.stringify(reading), 6.97));

    expect(await createWorkersAiReader(ai).read(message, monday)).toEqual(
      ok({ reading, reader: { model: gemma, promptVersion }, neurons: 6.97 }),
    );
    expect(calls.map((call) => call.model)).toEqual([gemma]);
  });

  it("given a message, when it is sent, then the prompt carries today, the schema and no thinking, and the message is the user's turn", async () => {
    const { ai, calls } = runner(completion(JSON.stringify(reading)));

    await createWorkersAiReader(ai).read(message, monday);

    expect(calls[0]?.inputs).toMatchObject({
      messages: [
        { role: "system", content: systemPrompt(monday) },
        { role: "user", content: message },
      ],
      response_format: { type: "json_schema", json_schema: { type: "object" } },
      temperature: 0,
      chat_template_kwargs: { enable_thinking: false },
    });
  });

  it.each([
    ["errors", new Error("InferenceUpstreamError: 3040: Capacity temporarily exceeded")],
    ["answers outside the schema", completion('{"kind":"sale"}', 3)],
    ["answers with no JSON", completion("Xin lỗi, tôi không hiểu.", 3)],
  ])(
    "given the first model %s, when a message is read, then the second reads it and the cost of both is kept",
    async (_, first) => {
      const { ai, calls } = runner(first, {
        ...completion(JSON.stringify(reading), 29.07),
        response: reading,
      });

      const answer = await createWorkersAiReader(ai).read(message, monday);

      expect(calls.map((call) => call.model)).toEqual([gemma, llama]);
      expect(calls[1]?.inputs).not.toHaveProperty("chat_template_kwargs");
      expect(answer).toMatchObject(ok({ reading, reader: { model: llama, promptVersion } }));
    },
  );

  it("given both models fail the schema, when a message is read, then it fails as schema, by the second, at both costs", async () => {
    const { ai } = runner(completion("{}", 3), completion("{}", 20));

    expect(await createWorkersAiReader(ai).read(message, monday)).toEqual(
      err({ failure: "schema", reader: { model: llama, promptVersion }, neurons: 23 }),
    );
  });

  it("given the day's Neurons are spent, when a message is read, then it fails as quota without asking the second model, which draws on the same allowance", async () => {
    const { ai, calls } = runner(
      new Error("3036: you have used up your daily free allocation of 10,000 neurons"),
    );

    expect(await createWorkersAiReader(ai).read(message, monday)).toEqual(
      err({ failure: "quota", reader: { model: gemma, promptVersion }, neurons: undefined }),
    );
    expect(calls).toHaveLength(1);
  });

  it.each([
    ["a timeout of ours", new DOMException("The operation timed out", "TimeoutError")],
    ["Workers AI's timeout", new Error("3007: Request timeout")],
  ])(
    "given %s on both models, when a message is read, then it fails as timeout",
    async (_, error) => {
      const { ai } = runner(error, error);

      expect(await createWorkersAiReader(ai).read(message, monday)).toMatchObject(
        err({ failure: "timeout", reader: { model: llama } }),
      );
    },
  );
});

describe("the reading prompt", () => {
  it.each([
    ["Monday 2026-10-26", "2026-10-26", "Monday 2026-10-26 (Thứ Hai, 26/10/2026)", "2026-10-27"],
    ["a Tuesday", "2026-10-27", "Tuesday 2026-10-27 (Thứ Ba, 27/10/2026)", "2026-11-03"],
    ["a Sunday", "2026-11-01", "Sunday 2026-11-01 (Chủ Nhật, 1/11/2026)", "2026-11-03"],
  ])(
    "given %s, when the prompt is made, then it says the day and its example's Tuesday is the next one",
    (_, day, said, tuesday) => {
      const prompt = systemPrompt(Temporal.PlainDate.from(day));

      expect(prompt).toContain(`Today is ${said}.`);
      expect(prompt).toContain(`"dueOn":"${tuesday}"`);
    },
  );
});
