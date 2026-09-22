#!/bin/bash
# Testdaten für pruefe-gallery.js auf einer Testinstanz (Standard /opt/oco-schnell).
#
# Aufruf (als root):
#   bash gallery-testdaten.sh einrichten   Ordner „Galerie-Probe“ beim Konto admin:
#                                          72 Bilder in wechselnden Seitenverhältnissen
#                                          (genug für mehrere Bildschirmhöhen), dazu
#                                          „Unteralbum“ mit drei Bildern und eine
#                                          gallery.cnf mit Albuminfo; öffentlicher
#                                          Link auf den Ordner (Token in
#                                          /root/.gallery-probe-token)
#   bash gallery-testdaten.sh entfernen    Ordner samt Link weg
#
# @copyright Copyright (c) 2026, BW-Tech GmbH
# @license AGPL-3.0
set -euo pipefail
ZIEL=${OC_ZIEL:-/opt/oco-schnell}
BASIS=${OC_BASIS:-http://127.0.0.1:18130}
NUTZER=${OC_NUTZER:-admin}
PASS=${OC_PASS:-Redesign-2026!}
OCC="sudo -u www-data php8.4 $ZIEL/occ"
DATEN=$($OCC config:system:get datadirectory)
ORDNER="$DATEN/$NUTZER/files/Galerie-Probe"
TOKENDATEI=/root/.gallery-probe-token

# Erst die Freigaben des Ordners löschen, dann den Ordner am Dateisystem vorbei
# entfernen – so landet nichts im Papierkorb des Kontos, der übrige Papierkorb
# bleibt, wie er war, und keine Freigabe zeigt auf eine verschwundene Datei.
aufraeumen() {
	IDS=$(curl -s -u "$NUTZER:$PASS" -H 'OCS-APIRequest: true' \
		"$BASIS/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json&path=/Galerie-Probe&subfiles=false" \
		| python3 -c 'import json,sys
try:
    print(" ".join(str(s["id"]) for s in json.load(sys.stdin)["ocs"]["data"]))
except Exception:
    pass')
	for id in $IDS; do
		curl -s -o /dev/null -u "$NUTZER:$PASS" -H 'OCS-APIRequest: true' -X DELETE \
			"$BASIS/ocs/v2.php/apps/files_sharing/api/v1/shares/$id"
	done
	if [ -d "$ORDNER" ]; then
		rm -rf "$ORDNER"
		$OCC files:scan --path="/$NUTZER/files" --shallow > /dev/null 2>&1 || $OCC files:scan --path="/$NUTZER/files" > /dev/null
	fi
	rm -f "$TOKENDATEI"
}

case "${1:-}" in
	einrichten)
		aufraeumen
		mkdir -p "$ORDNER/Unteralbum"
		python3 - "$ORDNER" <<'PY'
import sys, os
from PIL import Image, ImageDraw
ziel = sys.argv[1]
# Seitenverhältnisse wie echte Fotos: quer, hoch, quadratisch, Panorama
formate = [(1200, 800), (800, 1200), (1000, 1000), (1600, 600), (900, 1200), (1200, 900)]
farben = [(0, 128, 107), (4, 30, 66), (200, 90, 40), (120, 60, 160), (40, 140, 200), (180, 160, 40)]
for i in range(72):
    b, h = formate[i % len(formate)]
    bild = Image.new('RGB', (b, h), farben[(i // 2) % len(farben)])
    zeichnen = ImageDraw.Draw(bild)
    zeichnen.rectangle([b // 10, h // 10, b - b // 10, h - h // 10], outline=(255, 255, 255), width=12)
    zeichnen.text((b // 2 - 20, h // 2 - 10), '%02d' % (i + 1), fill=(255, 255, 255))
    bild.save(os.path.join(ziel, 'bild-%02d.jpg' % (i + 1)), quality=80)
for i in range(3):
    Image.new('RGB', (1000, 750), farben[i]).save(os.path.join(ziel, 'Unteralbum', 'unter-%d.jpg' % (i + 1)), quality=80)
PY
		# Albuminfo: ohne gallery.cnf bleibt der Knopf dazu ausgeblendet
		cat > "$ORDNER/gallery.cnf" <<'CNF'
information:
  description: "Probe-Album für die Redesign-Prüfung der Galerie"
  copyright: "© BW-Tech GmbH"
CNF
		chown -R www-data:www-data "$ORDNER"
		$OCC files:scan --path="/$NUTZER/files/Galerie-Probe" > /dev/null
		ANTWORT=$(curl -s -u "$NUTZER:$PASS" -H 'OCS-APIRequest: true' \
			-d 'path=/Galerie-Probe' -d 'shareType=3' -d 'permissions=1' \
			"$BASIS/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json")
		TOKEN=$(printf '%s' "$ANTWORT" | python3 -c 'import json,sys
try:
    print(json.load(sys.stdin)["ocs"]["data"]["token"])
except Exception:
    pass')
		# Kein Link (etwa bei Passwortzwang für Links): nichts halb Eingerichtetes
		# zurücklassen.
		if [ -z "$TOKEN" ]; then
			echo "Link auf /Galerie-Probe ließ sich nicht anlegen: $ANTWORT" >&2
			aufraeumen
			exit 1
		fi
		printf '%s' "$TOKEN" > "$TOKENDATEI"
		echo "eingerichtet: $ORDNER (72 + 3 Bilder), Link-Token $TOKEN"
		;;
	entfernen)
		aufraeumen
		echo "entfernt"
		;;
	*)
		echo "Aufruf: $0 einrichten|entfernen" >&2
		exit 1
		;;
esac
