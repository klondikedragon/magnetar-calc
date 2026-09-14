export const paletteModes = ["Scientific", "Number theory", "Sequences", "Ordinal / hierarchy", "Programmer"];

export function normalizePaletteMode(value) {
  if (["Calculator", "Scientific", "Trigonometry"].includes(value)) return "Scientific";
  return paletteModes.includes(value) ? value : "Scientific";
}
