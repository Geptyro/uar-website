// Pure XP arithmetic shared by the site and node-run code (tests, CLIs).
// Kept free of imports so plain `node --test` can load it — $lib/players
// re-exports these for site code.

export const XP_CAP = 250000;

export function totalWins(p: { winsByMode: number[] }): number {
	return p.winsByMode.reduce((a, b) => a + b, 0);
}

export function totalXp(p: { xpEn: number; xpWo: number; xpCo: number }): number {
	return p.xpEn + p.xpWo + p.xpCo;
}

/**
 * Lifetime XP including prestige. Prestiging requires all three tracks at
 * 250,000 and resets each to 50,000, so every prestige level represents
 * 600,000 XP earned on top of the current totals — a fresh prestige is
 * worth exactly as much as a just-maxed card.
 */
export function careerXp(p: {
	prestige: number;
	xpEn: number;
	xpWo: number;
	xpCo: number;
}): number {
	return p.prestige * 600000 + totalXp(p);
}
