// ~/utils/productMatching.ts

export interface VisualMatch {
    name: string;
    distance: number;
}

const MATCH_DEBUG_LOGGING = true;

const UNIT_REGEX = /(\d+(?:\.\d+)?)\s*(kg|g|ml|l|oz|lb|pcs?|pk|pack|bx|bags?)\b/i;
const UNIT_REGEX_GLOBAL = /(\d+(?:\.\d+)?)\s*(kg|g|ml|l|oz|lb|pcs?|pk|pack|bx|bags?)\b/gi;

const MASS_TO_GRAMS: Record<string, number> = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 };
const VOLUME_TO_ML: Record<string, number> = { ml: 1, l: 1000 };

interface ParsedUnit {
    raw: string;
    value: number;
    unit: string;
    grams: number | null;
    ml: number | null;
}

const parseAllUnits = (text: string): ParsedUnit[] => {
    const results: ParsedUnit[] = [];
    let match: RegExpExecArray | null;
    const re = new RegExp(UNIT_REGEX_GLOBAL);
    while ((match = re.exec(text)) !== null) {
        const value = parseFloat(match[1]);
        const unit = match[2].toLowerCase();
        results.push({
            raw: `${match[1]}${unit}`,
            value,
            unit,
            grams: MASS_TO_GRAMS[unit] != null ? value * MASS_TO_GRAMS[unit] : null,
            ml: VOLUME_TO_ML[unit] != null ? value * VOLUME_TO_ML[unit] : null,
        });
    }
    return results;
};

export const extractUnitOfMeasure = (text: string): string => {
    const units = parseAllUnits(text);
    if (units.length === 0) return '';
    const metric = units.find(u => ['g', 'kg', 'ml', 'l'].includes(u.unit));
    const chosen = metric ?? units[0];
    return `${chosen.value}${chosen.unit}`;
};

export const stripUnitOfMeasure = (text: string): string => {
    return text
        .replace(UNIT_REGEX_GLOBAL, '')
        .replace(/[()]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/[-,]\s*$/, '')
        .trim();
};

// ---------- brand-prefix stripping (quote-variant tolerant) ----------

const APOSTROPHE_CLASS = `['’‘\`´]`;
const BRAND_PREFIX_REGEX = new RegExp(`^[a-z0-9]+\\s*${APOSTROPHE_CLASS}\\s*n\\s+[a-z0-9]+\\s+`, 'i');

const stripBrandPrefix = (text: string): string => text.replace(BRAND_PREFIX_REGEX, '');

const normalizeForComparison = (candidateName: string): string =>
    stripBrandPrefix(stripUnitOfMeasure(candidateName));

// ---------- letter-run similarity (Ratcliff/Obershelp style) ----------

const normalizeConcat = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

const MIN_RUN_LENGTH = 2;
const STRONG_RUN_LENGTH = 5;

const longestCommonSubstring = (a: string, b: string) => {
    let best = { length: 0, aStart: 0, bStart: 0 };
    const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
                if (dp[i][j] > best.length) {
                    best = { length: dp[i][j], aStart: i - dp[i][j], bStart: j - dp[i][j] };
                }
            }
        }
    }
    return best;
};

const findMatchingRuns = (a: string, b: string): { totalMatched: number; longestRun: number } => {
    if (a.length === 0 || b.length === 0) return { totalMatched: 0, longestRun: 0 };
    const lcs = longestCommonSubstring(a, b);
    if (lcs.length < MIN_RUN_LENGTH) return { totalMatched: 0, longestRun: 0 };

    const leftA = a.substring(0, lcs.aStart);
    const leftB = b.substring(0, lcs.bStart);
    const rightA = a.substring(lcs.aStart + lcs.length);
    const rightB = b.substring(lcs.bStart + lcs.length);

    const left = findMatchingRuns(leftA, leftB);
    const right = findMatchingRuns(rightA, rightB);

    return {
        totalMatched: lcs.length + left.totalMatched + right.totalMatched,
        longestRun: Math.max(lcs.length, left.longestRun, right.longestRun),
    };
};

const letterRunScore = (candidateText: string, ocrText: string): number => {
    const candidate = normalizeConcat(candidateText);
    const ocr = normalizeConcat(ocrText);
    if (!candidate || !ocr) return 0;

    const { totalMatched, longestRun } = findMatchingRuns(candidate, ocr);
    const ratioScore = totalMatched / candidate.length;
    const strongRunBonus = longestRun >= STRONG_RUN_LENGTH
        ? 0.15 + (longestRun - STRONG_RUN_LENGTH) * 0.05
        : 0;

    return Math.min(1, ratioScore + strongRunBonus);
};

// ---------- extra-token penalty, first-word (brand/logo) exempt ----------

const FILLER_TOKENS = new Set(['the', 'and', 'with', 'in', 'of', 'n', 'a', 'an', 'or']);
const MIN_MEANINGFUL_TOKEN_LEN = 4;
const EXTRA_TOKEN_PENALTY = 0.12;
const MAX_EXTRA_TOKEN_PENALTY = 0.35;

const tokenize = (str: string) =>
    str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);

const extraTokenPenalty = (
    candidateName: string,
    ocrText: string
): { penalty: number; missingTokens: string[] } => {
    const rawTokens = tokenize(normalizeForComparison(candidateName));
    // Skip index 0 — the leading word is usually the brand/logo, which packaging often
    // renders in stylized fonts OCR structurally can't read (e.g. "Pocari" in cursive).
    // Penalizing its absence the same as a genuinely wrong flavor/variant word (like
    // "Spicy") produces false negatives on otherwise-correct matches.
    const candidateTokens = rawTokens
        .map((t, idx) => ({ t, idx }))
        .filter(({ t, idx }) => idx !== 0 && t.length >= MIN_MEANINGFUL_TOKEN_LEN && !FILLER_TOKENS.has(t))
        .map(({ t }) => t);

    const ocrConcat = normalizeConcat(ocrText);
    if (candidateTokens.length === 0 || !ocrConcat) return { penalty: 0, missingTokens: [] };

    const missingTokens: string[] = [];
    for (const token of candidateTokens) {
        if (ocrConcat.includes(token)) continue;
        const { totalMatched } = findMatchingRuns(token, ocrConcat);
        if (totalMatched < Math.ceil(token.length * 0.6)) {
            missingTokens.push(token);
        }
    }

    return {
        penalty: Math.min(missingTokens.length * EXTRA_TOKEN_PENALTY, MAX_EXTRA_TOKEN_PENALTY),
        missingTokens,
    };
};

// ---------- weight/unit agreement ----------

const WEIGHT_MATCH_BONUS = 0.25;
const WEIGHT_MISMATCH_PENALTY = 0.15;
const WEIGHT_TOLERANCE = 0.15;

const weightAgreementAdjustment = (
    candidateName: string,
    ocrUnits: ParsedUnit[]
): { adjustment: number; detail: string } => {
    const candidateUnits = parseAllUnits(candidateName);
    if (candidateUnits.length === 0 || ocrUnits.length === 0) return { adjustment: 0, detail: 'n/a' };

    const candidateGrams = candidateUnits.find(u => u.grams != null)?.grams;
    const candidateMl = candidateUnits.find(u => u.ml != null)?.ml;

    let bestDiff = Infinity;
    let bestOcrRaw = '';

    for (const ocrUnit of ocrUnits) {
        if (candidateGrams != null && ocrUnit.grams != null) {
            const diff = Math.abs(ocrUnit.grams - candidateGrams) / candidateGrams;
            if (diff < bestDiff) { bestDiff = diff; bestOcrRaw = ocrUnit.raw; }
        }
        if (candidateMl != null && ocrUnit.ml != null) {
            const diff = Math.abs(ocrUnit.ml - candidateMl) / candidateMl;
            if (diff < bestDiff) { bestDiff = diff; bestOcrRaw = ocrUnit.raw; }
        }
    }

    if (bestDiff === Infinity) return { adjustment: 0, detail: 'no comparable unit type' };
    if (bestDiff <= WEIGHT_TOLERANCE) return { adjustment: WEIGHT_MATCH_BONUS, detail: `${bestOcrRaw} ≈ match (${(bestDiff * 100).toFixed(0)}% off)` };
    return { adjustment: -WEIGHT_MISMATCH_PENALTY, detail: `${bestOcrRaw} vs candidate — ${(bestDiff * 100).toFixed(0)}% off` };
};

// ---------- visual model confidence (used as a scoring input) ----------

const VISUAL_DISTANCE_CONFIDENT = 0.35;
const VISUAL_DISTANCE_UNCERTAIN = 0.7;

const visualConfidence = (distance: number): number => {
    const clamped = Math.min(Math.max(distance, VISUAL_DISTANCE_CONFIDENT), VISUAL_DISTANCE_UNCERTAIN);
    return 1 - (clamped - VISUAL_DISTANCE_CONFIDENT) / (VISUAL_DISTANCE_UNCERTAIN - VISUAL_DISTANCE_CONFIDENT);
};

// ---------- combined scoring ----------

const TEXT_SCORE_WEIGHT = 0.7;
const VISUAL_SCORE_WEIGHT = 0.3;
const MIN_TEXT_SCORE_TO_QUALIFY = 0.3;

interface CandidateScore {
    name: string;
    distance: number;
    textScore: number;
    visualScore: number;
    weightAdjustment: number;
    weightDetail: string;
    tokenPenalty: number;
    missingTokens: string[];
    combinedScore: number;
}

const scoreCandidate = (candidate: VisualMatch, ocrText: string, ocrUnits: ParsedUnit[]): CandidateScore => {
    const comparableName = normalizeForComparison(candidate.name);
    const comparableOcr = stripUnitOfMeasure(ocrText);

    const textScore = letterRunScore(comparableName, comparableOcr);
    const visualScore = visualConfidence(candidate.distance);
    const { adjustment: weightAdjustment, detail: weightDetail } = weightAgreementAdjustment(candidate.name, ocrUnits);
    const { penalty: tokenPenalty, missingTokens } = extraTokenPenalty(candidate.name, ocrText);

    const combinedScore = Math.max(0, Math.min(1,
        textScore * TEXT_SCORE_WEIGHT + visualScore * VISUAL_SCORE_WEIGHT + weightAdjustment - tokenPenalty
    ));

    return { name: candidate.name, distance: candidate.distance, textScore, visualScore, weightAdjustment, weightDetail, tokenPenalty, missingTokens, combinedScore };
};

const MATCH_THRESHOLD = 0.5;
const MIN_OCR_LENGTH_FOR_RAW_FALLBACK = 10;

// How much better (lower distance) the #1 candidate needs to be than #2 to count as
// "the vision model actually distinguished this product," rather than "picked
// arbitrarily among several similar guesses." Relative gap, not an absolute distance —
// this replaces a fixed cutoff that turned out not to hold across your real dataset
// (correct top-1 matches were landing anywhere from ~0.43 to ~0.6).
const VISUAL_MARGIN_CONFIDENT = 0.02;
const VISUAL_ALWAYS_CONFIDENT_DISTANCE = 0.35; // extremely close match — confident regardless of margin

export const pickBestCandidate = (
    candidates: VisualMatch[],
    ocrText: string
): { name: string; score: number } | null => {
    if (!ocrText.trim() || candidates.length === 0) return null;

    const ocrUnits = parseAllUnits(ocrText);
    const scored = candidates.map(c => scoreCandidate(c, ocrText, ocrUnits));

    if (MATCH_DEBUG_LOGGING) {
        console.log('%c[Match] Candidate scores:', 'color: #a855f7; font-weight: bold');
        console.table(scored.map(s => ({
            name: s.name,
            text: s.textScore.toFixed(2),
            visual: s.visualScore.toFixed(2),
            weightAdj: s.weightAdjustment.toFixed(2),
            weightDetail: s.weightDetail,
            tokenPenalty: s.tokenPenalty.toFixed(2),
            missing: s.missingTokens.join(', ') || '-',
            combined: s.combinedScore.toFixed(2),
        })));
    }

    const eligible = scored.filter(s => s.textScore >= MIN_TEXT_SCORE_TO_QUALIFY);
    if (eligible.length === 0) return null;

    const best = eligible.reduce((a, b) => (b.combinedScore > a.combinedScore ? b : a));
    return best.combinedScore >= MATCH_THRESHOLD ? { name: best.name, score: best.combinedScore } : null;
};

export const resolveProductIdentity = (
    candidates: VisualMatch[],
    ocrText: string
): { name: string; unitOfMeasure: string } => {
    const best = pickBestCandidate(candidates, ocrText);
    const ocrConcatLength = normalizeConcat(ocrText).length;

    const topDistance = candidates[0]?.distance;
    const secondDistance = candidates[1]?.distance;
    const margin = (topDistance != null && secondDistance != null) ? secondDistance - topDistance : 0;
    const visualIsConfident = topDistance != null && (
        margin >= VISUAL_MARGIN_CONFIDENT || topDistance <= VISUAL_ALWAYS_CONFIDENT_DISTANCE
    );

    let chosenName: string;
    let source: string;

    if (best) {
        chosenName = best.name;
        source = `OCR-confirmed match (score ${best.score.toFixed(2)})`;
    } else if (visualIsConfident) {
        // Vision model clearly distinguished this product from its alternatives
        // (margin-based, not an absolute distance cutoff) — trust it over
        // unreadable/garbled OCR text rather than defaulting to raw OCR.
        chosenName = candidates[0]?.name ?? 'Captured Item';
        source = `visual model fallback (confident — margin ${margin.toFixed(3)}, distance ${topDistance?.toFixed(3)})`;
    } else if (ocrConcatLength >= MIN_OCR_LENGTH_FOR_RAW_FALLBACK) {
        chosenName = ocrText;
        source = `raw OCR text (substantial text, no match, visual model also uncertain — margin ${margin.toFixed(3)})`;
    } else {
        chosenName = candidates[0]?.name ?? 'Captured Item';
        source = ocrText.trim()
            ? 'visual model fallback (OCR text too sparse to trust alone)'
            : 'visual model fallback (OCR found no text at all)';
    }

    if (MATCH_DEBUG_LOGGING) {
        console.log(`%c[Match] Chosen: "${chosenName}" via ${source}`, 'color: #a855f7; font-weight: bold');
    }

    const unitOfMeasure = extractUnitOfMeasure(ocrText) || extractUnitOfMeasure(chosenName);
    const finalName = stripUnitOfMeasure(chosenName);

    return { name: finalName, unitOfMeasure };
};