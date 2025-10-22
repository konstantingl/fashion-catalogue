import { validCategories, getFormattedTaxonomy } from '../config/taxonomy.js';

/**
 * Generate the query parsing prompt for Gemini
 */
export function getQueryParsingPrompt(userQuery) {
  const categoriesList = validCategories.join(', ');
  const taxonomyJson = getFormattedTaxonomy();

  return `You are a query parser for a premium fashion e-commerce search engine.

AVAILABLE CATEGORIES:
${categoriesList}

ATTRIBUTE TAXONOMY:
${taxonomyJson}

TASK: Parse the user's query into a structured format for retrieval.

QUERY TYPES:
- TYPE_1: Attribute-specific (e.g., "black midi dress", "long trench with belt")
  User explicitly mentions colors, lengths, fits, closures, or other measurable attributes.

- TYPE_2: Style/vibe-based (e.g., "cozy winter sweater", "elegant office outfit")
  User describes feelings, occasions, aesthetics, or abstract style concepts.

USER QUERY: "${userQuery}"

OUTPUT (valid JSON only):
{
  "query_type": "TYPE_1" | "TYPE_2",
  "language": "en" | "de",
  "categories": ["most_relevant_category"],
  "hard_attributes": {
    // Only attributes EXPLICITLY mentioned or directly implied
    // Use exact enum values from taxonomy
    // Examples: "length": "MIDI", "color": "BLACK", "fit": "OVERSIZED"
  },
  "soft_preferences": {
    "style_vibe": "natural language style description",
    "semantic_keywords": ["key", "descriptive", "words"],
    "occasion": "optional: office/casual/evening/etc"
  },
  "complexity_score": 0.0-1.0
}

RULES:
1. Categories: Return 1-3 most relevant. Empty array [] if truly ambiguous (rare).
2. Hard attributes: Conservative. Only if explicitly stated. Use taxonomy enum values.
   IMPORTANT LENGTH MAPPINGS (category-specific):
   - For trench_coats_parkas, coats: "short"→KNEE, "midi/medium"→MIDI, "long/maxi"→MAXI
   - For dresses, skirts: "short"→MINI, "midi/medium"→MIDI, "long/maxi"→MAXI
   - For jackets, sweaters, tops: "short/cropped"→CROPPED, "regular/normal"→REGULAR, "long/longline"→LONG
3. Soft preferences:
   - style_vibe: Describe the aesthetic/feeling (for TYPE_2)
   - semantic_keywords: Non-attribute descriptive words
4. Language detection: Based on query language, not product language
5. Complexity score:
   - 0.0-0.3: Simple, clear (e.g., "black dress")
   - 0.4-0.6: Medium (e.g., "cozy oversized sweater for winter")
   - 0.7-1.0: Complex, multi-requirement (e.g., "elegant but casual dress for garden party")

EXAMPLES:

INPUT: "long black trench with belt"
OUTPUT:
{
  "query_type": "TYPE_1",
  "language": "en",
  "categories": ["trench_coats_parkas", "coats"],
  "hard_attributes": {
    "length": "MAXI",
    "color": "BLACK",
    "belt": "YES"
  },
  "soft_preferences": {
    "style_vibe": "classic trench coat style",
    "semantic_keywords": ["trench"],
    "occasion": ""
  },
  "complexity_score": 0.3
}

INPUT: "gemütlicher oversized pullover für den winter"
OUTPUT:
{
  "query_type": "TYPE_2",
  "language": "de",
  "categories": ["sweaters_pullovers"],
  "hard_attributes": {
    "fit": "OVERSIZED"
  },
  "soft_preferences": {
    "style_vibe": "cozy comfortable warm winter layering piece",
    "semantic_keywords": ["gemütlich", "winter", "pullover"],
    "occasion": "casual"
  },
  "complexity_score": 0.5
}

INPUT: "midi dress"
OUTPUT:
{
  "query_type": "TYPE_1",
  "language": "en",
  "categories": ["dresses"],
  "hard_attributes": {
    "length": "MIDI"
  },
  "soft_preferences": {
    "style_vibe": "",
    "semantic_keywords": ["dress"],
    "occasion": ""
  },
  "complexity_score": 0.2
}

INPUT: "crochet"
OUTPUT:
{
  "query_type": "TYPE_2",
  "language": "en",
  "categories": [],
  "hard_attributes": {},
  "soft_preferences": {
    "style_vibe": "crochet knit texture handmade bohemian",
    "semantic_keywords": ["crochet", "knit", "texture"],
    "occasion": ""
  },
  "complexity_score": 0.6
}

INPUT: "schwarzer Rollkragenpullover"
OUTPUT:
{
  "query_type": "TYPE_1",
  "language": "de",
  "categories": ["sweaters_pullovers"],
  "hard_attributes": {
    "color": "BLACK",
    "neckline": "TURTLENECK"
  },
  "soft_preferences": {
    "style_vibe": "",
    "semantic_keywords": ["rollkragen", "pullover"],
    "occasion": ""
  },
  "complexity_score": 0.2
}

Now parse this query: "${userQuery}"

Return ONLY valid JSON, no other text.`;
}

/**
 * Fallback parsed query for when Gemini fails
 */
export function createFallbackParsedQuery(userQuery) {
  return {
    query_type: 'TYPE_2',
    language: 'en',
    categories: [],
    hard_attributes: {},
    soft_preferences: {
      style_vibe: userQuery,
      semantic_keywords: userQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2),
      occasion: ''
    },
    complexity_score: 0.5
  };
}

export default {
  getQueryParsingPrompt,
  createFallbackParsedQuery
};
