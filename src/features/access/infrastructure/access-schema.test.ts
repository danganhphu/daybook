import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

// Guards what the access migration adds by hand - STRICT, the append-only and redeem-once triggers - and the
// checks that keep the rules in the database as well as in code. A regenerated migration that loses one fails here.

const accountId = "019a0000-0000-7000-8000-000000000001";
const handle = "H".repeat(43);
const hash = "S".repeat(43);

function run(sql: string, ...values: ReadonlyArray<unknown>) {
  return env.DB.prepare(sql)
    .bind(...values)
    .run();
}

function insertAccount(id: unknown, username: unknown, userHandle: unknown = handle) {
  return run(
    "insert into account (id, username, display_name, webauthn_user_handle, created_at, updated_at) values (?, ?, 'Lan', ?, 1, 1)",
    id,
    username,
    userHandle,
  );
}

function insertLink(
  purpose: string,
  linkAccount: unknown,
  createdBy: unknown,
  redeemedAt: unknown = null,
) {
  return run(
    "insert into setup_link (id, purpose, account_id, created_by, token_hash, created_at, expires_at, redeemed_at) values ('l1', ?, ?, ?, ?, 1, 2, ?)",
    purpose,
    linkAccount,
    createdBy,
    hash,
    redeemedAt,
  );
}

function insertSession(method: string, passkeyId: unknown, verifier: unknown = hash) {
  return run(
    "insert into session (id, account_id, verifier, method, passkey_id, authenticated_at, expires_at, last_seen_at, device_label) values ('s1', ?, ?, ?, ?, 1, 2, 1, 'Chrome')",
    accountId,
    verifier,
    method,
    passkeyId,
  );
}

function insertEvent(kind: string, detail: unknown = null) {
  return run(
    "insert into access_event (id, occurred_at, kind, device_label, detail) values ('e1', 1, ?, 'Chrome', ?)",
    kind,
    detail,
  );
}

describe("STRICT on every access table", () => {
  it.each([
    ["account", "insert into account values ('a', 'lan', 'Lan', ?, 'soon', 1)", [handle]],
    [
      "session",
      "insert into session values ('s', 'a', ?, 'password', null, 'soon', 2, 1, 'x')",
      [hash],
    ],
    [
      "setup_link",
      "insert into setup_link values ('l', 'recovery', 'a', null, ?, 'soon', 2, null)",
      [hash],
    ],
    ["ceremony", "insert into ceremony values ('c', 'setup', ?, null, 'l', 'soon', 2)", [hash]],
    [
      "access_event",
      "insert into access_event values ('e', 'soon', 'session_ended', null, null, null, null, null, 'x', null)",
      [],
    ],
    [
      "passkey",
      "insert into passkey values ('p', 'a', 'c', 'k', -7, 'many', '[]', 'g', 0, 0, 'n', 1, null)",
      [],
    ],
    ["rate_limit", "insert into rate_limit values ('k', 'soon', 1)", []],
  ])(
    "given text in an integer column of %s, when inserted, then STRICT refuses it",
    async (_, sql, values) => {
      await expect(run(sql, ...values)).rejects.toThrow(
        /cannot store TEXT value in INTEGER column/,
      );
    },
  );
});

describe("account table", () => {
  it.each([["Lan"], ["lân"], ["la"], ["lan anh"]])(
    "given the username %j, when inserted, then the format check refuses it",
    async (username) => {
      await expect(insertAccount(accountId, username)).rejects.toThrow(/account_username_format/);
    },
  );

  it("given a user handle of the wrong length, when inserted, then the check refuses it", async () => {
    await expect(insertAccount(accountId, "lan", "short")).rejects.toThrow(
      /account_user_handle_length/,
    );
  });

  it("given a username already taken, when inserted, then the unique index refuses it", async () => {
    await insertAccount(accountId, "lan");

    await expect(
      insertAccount("019a0000-0000-7000-8000-000000000002", "lan", "K".repeat(43)),
    ).rejects.toThrow(/UNIQUE constraint failed: account\.username/);
  });
});

describe("setup_link table", () => {
  it("given a redeemed link, when updated again, then the trigger refuses it", async () => {
    await insertAccount(accountId, "lan");
    await insertLink("recovery", accountId, null);
    await run("update setup_link set redeemed_at = 1 where id = 'l1'");

    await expect(run("update setup_link set redeemed_at = 2 where id = 'l1'")).rejects.toThrow(
      /setup_link is redeemed once/,
    );
  });

  it("given an unredeemed invite that already names an account, when inserted, then the check refuses it", async () => {
    await insertAccount(accountId, "lan");

    await expect(insertLink("invite", accountId, accountId)).rejects.toThrow(
      /setup_link_account_by_purpose/,
    );
  });

  it("given a recovery link with no account, when inserted, then the check refuses it", async () => {
    await expect(insertLink("recovery", null, null)).rejects.toThrow(
      /setup_link_account_by_purpose/,
    );
  });

  it("given a first-setup link with an author, when inserted, then the check refuses it", async () => {
    await insertAccount(accountId, "lan");

    await expect(insertLink("first_setup", accountId, accountId)).rejects.toThrow(
      /setup_link_author_by_purpose/,
    );
  });
});

describe("session table", () => {
  it("given a password session that names a passkey, when inserted, then the check refuses it", async () => {
    await insertAccount(accountId, "lan");

    await expect(insertSession("password", "p1")).rejects.toThrow(
      /session_password_names_no_passkey/,
    );
  });

  it("given a verifier of the wrong length, when inserted, then the check refuses it", async () => {
    await insertAccount(accountId, "lan");

    await expect(insertSession("password", null, "short")).rejects.toThrow(
      /session_verifier_length/,
    );
  });
});

describe("ceremony table", () => {
  it("given a setup ceremony with no link, when inserted, then the check refuses it", async () => {
    await expect(
      run(
        "insert into ceremony (id, kind, binding_hash, created_at, expires_at) values ('c1', 'setup', ?, 1, 2)",
        hash,
      ),
    ).rejects.toThrow(/ceremony_setup_names_its_link/);
  });
});

describe("access_event table", () => {
  it("given a stored event, when updated, then the trigger refuses it", async () => {
    await insertEvent("session_ended");

    await expect(run("update access_event set kind = 'session_opened'")).rejects.toThrow(
      /access_event is append-only/,
    );
  });

  it("given a stored event, when deleted, then the trigger refuses it", async () => {
    await insertEvent("session_ended");

    await expect(run("delete from access_event")).rejects.toThrow(/access_event is append-only/);
  });

  it("given an unknown kind, when inserted, then the check refuses it", async () => {
    await expect(insertEvent("password_shown")).rejects.toThrow(/access_event_kind_known/);
  });

  it("given detail that is not a JSON object, when inserted, then the check refuses it", async () => {
    await expect(insertEvent("session_ended", '["not", "an object"]')).rejects.toThrow(
      /access_event_detail_object/,
    );
  });
});

describe("passkey table", () => {
  it("given an algorithm the registration never offers, when inserted, then the check refuses it", async () => {
    await insertAccount(accountId, "lan");

    await expect(
      run(
        "insert into passkey values ('p1', ?, 'cred', 'key', -999, 0, '[]', 'aaguid', 0, 0, 'n', 1, null)",
        accountId,
      ),
    ).rejects.toThrow(/passkey_algorithm_offered/);
  });
});
