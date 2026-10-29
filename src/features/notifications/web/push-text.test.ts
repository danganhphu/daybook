import { Temporal } from "temporal-polyfill/implementation";
import { describe, expect, it } from "vitest";

import * as AccessEvents from "@/features/access/domain/access-event";
import type { MorningContent } from "@/features/notifications/application/notification-content";
import { isNotice } from "@/features/notifications/domain/notice";
import { moneySchema } from "@/shared/domain/money-schema";
import { origin } from "@/testing/support/access";
import { anAuthorId, content } from "@/testing/support/app";

import { pushMessageFor } from "./push-text";

const thursday = Temporal.PlainDate.from("2026-10-29");

function due(text: string, dueOn: string, customerName?: string) {
  return { text: content(text), dueOn: Temporal.PlainDate.from(dueOn), customerName };
}

function morning(lists: Omit<MorningContent, "kind" | "day">): MorningContent {
  return { kind: "morning", day: thursday, ...lists };
}

describe("pushMessageFor, the morning list", () => {
  it("given four reminders, one late, when put into words, then it counts them, names three, says which is late, and counts the rest", () => {
    const { message } = pushMessageFor(
      morning({
        due: [
          due("gọi lại nha khoa Minh Châu", "2026-10-27", "Nha khoa Minh Châu"),
          due("giao 2 hộp thuốc tê", "2026-10-29"),
          due("hỏi giá găng tay", "2026-10-29"),
          due("gửi catalogue", "2026-10-29"),
        ],
        quiet: [],
      }),
      "2026-10-29",
    );

    expect(message.title).toBe("Hôm nay có 4 việc");
    expect(message.body.split("\n")).toEqual([
      "gọi lại nha khoa Minh Châu, Nha khoa Minh Châu (quá hạn 2 ngày)",
      "giao 2 hộp thuốc tê",
      "hỏi giá găng tay",
      "và 1 việc nữa",
    ]);
    expect(message.path).toBe("/reminders");
    expect(message.tag).toBe("morning-2026-10-29");
  });

  it("given only customers just gone quiet, when put into words, then it names them and opens the reports", () => {
    const { message } = pushMessageFor(
      morning({ due: [], quiet: ["Nha khoa Lan Anh", "Hướng Dương"] }),
      "2026-10-29",
    );

    expect(message.title).toBe("2 khách lâu không đặt");
    expect(message.body).toBe("Nha khoa Lan Anh, Hướng Dương");
    expect(message.path).toBe("/reports");
  });

  it("given a reminder pages long, when put into words, then its line is cut short", () => {
    const { message } = pushMessageFor(
      morning({ due: [due("rất dài ".repeat(40), "2026-10-29")], quiet: [] }),
      "2026-10-29",
    );

    expect(message.body.length).toBeLessThanOrEqual(80);
    expect(message.body.endsWith("...")).toBe(true);
  });

  it("given a digest, when sent, then its topic fits RFC 8030's 32 base64url characters, and it is urgent enough to wake the phone", () => {
    const { delivery } = pushMessageFor(morning({ due: [], quiet: ["A"] }), "2026-10-29");

    expect(delivery.topic).toMatch(/^[A-Za-z0-9_-]{1,32}$/);
    expect(delivery.urgency).toBe("high");
  });
});

describe("pushMessageFor, the Friday summary", () => {
  it("given a week, when put into words, then it gives orders, sales, money in, owed and the quiet count", () => {
    const { message } = pushMessageFor(
      {
        kind: "weekly",
        day: Temporal.PlainDate.from("2026-10-30"),
        orders: 12,
        sales: moneySchema.parse(8_450_000),
        received: moneySchema.parse(5_200_000),
        owed: moneySchema.parse(3_100_000),
        quiet: 2,
      },
      "2026-10-30",
    );

    expect(message.title).toBe("Tuần này: 12 đơn, 8.450.000đ");
    expect(message.body).toBe("Thu về 5.200.000đ. Còn nợ 3.100.000đ. 2 khách lâu không đặt.");
    expect(message.path).toBe("/reports?period=week&on=2026-10-30");
  });
});

describe("pushMessageFor, a notice", () => {
  it("given a recovery link the other person made, when put into words, then it says who, when and on what", () => {
    const event = AccessEvents.record(
      "setup_link_issued",
      { accountId: anAuthorId, detail: { purpose: "recovery" } },
      origin("203.0.113.7", "Chrome trên Windows"),
      Temporal.Instant.from("2026-10-29T02:12:00Z"),
    );
    if (!isNotice(event)) {
      throw new Error("expected a notice");
    }

    const { message, delivery } = pushMessageFor(
      { kind: "notice", notice: event, byOther: "Minh" },
      event.id,
    );

    expect(message.title).toBe("Vừa có link khôi phục cho tài khoản của bạn");
    expect(message.body).toBe(
      "Minh làm. Lúc 09:12 29/10, trên Chrome trên Windows. Nếu bạn không biết việc này, hãy mở Cài đặt.",
    );
    expect(message.path).toBe("/settings/activity");
    expect(delivery.topic).toBeUndefined();
    expect(delivery.urgency).toBe("high");
  });
});
