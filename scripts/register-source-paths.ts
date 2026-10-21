// Lets Node run the app's TypeScript the way Vite resolves it: `@/` is src/, and module paths name no extension.
// Loaded with `node --import`, for scripts that reuse the app's own code.
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";

const source = new URL("../src/", import.meta.url);

function sourceUrl(specifier: string, parentUrl: string | undefined): URL | undefined {
  if (specifier.startsWith("@/")) {
    return new URL(specifier.slice(2), source);
  }

  return specifier.startsWith("./") && parentUrl !== undefined
    ? new URL(specifier, parentUrl)
    : undefined;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = sourceUrl(specifier, context.parentURL);
    if (target === undefined || /\.[cm]?[jt]sx?$/.test(target.pathname)) {
      return nextResolve(target?.href ?? specifier, context);
    }

    const withExtension = [".ts", ".tsx"]
      .map((extension) => new URL(`${target.href}${extension}`))
      .find((candidate) => existsSync(candidate));

    return nextResolve(withExtension?.href ?? target.href, context);
  },
});
