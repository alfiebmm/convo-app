"use client";

import { signOut } from "next-auth/react";

interface UserMenuProps {
  name: string;
  email: string;
  avatarUrl: string | null;
}

export function UserMenu({ name, email, avatarUrl }: UserMenuProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <p className="text-sm font-medium text-slate-900 leading-tight">
          {name}
        </p>
        <p className="text-xs text-slate-400">{email}</p>
      </div>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name}
          className="h-8 w-8 rounded-full"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm font-medium text-slate-600">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
