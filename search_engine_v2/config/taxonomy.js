import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load taxonomy from parent directory
const taxonomyPath = join(__dirname, '../../attributes_taxonomy.json');
export const taxonomy = JSON.parse(readFileSync(taxonomyPath, 'utf-8'));

// Extract all valid categories
export const validCategories = Object.keys(taxonomy);

// Extract all possible attributes across all categories
export function getAllAttributes() {
  const attributesSet = new Set();

  for (const category of Object.values(taxonomy)) {
    if (category.fields) {
      category.fields.forEach(field => attributesSet.add(field));
    }
  }

  return Array.from(attributesSet);
}

// Get attribute enums for a specific attribute across all categories
export function getAttributeEnums(attributeName) {
  const enumsSet = new Set();

  for (const category of Object.values(taxonomy)) {
    if (category.enums && category.enums[attributeName]) {
      category.enums[attributeName].forEach(value => enumsSet.add(value));
    }
  }

  return Array.from(enumsSet);
}

// Get all enums formatted for LLM prompt
export function getFormattedTaxonomy() {
  const formatted = {};

  for (const [categoryName, categoryData] of Object.entries(taxonomy)) {
    formatted[categoryName] = {
      fields: categoryData.fields || [],
      enums: categoryData.enums || {}
    };
  }

  return JSON.stringify(formatted, null, 2);
}

// Validate if a category exists
export function isValidCategory(category) {
  return validCategories.includes(category);
}

// Validate if an attribute value is valid for a specific attribute
export function isValidAttributeValue(attributeName, value) {
  const validEnums = getAttributeEnums(attributeName);
  return validEnums.includes(value);
}

// Get all attributes with their possible values
export function getAllAttributesWithEnums() {
  const result = {};
  const allAttrs = getAllAttributes();

  for (const attr of allAttrs) {
    result[attr] = getAttributeEnums(attr);
  }

  return result;
}

// Color family mappings (from old implementation)
export const colorFamilies = {
  BLUE: ['BLUE', 'NAVY', 'TEAL', 'TURQUOISE', 'COBALT', 'INDIGO'],
  RED: ['RED', 'BURGUNDY', 'WINE', 'MAROON', 'CRIMSON'],
  NEUTRAL: ['BEIGE', 'CREAM', 'TAUPE', 'ECRU', 'IVORY', 'OFF_WHITE', 'STONE', 'SAND'],
  BROWN: ['BROWN', 'TAN', 'CAMEL', 'CHOCOLATE', 'COGNAC', 'KHAKI'],
  GREEN: ['GREEN', 'OLIVE', 'FOREST', 'EMERALD', 'MINT', 'SAGE'],
  PINK: ['PINK', 'ROSE', 'BLUSH', 'CORAL', 'FUCHSIA', 'MAGENTA'],
  YELLOW: ['YELLOW', 'MUSTARD', 'GOLD', 'AMBER'],
  ORANGE: ['ORANGE', 'RUST', 'TERRACOTTA'],
  PURPLE: ['PURPLE', 'LAVENDER', 'VIOLET', 'PLUM', 'MAUVE'],
  SILVER: ['SILVER', 'GREY', 'GRAY', 'CHARCOAL', 'SLATE'],
  WHITE: ['WHITE'],
  BLACK: ['BLACK'],
  PATTERN: ['PRINT', 'PATTERN', 'MULTICOLOR', 'FLORAL', 'STRIPED', 'CHECKED']
};

// Expand color to include family members
export function expandColorFamily(color) {
  if (!color) return [];

  const colorUpper = color.toUpperCase();

  // Check if this color is a family member
  for (const [family, members] of Object.entries(colorFamilies)) {
    if (members.includes(colorUpper)) {
      return members;
    }
  }

  // If not in any family, return just the color itself
  return [colorUpper];
}

export default {
  taxonomy,
  validCategories,
  getAllAttributes,
  getAttributeEnums,
  getFormattedTaxonomy,
  isValidCategory,
  isValidAttributeValue,
  getAllAttributesWithEnums,
  colorFamilies,
  expandColorFamily
};
