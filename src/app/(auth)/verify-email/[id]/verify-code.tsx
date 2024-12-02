"use client";

import React from "react";

function VerifyCodeComponent({ verificationCodeId }: { verificationCodeId: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center gap-4 bg-gray-100 p-4">
      <input
        className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2 text-lg text-gray-900  "
        placeholder="*****"
        type="number input"
      />
      <button className="text-sm">não recebi o código</button>
      <button className="inline-flex items-center justify-center rounded-lg bg-gray-500 px-4 py-2 text-white hover:bg-gray-600 focus:ring-blue-500/50 active:bg-blue-700">
        Acessar
      </button>
    </div>
  );
}

export default VerifyCodeComponent;
