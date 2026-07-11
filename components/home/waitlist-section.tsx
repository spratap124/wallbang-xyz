"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Container, SectionHeading } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitWaitlist } from "@/lib/api/waitlist";
import {
  waitlistSchema,
  type WaitlistInput,
} from "@/lib/validations/waitlist";

export function WaitlistSection() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WaitlistInput>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: { name: "", email: "" },
  });

  async function onSubmit(values: WaitlistInput) {
    setServerError(null);
    const result = await submitWaitlist(values);

    if (!result.ok) {
      setServerError(result.error);
      return;
    }

    setSuccess(true);
    reset();
  }

  return (
    <section id="waitlist" className="border-t border-border bg-card/30 py-20 sm:py-24">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1fr_24rem] lg:items-start">
          <SectionHeading
            eyebrow="Waitlist"
            title="Be first when public servers open"
            description="Leave your name and email for launch notices. For real-time updates, Discord remains the primary channel."
            className="mb-0"
          />

          <div className="rounded-xl border border-border bg-background p-6">
            {success ? (
              <p className="text-sm leading-relaxed text-foreground" role="status">
                You&apos;re on the list. We&apos;ll reach out when WallBang public alpha
                moves forward.
              </p>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
                <div className="space-y-2">
                  <Label htmlFor="waitlist-name">Name</Label>
                  <Input
                    id="waitlist-name"
                    autoComplete="name"
                    aria-invalid={Boolean(errors.name)}
                    {...register("name")}
                  />
                  {errors.name ? (
                    <p className="text-xs text-destructive" role="alert">
                      {errors.name.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="waitlist-email">Email</Label>
                  <Input
                    id="waitlist-email"
                    type="email"
                    autoComplete="email"
                    aria-invalid={Boolean(errors.email)}
                    {...register("email")}
                  />
                  {errors.email ? (
                    <p className="text-xs text-destructive" role="alert">
                      {errors.email.message}
                    </p>
                  ) : null}
                </div>

                {serverError ? (
                  <p className="text-xs text-destructive" role="alert">
                    {serverError}
                  </p>
                ) : null}

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting…" : "Join waitlist"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
