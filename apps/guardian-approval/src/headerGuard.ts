// Runs before anything else (imported first in main.tsx).
//
// Some browser extensions wrap window.fetch / Headers and inject a header whose
// value contains a non-Latin-1 code point. The native Headers.set then throws
// "Failed to execute 'set' on 'Headers': String contains non ISO-8859-1 code
// point", which surfaced as a hard ERROR on the Guardian portal.
//
// Defensive layer 1: globally sanitize Headers.set / .append values. This also
// helps non-Supabase fetches (e.g. viem RPC). If the runtime has frozen the
// intrinsics (SES lockdown), the assignment throws and we silently fall back to
// the XHR-based Supabase fetch in App.tsx, which avoids window.fetch entirely.
try {
  const proto = Headers.prototype as unknown as Record<string, unknown> & {
    set: (name: string, value: string) => void;
    append: (name: string, value: string) => void;
  };
  const clean = (value: unknown) => String(value).replace(/[^\x00-\xFF]/g, "");

  for (const method of ["set", "append"] as const) {
    const original = proto[method] as ((name: string, value: string) => void) | undefined;
    if (typeof original === "function" && !(original as { __trezoPatched?: boolean }).__trezoPatched) {
      const patched = function (this: Headers, name: string, value: string) {
        return original.call(this, name, clean(value));
      };
      (patched as { __trezoPatched?: boolean }).__trezoPatched = true;
      (proto as Record<string, unknown>)[method] = patched;
    }
  }
} catch {
  // Intrinsics are frozen — rely on the XHR fetch path instead.
}

export {};
