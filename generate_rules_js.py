import json, re

# Read both extracted rule files
with open("rules_amended_extracted.txt", encoding="utf-8") as f:
    amended = f.read()

with open("rules_extracted.txt", encoding="utf-8") as f:
    metrowest = f.read()

# Clean up - remove page markers and extra whitespace
def clean(text):
    # Remove [Page N] markers
    text = re.sub(r'\[Page \d+\]', '', text)
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

amended_clean = clean(amended)
metrowest_clean = clean(metrowest)

combined = f"""=== PALMA VISTA HOA - FIFTH AMENDED RULES AND REGULATIONS ===

{amended_clean}

=== METROWEST MASTER ASSOCIATION RULES AND REGULATIONS ===
(These rules also apply to all Palma Vista homeowners as a MetroWest community)

{metrowest_clean}
"""

# Write as a JS module
js_content = f"""// Auto-generated from official HOA documents - do not edit manually
const RULES_TEXT = {json.dumps(combined)};
export default RULES_TEXT;
"""

with open("data/rules-text.js", "w", encoding="utf-8") as f:
    f.write(js_content)

print(f"Written rules-text.js")
print(f"Palma Vista rules: {len(amended_clean):,} chars")
print(f"MetroWest rules: {len(metrowest_clean):,} chars")
print(f"Combined: {len(combined):,} chars / ~{len(combined)//4:,} tokens")
