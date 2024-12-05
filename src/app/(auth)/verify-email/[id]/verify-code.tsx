"use client";

import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateVerificationCode } from "@/lib/auth/actions";
import { useRouter } from "next/navigation";
import React from "react";
import { useFormState } from "react-dom";

function VerifyCodeComponent({ verificationCodeId }: { verificationCodeId: string }) {
  // Create a wrapper action that appends verificationCodeId to FormData
  const formAction = async (prevState: any, formData: FormData) => {
    formData.append("verificationCodeId", verificationCodeId);
    return validateVerificationCode(prevState, formData);
  };

  const [state, dispatch] = useFormState(formAction, null);

  return (
    <Card className="w-full max-w-md bg-gray-300">
      <CardHeader className="text-center">
        <CardTitle>Verificação de Email</CardTitle>
        <CardDescription>Preencha o código enviado ao seu email para acessar.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={dispatch} className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="code">Código de Verificação</Label>
            <Input
              required
              id="code"
              placeholder="XXXXXX"
              autoComplete="code"
              name="code"
              type="text"
            />
          </div>

          {state?.fieldError ? (
            <ul className="list-disc space-y-1 rounded-lg border bg-destructive/10 p-2 text-[0.8rem] font-medium text-destructive">
              {Object.values(state.fieldError).map((err) => (
                <li className="ml-4" key={err}>
                  {err}
                </li>
              ))}
            </ul>
          ) : state?.formError ? (
            <p className="rounded-lg border bg-destructive/10 p-2 text-[0.8rem] font-medium text-destructive">
              {state?.formError}
            </p>
          ) : null}
          <SubmitButton className="w-full" aria-label="submit-btn">
            Verificar Código
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}

export default VerifyCodeComponent;
