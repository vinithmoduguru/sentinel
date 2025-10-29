/**
 * MCC (Merchant Category Code) to human-readable category mapping
 * Based on ISO 18245 standard MCC codes
 */

const MCC_TO_CATEGORY: Record<string, string> = {
  // Grocery & Supermarkets
  "5411": "Groceries",
  "5422": "Meat & Seafood",
  "5441": "Candy & Nuts",
  "5451": "Dairy Products",

  // Food & Dining
  "5812": "Dining",
  "5813": "Drinking Places",
  "5814": "Fast Food",

  // Transportation
  "4111": "Transport",
  "4112": "Passenger Railways",
  "4119": "Ambulance Services",
  "4121": "Taxicabs & Limousines",
  "4131": "Bus Lines",
  "4511": "Airlines",
  "4784": "Tolls & Bridge Fees",

  // Electronics & Technology
  "5732": "Electronics",
  "5734": "Computer Software",
  "5735": "Record Stores",
  "5815": "Digital Goods",

  // Utilities
  "4899": "Utilities",
  "4900": "Utilities - Electric, Gas, Water",

  // General Merchandise
  "5999": "General Merchandise",
  "5399": "Miscellaneous General Merchandise",
  "5311": "Department Stores",

  // Entertainment
  "7832": "Movies",
  "7922": "Theatrical Producers",
  "7932": "Commercial Sports",
  "7933": "Dance Halls",

  // Healthcare
  "5912": "Drug Stores",
  "5970": "Artists Supply Stores",
  "5971": "Art Dealers",

  // Clothing
  "5651": "Clothing Stores",
  "5655": "Sports Apparel",

  // Gas Stations
  "5541": "Gas Stations",
  "5542": "Automated Fuel Dispensers",
}

/**
 * Get category name for a given MCC code
 * @param mcc - 4-digit MCC code string
 * @returns Category name or "Other" if not found
 */
export function getCategoryFromMCC(mcc: string): string {
  return MCC_TO_CATEGORY[mcc] || "Other"
}

/**
 * Get all MCC codes mapped to a specific category
 * @param category - Category name
 * @returns Array of MCC codes
 */
export function getMCCsForCategory(category: string): string[] {
  return Object.entries(MCC_TO_CATEGORY)
    .filter(([_, cat]) => cat === category)
    .map(([mcc]) => mcc)
}

/**
 * Get all available categories
 */
export function getAllCategories(): string[] {
  return Array.from(new Set(Object.values(MCC_TO_CATEGORY)))
}
