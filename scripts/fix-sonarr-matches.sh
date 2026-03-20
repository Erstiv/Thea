#!/bin/bash
# Fix 3 wrong Sonarr matches: Dragon's Den, Hell's Kitchen, Carnivale
# Run this on your Work Mac (it SSHes to Filou)

SONARR_KEY="e068e976a5704fd0a74a4abc7bbb393c"
SONARR_URL="http://localhost:8989/api/v3"

echo "=== Step 1: Finding the 3 mismatched shows ==="
echo ""

# Find Dragon's Den
echo "--- Dragon's Den ---"
curl -s "$SONARR_URL/series" -H "X-Api-Key: $SONARR_KEY" | \
  python3 -c "
import json, sys
data = json.load(sys.stdin)
for s in data:
    if 'dragon' in s['title'].lower() and 'den' in s['title'].lower():
        print(f\"  ID: {s['id']}  Title: {s['title']}  TVDB: {s['tvdbId']}  Path: {s.get('path','')}\")"

echo ""

# Find Hell's Kitchen
echo "--- Hell's Kitchen ---"
curl -s "$SONARR_URL/series" -H "X-Api-Key: $SONARR_KEY" | \
  python3 -c "
import json, sys
data = json.load(sys.stdin)
for s in data:
    if 'hell' in s['title'].lower() and 'kitchen' in s['title'].lower():
        print(f\"  ID: {s['id']}  Title: {s['title']}  TVDB: {s['tvdbId']}  Path: {s.get('path','')}\")"

echo ""

# Find Carnivale
echo "--- Carnivale / Carnival ---"
curl -s "$SONARR_URL/series" -H "X-Api-Key: $SONARR_KEY" | \
  python3 -c "
import json, sys
data = json.load(sys.stdin)
for s in data:
    if 'carniv' in s['title'].lower() or 'carnival' in s['title'].lower():
        print(f\"  ID: {s['id']}  Title: {s['title']}  TVDB: {s['tvdbId']}  Path: {s.get('path','')}\")"

echo ""
echo "=== Step 2: Now I'll delete the wrong ones and add the correct versions ==="
echo "Paste the output back to me and I'll generate the fix commands."
