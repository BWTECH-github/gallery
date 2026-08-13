# Gallery

Gallery ist die Bildergalerie für owncloud.online. Die App zeigt die Bilder
eines Ordners als Album in einer Rasteransicht, öffnet sie in einer zoombaren
Diashow und stellt für Link-Freigaben eine eigene Galerieansicht bereit. Die
App-Kennung lautet `gallery`.

<!-- Modified by BW-Tech GmbH for owncloud.online (PHP 8.4). -->

## Was die App tut

**Alben durchsehen.** Der Menüpunkt „Galerie" öffnet die Rasteransicht. Jeder
Ordner, der Bilder enthält, erscheint dort als Album; Unteralben werden über
die Brotkrumenleiste erreicht. Mit den Schaltflächen „Nach Datum ordnen" und
„Nach Name ordnen" wechseln Sie Sortierfeld und -richtung. Über „Dateiliste"
springen Sie in den Ordner der Dateien-App, über „Gallerieansicht" dort wieder
zurück in die Galerie.

**Bilder ansehen.** Ein Klick auf eine Kachel öffnet die Diashow mit
Vollbild- und Zoomdarstellung. Immer vorhanden sind „Weiter", „Zurück",
„Abspielen", „Anhalten" und „Schließen". „Herunterladen" erscheint, sobald ein
Bild geladen ist. „Löschen" und die Schaltfläche zum Drehen erscheinen nur
außerhalb öffentlicher Galerien und nur, wenn Sie die Datei löschen dürfen.
„Hintergrund umschalten" erscheint nur bei Bildern mit Transparenz und nur,
wenn `background_colour_toggle` gesetzt ist (siehe „Einstellungen").

**Albuminformationen.** Enthält ein Album die Datei `gallery.cnf`, blendet die
Schaltfläche „Albuminformation" eine Beschreibung und einen Copyright-Hinweis
ein. Beschreibung und Hinweis dürfen aus Markdown-Dateien im selben Album
geladen werden. Aufbau der Datei siehe Abschnitt „Einstellungen".

**Freigabe über einen öffentlichen Link.** In der Galerieansicht öffnet die
Schaltfläche „Teilen" den Freigabedialog des Servers. Ein dort erzeugter
„Link teilen"-Eintrag verweist auf die Galerie-Adresse

    https://<ihre-instanz>/index.php/apps/gallery/s/<token>

Empfängerinnen und Empfänger sehen das Album ohne Anmeldung in derselben
Rasteransicht, inklusive Diashow und Download. Passwortschutz, Ablaufdatum und
Upload-Erlaubnis stammen aus dem Freigabedialog des Servers; die App wertet sie
aus, setzt sie aber nicht selbst. Ist die Freigabe per Link serverseitig
abgeschaltet, weist die App öffentliche Aufrufe ab: Der Browser landet auf der
Fehlerseite der App („Entschuldigung, dieser Link scheint nicht mehr zu
funktionieren." mit dem Grund „Teilen ist deaktiviert"), Anfragen ohne
HTML-Erwartung erhalten eine JSON-Antwort mit dem Statuscode 503.

**Ordner ausschließen.** Der Eintrag „Album ausblenden" im Neu-Menü legt im
aktuellen Ordner eine Datei `.nomedia` an. Ordner mit dieser Datei werden von
der Galerie übersprungen.

## Unterstützte Formate

Die App führt keine eigene Bildumwandlung durch. Sie fragt den Server für jeden
der folgenden Medientypen ab, ob eine Vorschau erzeugt werden kann, und zeigt
nur die Typen an, für die das gelingt.

| Medientyp                 | Vorschau-Anbieter des Servers | Standardmäßig aktiv |
| ------------------------- | ----------------------------- | ------------------- |
| `image/png`               | `OC\Preview\PNG`              | ja                  |
| `image/jpeg`              | `OC\Preview\JPEG`             | ja                  |
| `image/gif`               | `OC\Preview\GIF`              | ja                  |
| `image/bmp`               | `OC\Preview\BMP`              | ja                  |
| `image/x-xbitmap`         | `OC\Preview\XBitmap`          | ja                  |
| `image/heic`, `image/heif`| `OC\Preview\Heic`             | ja, benötigt imagick|
| `image/tiff`              | `OC\Preview\TIFF`             | nein                |
| `application/x-photoshop` | `OC\Preview\Photoshop`        | nein                |
| `application/illustrator` | `OC\Preview\Illustrator`      | nein                |
| `application/postscript`  | `OC\Preview\Postscript`       | nein                |
| `image/svg+xml`           | `OC\Preview\SVG`              | nein, siehe unten   |
| `image/x-dcraw`           | kein mitgelieferter Anbieter  | nein                |

SVG ist der Sonderfall: Die App nimmt diesen Medientyp nur dann in ihre Liste
auf, wenn `features.native_svg: yes` gesetzt ist (siehe „Einstellungen"). Der
Vorschau-Anbieter `OC\Preview\SVG` allein genügt nicht. Ist die Einstellung
gesetzt und der Anbieter aktiv, liefert der Server eine Vorschau; ist der
Anbieter nicht aktiv, rendert der Browser die Datei selbst.

Zwei weitere Typen wertet die App nur für die Diashow in der Dateien-App aus,
nicht für die Galerieansicht: `application/font-sfnt` und `application/x-font`.

## Voraussetzungen

- owncloud.online 11.0 bis 11.99
- PHP 8.4
- Aktivierte Vorschauerzeugung im Server. Ohne passenden Vorschau-Anbieter
  bleibt ein Album leer, auch wenn Bilder darin liegen.
- PHP-Erweiterung `imagick` samt ImageMagick für alle Typen, deren Anbieter auf
  ImageMagick aufsetzt: HEIC/HEIF, TIFF, Photoshop, Illustrator, Postscript
  und SVG. PNG, JPEG, GIF, BMP und XBitmap kommen ohne aus.
- Aktivierte App `files_sharing` und aktivierte Freigabe per Link, wenn Sie
  Galerien öffentlich verteilen wollen.
- `composer`, wenn Sie die App aus dem Git-Repository installieren. Das
  Verzeichnis `vendor/` ist nicht Teil des Repositorys, die App benötigt aber
  `symfony/yaml`, um `gallery.cnf` zu lesen.

## Installation

Der einfachere Weg führt über den Markt Ihrer Instanz: Dort suchen Sie
„Gallery" und installieren die App mit einem Klick; Abhängigkeiten sind im
Paket bereits enthalten. Die folgende Anleitung brauchen Sie nur, wenn Sie
direkt aus dem Git-Repository installieren wollen.

    cd /var/www/owncloud.online/apps
    git clone https://github.com/BWTECH-github/gallery.git
    cd gallery
    composer install --no-dev
    chown -R www-data:www-data .
    sudo -u www-data php8.4 ../../occ app:enable gallery

Der Schritt `composer install --no-dev` ist hier nicht optional: Ohne ihn fehlt
`vendor/autoload.php`, und die App bricht beim Laden ab.

Zum Aktualisieren einer Git-Installation genügen `git pull --rebase` und ein
erneutes `composer install --no-dev` im Verzeichnis der App.

## Einstellungen

Die App bringt keine eigene Administrationsseite mit. Sie richtet sich nach
Server-Einstellungen und nach einer Konfigurationsdatei pro Album.

### Server-Einstellungen, die auf die Galerie wirken

| Schlüssel                              | Ort                       | Wirkung in der Galerie                                                        |
| -------------------------------------- | ------------------------- | ----------------------------------------------------------------------------- |
| `shareapi_allow_links`                 | App-Wert von `core`       | Steht der Wert nicht auf `yes`, weist die App öffentliche Galerie-Links ab.    |
| `shareapi_allow_public_upload`         | App-Wert von `core`       | Steuert, ob der Freigabedialog der Galerie das Hochladen über den Link anbietet. |
| `shareapi_allow_mail_notification`     | App-Wert von `core`       | Schaltet den E-Mail-Versand im Freigabedialog der Galerie frei.                |
| `shareapi_allow_public_notification`   | App-Wert von `core`       | Schaltet den E-Mail-Versand für Link-Freigaben frei.                           |
| `outgoing_server2server_share_enabled` | App-Wert von `files_sharing` | Erlaubt es Empfängern, eine öffentliche Galerie auf dem eigenen Server einzubinden. |
| `datadirectory`                        | `config/config.php`       | Pfad zu den Daten, den die App bei der Vorschauerzeugung verwendet.            |

Die Liste `enabledPreviewProviders` aus `config/config.php` liest nicht die App,
sondern der Server. Die App fragt für jeden Medientyp nur nach, ob eine Vorschau
erzeugt werden kann; die Liste entscheidet damit indirekt, was in der Galerie
sichtbar wird.

Ein Beispiel für `config/config.php`, das die nicht voreingestellten Anbieter
ergänzt:

    'enabledPreviewProviders' => [
      'OC\\Preview\\PNG',
      'OC\\Preview\\JPEG',
      'OC\\Preview\\GIF',
      'OC\\Preview\\BMP',
      'OC\\Preview\\Heic',
      'OC\\Preview\\XBitmap',
      'OC\\Preview\\TIFF',
      'OC\\Preview\\Photoshop',
      'OC\\Preview\\Illustrator',
      'OC\\Preview\\Postscript',
      'OC\\Preview\\SVG',
    ],

Sobald Sie die Liste selbst setzen, ersetzt sie die Voreinstellung
vollständig. Nehmen Sie die Anbieter, die Sie behalten wollen, mit auf.

### Album-Konfiguration `gallery.cnf`

`gallery.cnf` ist eine YAML-Datei und liegt im Ordner des Albums. Die App liest
sie beim Öffnen eines Albums und sucht sie zusätzlich in den übergeordneten
Ordnern, sofern der jeweilige Abschnitt `inherit: yes` enthält. Der Abschnitt
`features` wird ausschließlich im obersten Ordner ausgewertet.

    features:
      native_svg: yes
      external_shares: yes
      background_colour_toggle: yes

    sorting:
      type: date
      order: des
      inherit: yes

    design:
      background: "#ffffff"
      inherit: yes

    information:
      description: "Aufnahmen der Werksführung"
      description_link: liesmich.md
      copyright: "© BW-Tech GmbH"
      copyright_link: copyright.md
      inherit: yes

Bedeutung der Schlüssel:

- `features.native_svg`: `yes` nimmt SVG-Dateien überhaupt erst in die Galerie
  auf und lässt sie vom Browser darstellen, sofern kein Vorschau-Anbieter für
  SVG aktiv ist.
- `features.external_shares`: `yes` erlaubt es, Alben aus eingebundenen
  Fremdserver-Freigaben in der Galerie anzuzeigen.
- `features.background_colour_toggle`: `yes` blendet in der Diashow die
  Schaltfläche „Hintergrund umschalten" ein.
- `sorting.type`: `date` oder `name`. Andere Werte verwirft die App.
- `sorting.order`: `asc` oder `des`. Andere Werte verwirft die App.
- `design.background`: Hintergrundfarbe als Hexadezimalwert. Enthält der Wert
  hinter dem `#` andere Zeichen, verwirft die App den Abschnitt.
- `information.description` und `information.copyright`: Markdown-Text, der in
  der Albuminformation erscheint.
- `information.description_link` und `information.copyright_link`: Namen von
  Dateien im Album, deren Inhalt stattdessen geladen wird. In freigegebenen
  Ordnern entfernt die App diese Verweise, wenn sie aus einem Ordner oberhalb
  des freigegebenen Ordners stammen.
- `inherit`: `yes` gibt den jeweiligen Abschnitt an Unteralben weiter.

Ist die Datei fehlerhaft, zeigt die Galerie „Konfigurationsfehler" an und
schreibt die Fundstelle ins Server-Protokoll.

## Fehlersuche

| Symptom                                                            | Ursache                                                                                  | Abhilfe                                                                                   |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Die App lässt sich nach `git clone` nicht aktivieren oder bricht mit einem Fehler zu `Symfony\Component\Yaml` ab | `vendor/` fehlt, da es nicht im Repository liegt                                          | `composer install --no-dev` im Verzeichnis der App ausführen                                |
| Album bleibt leer, obwohl Bilder im Ordner liegen                  | Für den Medientyp ist kein Vorschau-Anbieter aktiv                                        | Anbieter in `enabledPreviewProviders` ergänzen                                               |
| TIFF-, Photoshop-, Illustrator-, Postscript- oder HEIC-Dateien fehlen | `imagick`/ImageMagick nicht installiert oder Anbieter nicht aktiviert                     | Erweiterung nachinstallieren und den Anbieter eintragen                                      |
| SVG-Dateien werden nicht angezeigt                                 | `features.native_svg` ist nicht gesetzt; ohne diese Einstellung überspringt die App SVG    | `features.native_svg: yes` in die `gallery.cnf` des obersten Ordners eintragen               |
| Ein Ordner fehlt in der Galerie                                    | Der Ordner enthält eine Datei `.nomedia`                                                 | Datei entfernen                                                                              |
| Öffentlicher Galerie-Link meldet „Entschuldigung, dieser Link scheint nicht mehr zu funktionieren." mit dem Grund „Teilen ist deaktiviert" (Statuscode 503) | `shareapi_allow_links` steht nicht auf `yes`                              | Freigabe per Link in den Einstellungen des Servers aktivieren                                |
| In einer öffentlichen Galerie ist kein Upload möglich              | `shareapi_allow_public_upload` steht nicht auf `yes`, oder die Freigabe erlaubt kein Hochladen | Server-Einstellung prüfen, danach die Berechtigung der Freigabe                             |
| „Konfigurationsfehler" statt Albuminformation                      | `gallery.cnf` ist kein gültiges YAML oder enthält unzulässige Werte                       | Datei prüfen; die genaue Fundstelle steht im Server-Protokoll                                 |
| Nach dem Deaktivieren der App laufen alte Galerie-Links ins Leere  | Die Adressen `/apps/gallery/s/<token>` werden ohne die App nicht mehr beantwortet          | Denselben Token als normalen Freigabe-Link verteilen (siehe unten)                            |

Der Token in einem Galerie-Link ist derselbe wie in der zugehörigen normalen
Link-Freigabe: Die Galerie baut ihre Adresse aus dem Token zusammen, den die
Freigabe-API des Servers liefert. `/s/<token>` führt deshalb auch ohne die App
zum selben Inhalt, nur in der normalen Dateiansicht statt in der Galerie.

## Herkunft

Gallery entstand als App der ownCloud GmbH; die ursprüngliche Entwicklung
stammt von Olivier Paroz, Robin Appelman, Jan-Christoph Borchardt (Gestaltung)
und weiteren Beitragenden. Die App steht unter der AGPL, Version 3 oder später;
der vollständige Lizenztext liegt in `COPYING`, die Autorenliste in
`AUTHORS.md`.

Dieser Fork wird von der BW-Tech GmbH für owncloud.online gepflegt und ist auf
PHP 8.4 sowie owncloud.online 11 ausgerichtet. Änderungen gegenüber der
Ursprungsfassung stehen in `CHANGELOG.md`.

- Quelltext und Fehlermeldungen: <https://github.com/BWTECH-github/gallery>
- Dokumentation zur Plattform: <https://docs.owncloud.online>
- Produktseite: <https://owncloud.online>
