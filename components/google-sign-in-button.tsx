"use client";

import { signIn } from "next-auth/react";

type GoogleSignInButtonProps = {
  className: string;
  label: string;
  sublabel?: string;
  callbackUrl?: string;
};

export function GoogleSignInButton({
  className,
  label,
  sublabel,
  callbackUrl = "/dashboard",
}: GoogleSignInButtonProps) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        void signIn("google", { callbackUrl });
      }}
    >
      <span className="nav-label">{label}</span>
      {sublabel ? <span className="nav-sublabel">{sublabel}</span> : null}
    </button>
  );
}
