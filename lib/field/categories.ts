// Allowed "New issue" categories. Stored as the label so reports stay readable.

export const FIELD_CATEGORIES = [
  "Lawn/landscaping",
  "Palm or tree trimming",
  "Roof/pressure washing",
  "Exterior paint/house",
  "Driveway/sidewalk",
  "Trash/recycling cans visible",
  "Vehicles/parking",
  "Fence",
  "Mailbox",
  "Lighting",
  "Unapproved architectural change",
  "Other",
] as const;

export type FieldCategory = (typeof FIELD_CATEGORIES)[number];

const CATEGORY_SET = new Set<string>(FIELD_CATEGORIES);

export function isFieldCategory(value: string): value is FieldCategory {
  return CATEGORY_SET.has(value);
}
