export const appearancePreferences = ["system", "light", "dark"];

export function normalizeAppearancePreference(value) {
  return appearancePreferences.includes(value) ? value : "system";
}

export function resolveAppearance(preference, systemPrefersDark) {
  const normalized = normalizeAppearancePreference(preference);
  return normalized === "system" ? (systemPrefersDark ? "dark" : "light") : normalized;
}
