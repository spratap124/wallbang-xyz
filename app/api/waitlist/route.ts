import { waitlistSchema } from "@/lib/validations/waitlist";
import type { ApiResult } from "@/lib/api/waitlist";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON body." } satisfies ApiResult<never>,
      { status: 400 },
    );
  }

  const parsed = waitlistSchema.safeParse(body);

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "form";
      fieldErrors[key] = fieldErrors[key] ?? [];
      fieldErrors[key].push(issue.message);
    }

    return Response.json(
      {
        ok: false,
        error: "Validation failed.",
        fieldErrors,
      } satisfies ApiResult<never>,
      { status: 422 },
    );
  }

  // Mock persistence — replace with database / email provider later.
  await new Promise((resolve) => setTimeout(resolve, 450));

  return Response.json({
    ok: true,
    data: { id: crypto.randomUUID() },
  } satisfies ApiResult<{ id: string }>);
}
