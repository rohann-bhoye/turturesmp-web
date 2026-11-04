"use client";
import Icon from "./Icons";

export default function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
  };
  return (
    <button className="icon-btn theme-toggle" onClick={toggle} aria-label="Switch light or dark theme" title="Switch theme">
      <Icon name="sun" className="i-sun" />
      <Icon name="moon" className="i-moon" />
    </button>
  );
}
