export type Context7Probe =
  | { ok: true; libraryId: string }
  | { ok: false; error: string };

export async function probeContext7(): Promise<Context7Probe> {
  const key = process.env.CONTEXT7_API_KEY?.trim();
  if (!key) {
    return {
      ok: false,
      error: "Falta CONTEXT7_API_KEY en el entorno de este proceso.",
    };
  }

  const url = new URL("https://context7.com/api/v2/libs/search");
  url.searchParams.set("libraryName", "React");
  url.searchParams.set("query", "hooks");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      ok: false,
      error: `Context7 respondió ${response.status}.`,
    };
  }

  const body = (await response.json()) as {
    results?: Array<{ id?: string }>;
  };
  const libraryId = body.results?.[0]?.id;
  if (!libraryId) {
    return { ok: false, error: "Context7 no devolvió bibliotecas." };
  }

  return { ok: true, libraryId };
}
