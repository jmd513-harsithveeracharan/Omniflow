/**
 * frontend/src/components/voice/termNormalizer.ts
 * -------------------------------------------------
 * Normalizes phonetic artifacts and misinterpretations produced by browser
 * Web Speech API (webkitSpeechRecognition) when using laptop microphones.
 *
 * Built-in laptop microphones frequently distort technical data engineering
 * jargon into phonetically similar everyday English phrases.
 */

interface TermMapping {
  pattern: RegExp;
  replacement: string;
}

const TECHNICAL_PHONETIC_MAPPINGS: TermMapping[] = [
  // CLI & Terminal
  { pattern: /\b(?:she\s+ali|see\s+ali|see\s+el\s+eye|see\s+ally|eul\s+uli|c\s+l\s+i)\b/gi, replacement: 'CLI' },
  // REST API
  { pattern: /\b(?:restopia|rest\s+op|rest\s+a\s+p\s+i|arrest\s+api)\b/gi, replacement: 'REST API' },
  // OneLake
  { pattern: /\b(?:won\s*lake|1\s*lake)\b/gi, replacement: 'OneLake' },
  // PySpark
  { pattern: /\b(?:pie\s*spark|pi\s*spark|pie\s*bark)\b/gi, replacement: 'PySpark' },
  // T-SQL
  { pattern: /\b(?:tea\s*sequel|t\s*sequel|tea\s*sql)\b/gi, replacement: 'T-SQL' },
  // SQL
  { pattern: /\b(?:sequel)\b/gi, replacement: 'SQL' },
  // Medallion
  { pattern: /\b(?:metal\s*lion|medal\s*lion|medallion)\b/gi, replacement: 'Medallion' },
  // Lakehouse
  { pattern: /\b(?:lake\s+house)\b/gi, replacement: 'Lakehouse' },
  // Synapse
  { pattern: /\b(?:sin\s*apps|syn\s*apse|seen\s*apps)\b/gi, replacement: 'Synapse' },
  // SCD2
  { pattern: /\b(?:sc\s*d2|sd2|s\s*c\s*d\s*2)\b/gi, replacement: 'SCD2' },
  // ADF (Azure Data Factory)
  { pattern: /\b(?:a\s*d\s*f)\b/gi, replacement: 'ADF' },
  // Kimball
  { pattern: /\b(?:kim\s*ball)\b/gi, replacement: 'Kimball' },
  // Delta Lake
  { pattern: /\b(?:delta\s+like)\b/gi, replacement: 'Delta Lake' },
  // Fabric
  { pattern: /\b(?:fab\s*rick)\b/gi, replacement: 'Fabric' },
  // Parquet
  { pattern: /\b(?:park\s*kay|par\s*kay)\b/gi, replacement: 'Parquet' },
];

/**
 * Clean up common microphone distortions and restore proper data engineering terms.
 */
export function normalizeDataEngineeringTerms(rawTranscript: string): string {
  if (!rawTranscript) return '';
  let cleaned = rawTranscript;

  for (const { pattern, replacement } of TECHNICAL_PHONETIC_MAPPINGS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  return cleaned;
}

