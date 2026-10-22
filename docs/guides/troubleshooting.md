# Troubleshooting

Problems already met, and what fixed them.

| Symptom | Cause | Fix |
| --- | --- | --- |
| Signed in on `http://localhost:5173`, but Safari keeps returning to the sign-in page | Safari drops `Secure` cookies on `http://localhost`; the session cookie is `__Host-` | Use Chrome or Edge locally; WebKit is covered by the end-to-end tests over HTTPS |
| `pnpm dev` stops with "Port 5173 is in use" | Another dev server, or something else, holds it; the port is strict because passkeys belong to an exact origin | Stop the other process |
| `pnpm test:e2e` fails before any scenario because the URL is already used | Something holds port 4173, often an earlier preview | Stop it; the suite starts its own server on a fresh database |
| The dev server refuses to start after updating Cloudflare packages | `compatibilityDate` in `cloudflare.config.ts` is newer than the local workerd | Set it to the newest date workerd supports; `build` does not notice |
| `typecheck` says `DB` does not exist on `Env`, locally only | A stale `worker-configuration.d.ts` from an old plugin at the repository root | Delete it; the binding types live in `.cloudflare/types` |
| `pnpm install` fails with a trust downgrade on an old package | `trustPolicy: no-downgrade` sees an old transitive version as a possible takeover | Add the package to `trustPolicyIgnoreAfter` in `pnpm-workspace.yaml`, after checking it |
| A `.module.scss.d.ts` is out of date, or CI says they differ | Class names changed without a dev server or build running | Run `pnpm build` once and commit the generated files |
| The `vite-css-modules` command never exits | Vite's Sass compiler outlives the run | Do not use the CLI; the dev server and the build write the types |
| A setup link says "Link này không còn dùng được" | It was used, is older than ten minutes, or was mistyped; they all answer the same on purpose | Ask for a new one: from the other user's settings, or with `pnpm access:setup-link` |
| "Bạn đã thử quá nhiều lần" | Sign-in and setup links are rate limited per network | Wait a few minutes |
| Setting a password says "Không kiểm tra được mật khẩu" | The breach check (Have I Been Pwned) could not be reached; the password is refused rather than accepted unchecked | Check the connection and try again |
| `NO_COLOR` warnings in test output | The shell sets `NO_COLOR` while Playwright sets `FORCE_COLOR` | Harmless |
