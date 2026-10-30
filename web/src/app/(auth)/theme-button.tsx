"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { IconButton } from "@/components/ui/button";

/** Signed out there is no profile to save to, so the choice goes in the cookie only. */
export function ThemeButton() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const set = document.documentElement.dataset.theme;
    setDark(set ? set === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);
  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.cookie = `dawr_theme=${next}; path=/; max-age=31536000; samesite=lax`;
    setDark(!dark);
  }
  return (
    <IconButton label={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={toggle}>
      {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </IconButton>
  );
}
