import { z } from "zod";

// Runs before the app's own code in the browser. The CSP has no 'unsafe-eval', so Zod's compiled parsers could never
// run here; jitless spares the `new Function` probe the browser blocks and reports on every page. The Worker turns it
// off by itself.
z.config({ jitless: true });
