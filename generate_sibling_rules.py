import re, json

with open("rules_amended_extracted.txt", encoding="utf-8") as f:
    pv = f.read()
with open("rules_extracted.txt", encoding="utf-8") as f:
    mw = f.read()

def clean(t):
    t = re.sub(r'\[Page \d+\]', '', t)
    return re.sub(r'\s+', ' ', t).strip()

combined = "=== PALMA VISTA HOA — FIFTH AMENDED RULES AND REGULATIONS ===\n\n"
combined += clean(pv)
combined += "\n\n=== METROWEST MASTER ASSOCIATION RULES AND REGULATIONS ===\n\n"
combined += clean(mw)

ts = f'// Auto-generated from HOA documents — do not edit manually\nexport const RULES_TEXT = {json.dumps(combined)};\n'
with open("functions/api/rules-data.ts", "w", encoding="utf-8") as f:
    f.write(ts)

print(f"Written: {len(combined):,} chars")
