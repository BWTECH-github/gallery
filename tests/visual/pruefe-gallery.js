/**
 * Galerie im Redesign, Ende zu Ende.
 *
 * Voraussetzung: gallery-testdaten.sh einrichten (Ordner „Galerie-Probe“ mit
 * 72 Bildern, „Unteralbum“ mit drei Bildern, gallery.cnf mit Albuminfo und ein
 * öffentlicher Link auf den Ordner). Die Probe lädt ein Bild hoch, setzt einen
 * Favoriten und legt kurz einen Link auf das Unteralbum an; alles davon nimmt
 * sie selbst wieder zurück (das Bild samt Papierkorbeintrag).
 *
 * Geprüft wird:
 *   Galerie-App (1440 px)
 *   - Werkzeugleiste direkt unter der Kopfleiste, Fotowand darunter ohne Lücke
 *   - #content rollt; beim Rollen lädt die Fotowand bis zum letzten Bild nach
 *   - keine Reihe ragt über die Fotowand hinaus
 *   - Neu-Knopf sichtbar und benannt, Menü (Hochladen, Album ausblenden)
 *     klappt per Tastatur unter ihm auf
 *   - Hochladen über das Menü: Datei liegt danach im Album
 *   - Albuminfo und Freigabe öffnen unter ihren Knöpfen, nicht über der
 *     Kopfleiste; Link auf ein Unteralbum anlegen und wieder löschen
 *   - Sortieren nach Name dreht die Reihenfolge
 *   - Unteralbum öffnen (Brotkrume), Diashow öffnen und mit Escape schließen
 *   - Knopf „Dateiliste“ führt in die Dateien-App im selben Ordner
 *   Galerie-App (400 px): Leiste im Fenster, Fotowand endet über der
 *   Reiterleiste, Reihen passen, Nachladen
 *   Dateien-App
 *   - Knopf „Galerie-Ansicht“ im Kartenkopf, per Tastatur bedienbar
 *   - überlebt den Wechsel Alle Dateien → Favoriten → Alle Dateien und zeigt
 *     danach auf den richtigen Ordner; in Favoriten ausgeblendet
 *   - Diashow aus Favoriten (nach Wechsel und bei Direkteinstieg) öffnet ohne
 *     Fehler, Schließen bleibt in Favoriten
 *   - Öffnen von der Startseite (openfile, back=dashboard): nach dem Schließen
 *     zurück auf der Startseite
 *   Linkseite der Dateien-App: Knopf „Galerie-Ansicht“ führt in die
 *   öffentliche Galerie
 *   Öffentliche Galerie (1440 und 400 px)
 *   - Kopf: Logo links, Herunterladen/Hinzufügen rechts, nichts überlappt
 *   - Leiste klebt beim Rollen oben, Nachladen bis zum letzten Bild
 *   - Reihen passen, Diashow öffnet
 *   - keine Konsolenfehler
 *
 * Aufruf: OC_PASSWORD=... node tests/visual/pruefe-gallery.js
 *   OC_URL (Standard http://127.0.0.1:18130), OC_USER (Standard admin)
 *
 * @copyright Copyright (c) 2026, BW-Tech GmbH
 * @license AGPL-3.0
 */
'use strict';

let chromium;
try {
	({ chromium } = require('playwright'));
} catch (e) {
	({ chromium } = require('C:/git/owncloud.online-redesign/node_modules/playwright'));
}

const BASIS = process.env.OC_URL || 'http://127.0.0.1:18130';
const BENUTZER = process.env.OC_USER || 'admin';
const PASSWORT = process.env.OC_PASSWORD;
if (!PASSWORT) {
	console.error('OC_PASSWORD fehlt.');
	process.exit(2);
}
const ALBUM = 'Galerie-Probe';

const ergebnisse = [];
function pruefe(name, ok, zusatz) {
	ergebnisse.push({ name, ok: ok === true, zusatz: zusatz === undefined ? '' : String(zusatz) });
}

// Seitenfehler mit der ersten Fundstelle – ohne sie ist ein „Cannot read
// properties of null“ keinem Skript zuzuordnen.
function seitenfehler(e) {
	const stelle = ((e.stack || '').split('\n')[1] || '').trim().replace(BASIS, '').slice(0, 140);
	return 'Seitenfehler: ' + e.message.slice(0, 160) + (stelle ? ' ' + stelle : '');
}

function basic() {
	return 'Basic ' + Buffer.from(BENUTZER + ':' + PASSWORT).toString('base64');
}

async function dav(methode, pfad, kopf, rumpf) {
	const r = await fetch(BASIS + pfad, {
		method: methode,
		headers: Object.assign({ Authorization: basic(), 'OCS-APIRequest': 'true' }, kopf || {}),
		body: rumpf,
	});
	return { status: r.status, text: methode === 'GET' && kopf && kopf.binaer ? null : await r.text(), antwort: r };
}

async function favorit(datei, an) {
	return dav('PROPPATCH', '/remote.php/webdav/' + ALBUM + '/' + datei, { 'Content-Type': 'application/xml' },
		'<?xml version="1.0"?><d:propertyupdate xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns"><d:set><d:prop><oc:favorite>' +
		(an ? '1' : '0') + '</oc:favorite></d:prop></d:set></d:propertyupdate>');
}

// Hochgeladene Probedatei löschen – samt ihrem Eintrag im Papierkorb, damit
// wiederholte Läufe dort nichts ansammeln.
async function hochgeladeneEntfernen(name) {
	// Ohne Namen zielte das DELETE auf den ganzen Ordner.
	if (!name) {
		return;
	}
	await dav('DELETE', '/remote.php/webdav/' + ALBUM + '/' + encodeURIComponent(name));
	const liste = await dav('PROPFIND', '/remote.php/dav/trash-bin/' + encodeURIComponent(BENUTZER) + '/', { Depth: '1', 'Content-Type': 'application/xml' },
		'<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns"><d:prop><oc:trashbin-original-filename/></d:prop></d:propfind>');
	for (const teil of (liste.text || '').split(/<d:response>/).slice(1)) {
		const href = (teil.match(/<d:href>([^<]+)<\/d:href>/) || [])[1];
		const original = (teil.match(/<oc:trashbin-original-filename>([^<]*)</) || [])[1];
		if (href && original === name) {
			await dav('DELETE', href);
		}
	}
}

async function linkToken() {
	const r = await dav('GET', '/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json&path=/' + ALBUM);
	const daten = JSON.parse(r.text).ocs.data || [];
	const link = daten.find((s) => s.share_type === 3 && s.path === '/' + ALBUM);
	return link ? link.token : null;
}

async function seiteOeffnen(browser, breite, hoehe, anmelden) {
	const kontext = await browser.newContext({ locale: 'de-DE', viewport: { width: breite, height: hoehe || 900 } });
	const seite = await kontext.newPage();
	const fehler = [];
	seite.on('console', (m) => {
		if (m.type() === 'error') {
			fehler.push(m.text().slice(0, 160) + ' @ ' + (m.location().url || '').replace(BASIS, '').slice(0, 100));
		}
	});
	seite.on('pageerror', (e) => fehler.push(seitenfehler(e)));
	if (anmelden) {
		await seite.goto(BASIS + '/index.php/login', { waitUntil: 'domcontentloaded' });
		await seite.fill('#user', BENUTZER);
		await seite.fill('#password', PASSWORT);
		await Promise.all([seite.waitForNavigation({ timeout: 30000 }).catch(() => {}), seite.click('#submit, button[type=submit]')]);
	}
	return { kontext, seite, fehler };
}

function kasten(seite, wahl) {
	return seite.evaluate((w) => {
		const e = document.querySelector(w);
		if (!e) {
			return null;
		}
		const r = e.getBoundingClientRect();
		const s = getComputedStyle(e);
		return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom, sichtbar: r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' };
	}, wahl);
}

// Fotowand bis zum Ende rollen; gibt die Zahl der Kacheln und die Sollzahl zurück
async function bisZumEndeRollen(seite, rollerWahl) {
	let vorher = -1;
	let gleich = 0;
	for (let i = 0; i < 60 && gleich < 4; i++) {
		await seite.evaluate((w) => {
			const r = w === 'window' ? document.scrollingElement : document.querySelector(w);
			r.scrollTop = r.scrollHeight;
			if (w === 'window') {
				window.dispatchEvent(new Event('scroll'));
			}
		}, rollerWahl);
		await seite.waitForTimeout(500);
		const jetzt = await seite.locator('#gallery a.row-element').count();
		gleich = jetzt === vorher ? gleich + 1 : 0;
		vorher = jetzt;
	}
	const soll = await seite.evaluate(() => {
		const a = window.Gallery && Gallery.albumMap[Gallery.currentAlbum];
		return a ? a.images.length + a.subAlbums.length : -1;
	});
	return { ist: vorher, soll };
}

function reihenPassen(seite) {
	return seite.evaluate(() => {
		const g = document.getElementById('gallery').getBoundingClientRect();
		let weitester = 0;
		document.querySelectorAll('#gallery a.row-element').forEach((a) => {
			weitester = Math.max(weitester, a.getBoundingClientRect().right);
		});
		return { galerieRechts: Math.round(g.right), weitester: Math.round(weitester) };
	});
}

async function diashowOffen(seite) {
	return seite.waitForFunction(() => {
		const s = document.getElementById('slideshow');
		if (!s || getComputedStyle(s).display === 'none') {
			return false;
		}
		const r = s.getBoundingClientRect();
		// Liegt sie auch obenauf? Kopfleiste, Seitenleiste und Reiterleiste
		// dürfen an keiner Ecke durchscheinen.
		const w = window.innerWidth;
		const h = window.innerHeight;
		const obenauf = [[5, 5], [w - 5, 5], [5, h - 5], [w - 5, h - 5], [w / 2, h / 2]].every((p) => {
			const e = document.elementFromPoint(p[0], p[1]);
			return !!e && s.contains(e);
		});
		return r.width >= w - 2 && r.height >= h - 2 && obenauf;
	}, null, { timeout: 15000 }).then(() => true).catch(() => false);
}

async function diashowZu(seite) {
	return seite.waitForFunction(() => {
		const s = document.getElementById('slideshow');
		return !s || getComputedStyle(s).display === 'none';
	}, null, { timeout: 10000 }).then(() => true).catch(() => false);
}

// Bild in der Dateiliste öffnen; der Kern fragt nach, wenn mehrere Betrachter
// dasselbe Format anbieten – dann die Galerie wählen.
async function inGalerieOeffnen(seite, datei) {
	await seite.locator('#fileList tr[data-file="' + datei + '"] .nametext').first().click();
	const wahl = seite.locator('a.menuitem[data-action="Gallery"]:visible, button.menuitem[data-action="Gallery"]:visible').first();
	if (await wahl.waitFor({ timeout: 4000 }).then(() => true).catch(() => false)) {
		await wahl.click();
	}
}

// Klick auf eine freie Stelle der Werkzeugleiste: schließt Menüs und
// Aufklapper, ohne (wie ein Klick in die Fotowand) ein Bild zu öffnen.
async function leereStelle(seite) {
	const l = await kasten(seite, '#controls');
	await seite.mouse.click(Math.round(l.x + l.w / 2), Math.round(l.y + l.h / 2));
	await seite.waitForTimeout(400);
}

async function ansichtWechseln(seite, id) {
	await seite.locator('#app-navigation li[data-id="' + id + '"] > a').first().click();
	await seite.waitForFunction((v) => new URLSearchParams(location.search).get('view') === v ||
		(v === 'files' && !new URLSearchParams(location.search).get('view')), id, { timeout: 15000 }).catch(() => {});
	await seite.waitForSelector('#fileList tr', { timeout: 15000 }).catch(() => {});
	await seite.waitForTimeout(800);
}

(async () => {
	const token = await linkToken();
	if (!token) {
		console.error('Kein öffentlicher Link auf /' + ALBUM + ' – erst gallery-testdaten.sh einrichten.');
		process.exit(2);
	}
	const bildRoh = await fetch(BASIS + '/remote.php/webdav/' + ALBUM + '/bild-01.jpg', { headers: { Authorization: basic() } });
	const bild = Buffer.from(await bildRoh.arrayBuffer());
	await favorit('bild-03.jpg', true);

	const browser = await chromium.launch();

	// ======================================================================
	// Galerie-App, 1440 px
	// ======================================================================
	const g = await seiteOeffnen(browser, 1440, 900, true);
	const s = g.seite;
	await s.goto(BASIS + '/index.php/apps/gallery/#' + encodeURIComponent(ALBUM), { waitUntil: 'load' });
	await s.waitForSelector('#gallery a.row-element', { timeout: 30000 });
	await s.waitForTimeout(1500);

	const kopf = await kasten(s, 'header #header, .oco-main > header');
	const leiste = await kasten(s, '#controls');
	const huelle = await kasten(s, '#content-wrapper');
	pruefe('Leiste direkt unter der Kopfleiste', !!kopf && !!leiste && Math.abs(leiste.y - kopf.b) <= 1, kopf && leiste && ('Kopf bis ' + kopf.b + ', Leiste ab ' + leiste.y));
	pruefe('Fotowand beginnt unter der Leiste (keine Überlappung, keine Lücke)', !!leiste && !!huelle && Math.abs(huelle.y - leiste.b) <= 1, huelle && ('Leiste bis ' + leiste.b + ', Fotowand ab ' + huelle.y));

	const vorRad = await s.evaluate(() => document.getElementById('content').scrollTop);
	await s.mouse.move(900, 600);
	await s.mouse.wheel(0, 1200);
	await s.waitForTimeout(800);
	const nachRad = await s.evaluate(() => document.getElementById('content').scrollTop);
	pruefe('Fotowand rollt mit dem Mausrad', nachRad > vorRad + 200, vorRad + ' → ' + nachRad);
	const ende = await bisZumEndeRollen(s, '#content');
	pruefe('Nachladen bis zum letzten Bild', ende.soll > 70 && ende.ist === ende.soll, ende.ist + ' von ' + ende.soll);
	const passt = await reihenPassen(s);
	pruefe('keine Reihe ragt über die Fotowand hinaus', passt.weitester <= passt.galerieRechts + 0.5, JSON.stringify(passt));

	// --- Neu-Knopf und Menü ----------------------------------------------------
	await s.evaluate(() => { document.getElementById('content').scrollTop = 0; });
	const neu = await kasten(s, '#controls a.button.new');
	const neuName = await s.evaluate(() => {
		const a = document.querySelector('#controls a.button.new');
		return a ? (a.getAttribute('role') + '|' + (a.querySelector('img') || {}).alt) : '';
	});
	pruefe('Neu-Knopf sichtbar, in der Leiste, als Knopf benannt', !!neu && neu.sichtbar && neu.y >= leiste.y && neu.b <= leiste.b && /^button\|.+/.test(neuName), neu && JSON.stringify(neu) + ' ' + neuName);
	await s.locator('#controls a.button.new').focus();
	await s.keyboard.press('Enter');
	await s.waitForSelector('.newFileMenu:not(.hidden)', { timeout: 5000 }).catch(() => {});
	const menue = await kasten(s, '.newFileMenu');
	const eintraege = await s.evaluate(() => Array.from(document.querySelectorAll('.newFileMenu .menuitem')).filter((m) => m.getClientRects().length).map((m) => m.getAttribute('data-action')));
	pruefe('Neu-Menü per Tastatur, unter dem Knopf, im Fenster', !!menue && menue.sichtbar && menue.y >= neu.b - 2 && menue.r <= 1440 && menue.b <= 900, menue && JSON.stringify(menue));
	// Die Galerie bietet nur Hochladen und „Album ausblenden“ an (wie in main);
	// einen Ordner legt sie nicht an.
	pruefe('Neu-Menü: Hochladen und Album ausblenden', ['upload', 'hideAlbum'].every((x) => eintraege.includes(x)), eintraege.join(','));
	await s.keyboard.press('Escape');
	await leereStelle(s);
	await s.waitForTimeout(400);

	// --- Hochladen -------------------------------------------------------------
	const hochName = 'hochgeladen-' + Date.now() + '.jpg';
	await s.setInputFiles('#file_upload_start', { name: hochName, mimeType: 'image/jpeg', buffer: bild });
	const hochOk = await s.waitForFunction((p) => !!(window.Gallery && Gallery.imageMap[p]), ALBUM + '/' + hochName, { timeout: 30000 }).then(() => true).catch(() => false);
	// HEAD statt PROPFIND: der Kern antwortet auf ein PROPFIND nach einer
	// fehlenden Datei derzeit mit 207 (Befund 22.09.) – daran ließe sich
	// „vorhanden“ nicht von „fehlt“ unterscheiden.
	const hochDav = await dav('HEAD', '/remote.php/webdav/' + ALBUM + '/' + hochName);
	pruefe('Hochladen über die Galerie: Datei im Album und in der Fotowand', hochOk && hochDav.status === 200, 'Galerie ' + hochOk + ', WebDAV ' + hochDav.status);
	const panel = await s.evaluate(() => !!document.querySelector('.oco-uploads'));
	pruefe('Hochladen: Fortschritt im Upload-Panel der Schale', panel);
	await hochgeladeneEntfernen(hochName);
	const weg = await dav('HEAD', '/remote.php/webdav/' + ALBUM + '/' + hochName);
	pruefe('Hochladen: Probedatei wieder entfernt', weg.status === 404, 'WebDAV ' + weg.status);

	// --- Albuminfo --------------------------------------------------------------
	const info = await kasten(s, '#album-info-button');
	if (info && info.sichtbar) {
		await s.click('#album-info-button');
		await s.waitForFunction(() => {
			const c = document.querySelector('.album-info-container');
			return c && getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().height > 40;
		}, null, { timeout: 5000 }).catch(() => {});
		await s.waitForTimeout(600);
		const kasten2 = await kasten(s, '.album-info-container');
		const text = await s.evaluate(() => (document.querySelector('.album-info-content') || {}).textContent || '');
		pruefe('Albuminfo öffnet unter der Leiste, rechtsbündig, im Fenster', !!kasten2 && kasten2.sichtbar && kasten2.y >= leiste.b - 1 && kasten2.r <= 1440 && kasten2.x >= 244, kasten2 && JSON.stringify(kasten2));
		pruefe('Albuminfo zeigt die Beschreibung aus gallery.cnf', /Redesign-Prüfung/.test(text), text.slice(0, 80));
		await leereStelle(s);
		await s.waitForTimeout(600);
	} else {
		pruefe('Albuminfo-Knopf sichtbar (gallery.cnf vorhanden)', false, JSON.stringify(info));
	}

	// --- Sortieren -------------------------------------------------------------
	const ersteVorher = await s.evaluate(() => (document.querySelector('#gallery a.row-element:not([data-dir])') || {}).getAttribute && document.querySelector('#gallery a.row-element:not([data-dir])').getAttribute('data-path'));
	await s.click('#sort-name-button');
	await s.waitForTimeout(1500);
	const ersteNachher = await s.evaluate(() => { const a = document.querySelector('#gallery a.row-element:not([data-dir])'); return a && a.getAttribute('data-path'); });
	pruefe('Sortieren nach Name dreht die Reihenfolge', !!ersteVorher && !!ersteNachher && ersteVorher !== ersteNachher, ersteVorher + ' → ' + ersteNachher);
	await s.click('#sort-name-button');
	await s.waitForTimeout(1500);

	// --- Diashow -----------------------------------------------------------------
	await s.locator('#gallery a.row-element[data-path="' + ALBUM + '/bild-02.jpg"]').click();
	pruefe('Diashow öffnet über die ganze Fläche', await diashowOffen(s));
	const bildGeladen = await s.waitForFunction(() => {
		const i = document.querySelector('#slideshow img');
		return i && i.naturalWidth > 0;
	}, null, { timeout: 15000 }).then(() => true).catch(() => false);
	pruefe('Diashow zeigt das Bild', bildGeladen);
	await s.keyboard.press('Escape');
	pruefe('Diashow schließt mit Escape', await diashowZu(s));

	// --- Unteralbum, Freigabe ------------------------------------------------------
	await s.locator('#gallery a.row-element[data-dir]').first().click();
	await s.waitForFunction(() => decodeURIComponent(location.hash).indexOf('Unteralbum') !== -1, null, { timeout: 10000 }).catch(() => {});
	await s.waitForSelector('#gallery a.row-element[data-path$="unter-1.jpg"]', { timeout: 15000 }).catch(() => {});
	const krumen = await s.evaluate(() => Array.from(document.querySelectorAll('#breadcrumbs .crumb')).filter((c) => c.getClientRects().length).map((c) => c.textContent.trim() || '⌂'));
	pruefe('Unteralbum: Brotkrume zeigt den Pfad', krumen.join('/').indexOf(ALBUM) !== -1 && krumen[krumen.length - 1] === 'Unteralbum', krumen.join(' / '));

	await s.click('#share-button');
	await s.waitForSelector('#dropdown', { timeout: 8000 }).catch(() => {});
	await s.waitForTimeout(800);
	const frei = await kasten(s, '#dropdown');
	pruefe('Freigabe öffnet unter der Leiste, im Fenster', !!frei && frei.sichtbar && frei.y >= leiste.b - 1 && frei.r <= 1440 && frei.x >= 244, frei && JSON.stringify(frei));
	// Das Kästchen selbst ist verdeckt, gezeichnet wird es vom Label davor –
	// geklickt wird deshalb wie vom Nutzer auf das Label.
	const linkLabel = s.locator('#dropdown label[for="linkCheckbox"]');
	if (await linkLabel.count()) {
		await linkLabel.click();
		const url = await s.waitForFunction(() => {
			const f = document.querySelector('#dropdown #linkText');
			return f && /\/s\//.test(f.value) && f.getClientRects().length ? f.value : false;
		}, null, { timeout: 10000 }).then((h) => h.jsonValue()).catch(() => '');
		pruefe('Freigabe: Link auf das Unteralbum anlegen', !!url, url);
		await linkLabel.click();
		await s.waitForTimeout(2000);
		const rest = await dav('GET', '/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json&path=/' + ALBUM + '/Unteralbum');
		const reste = (JSON.parse(rest.text).ocs.data || []).filter((x) => x.share_type === 3);
		pruefe('Freigabe: Link wieder gelöscht', reste.length === 0, reste.length + ' Link(s) übrig');
		for (const x of reste) {
			await dav('DELETE', '/ocs/v2.php/apps/files_sharing/api/v1/shares/' + x.id);
		}
	} else {
		pruefe('Freigabe: Linkschalter vorhanden', false);
	}
	await leereStelle(s);
	await s.waitForTimeout(500);

	// --- Knopf Dateiliste ----------------------------------------------------------
	await Promise.all([s.waitForNavigation({ timeout: 20000 }).catch(() => {}), s.click('#filelist-button')]);
	const dateiUrl = decodeURIComponent(s.url());
	pruefe('Knopf „Dateiliste“ führt in denselben Ordner der Dateien-App', /\/apps\/files\/?\?dir=\/Galerie-Probe\/Unteralbum/.test(dateiUrl), dateiUrl.replace(BASIS, ''));
	pruefe('keine Konsolenfehler (Galerie, 1440)', g.fehler.length === 0, g.fehler.join(' | '));

	// ======================================================================
	// Dateien-App
	// ======================================================================
	const d = s;
	d.removeAllListeners('console');
	const dFehler = [];
	d.on('pageerror', (e) => dFehler.push(seitenfehler(e)));
	await d.goto(BASIS + '/index.php/apps/files/?dir=/' + ALBUM, { waitUntil: 'load' });
	await d.waitForSelector('#fileList tr[data-file="bild-01.jpg"]', { timeout: 30000 });
	await d.waitForSelector('.oco-list-head #gallery-button', { state: 'visible', timeout: 8000 }).catch(() => {});
	const kk = await kasten(d, '.oco-list-head');
	const gk = await kasten(d, '#gallery-button');
	const inKopf = await d.evaluate(() => { const b = document.getElementById('gallery-button'); return !!b && !!b.closest('.oco-list-head'); });
	pruefe('Dateien: Knopf „Galerie-Ansicht“ im Kartenkopf, rechts', inKopf && !!gk && gk.sichtbar && !!kk && gk.r >= kk.r - 40 && gk.y >= kk.y && gk.b <= kk.b, gk && kk && ('Knopf ' + JSON.stringify(gk) + ' Kopf ' + JSON.stringify(kk)));
	const zeilenVorKnopf = await d.evaluate(() => { const c = document.querySelector('#app-content #controls'); return c ? Math.round(c.getBoundingClientRect().height) : -1; });
	pruefe('Dateien: keine eigene Zeile für den Knopf über der Tabelle', zeilenVorKnopf <= 1, 'Höhe #controls ' + zeilenVorKnopf);

	await ansichtWechseln(d, 'favorites');
	const inFav = await kasten(d, '#gallery-button');
	pruefe('Dateien: in Favoriten kein Galerie-Knopf', !inFav || !inFav.sichtbar, JSON.stringify(inFav));
	await ansichtWechseln(d, 'files');
	await d.waitForSelector('.oco-list-head #gallery-button', { state: 'visible', timeout: 8000 }).catch(() => {});
	const nachWechsel = await d.evaluate(() => {
		const b = document.getElementById('gallery-button');
		const liste = OCA.Files.App.fileList;
		return { da: !!b && b.getClientRects().length > 0 && !!b.closest('.oco-list-head'), url: window.GalleryButton && GalleryButton.url, dir: liste && liste.getCurrentDirectory() };
	});
	const sollAnker = '#' + encodeURIComponent((nachWechsel.dir || '/').replace(/^\//, ''));
	pruefe('Dateien: Knopf nach Wechsel Favoriten → Alle Dateien wieder da und aktuell', nachWechsel.da && !!nachWechsel.url && nachWechsel.url.endsWith(sollAnker), JSON.stringify(nachWechsel));
	// in einen Ordner wechseln: Adresse wird nachgeführt
	await d.goto(BASIS + '/index.php/apps/files/?dir=/' + ALBUM, { waitUntil: 'load' });
	await d.waitForSelector('#fileList tr[data-file="Unteralbum"]', { timeout: 30000 });
	await d.locator('#fileList tr[data-file="Unteralbum"] .nametext').first().click();
	await d.waitForFunction(() => window.GalleryButton && /Unteralbum$/.test(decodeURIComponent(GalleryButton.url || '')), null, { timeout: 10000 }).catch(() => {});
	const unterUrl = await d.evaluate(() => window.GalleryButton && decodeURIComponent(GalleryButton.url || ''));
	pruefe('Dateien: Knopf folgt dem Ordnerwechsel', /Galerie-Probe\/Unteralbum$/.test(unterUrl || ''), unterUrl);
	await d.waitForSelector('.oco-list-head #gallery-button', { state: 'visible', timeout: 8000 }).catch(() => {});
	await d.locator('#gallery-button').focus();
	await Promise.all([d.waitForNavigation({ timeout: 20000 }).catch(() => {}), d.keyboard.press('Enter')]);
	pruefe('Dateien: Knopf per Tastatur öffnet die Galerie im selben Ordner', /\/apps\/gallery\/#Galerie-Probe%2FUnteralbum$/.test(d.url()), d.url().replace(BASIS, ''));

	// Diashow aus Favoriten nach Ansichtswechsel
	await d.goto(BASIS + '/index.php/apps/files/?dir=/' + ALBUM, { waitUntil: 'load' });
	await d.waitForSelector('#fileList tr[data-file="bild-01.jpg"]', { timeout: 30000 });
	await ansichtWechseln(d, 'favorites');
	await d.waitForSelector('#fileList tr[data-file="bild-03.jpg"]', { timeout: 15000 }).catch(() => {});
	let fehlerVorher = dFehler.length;
	await inGalerieOeffnen(d, 'bild-03.jpg');
	pruefe('Favoriten (nach Wechsel): Diashow öffnet', await diashowOffen(d), dFehler.slice(fehlerVorher).join(' | '));
	pruefe('Favoriten (nach Wechsel): kein Skriptfehler', dFehler.length === fehlerVorher, dFehler.slice(fehlerVorher).join(' | '));
	await d.keyboard.press('Escape');
	await diashowZu(d);
	await d.waitForTimeout(1500);
	const nachSchliessen = await d.evaluate(() => ({ view: new URLSearchParams(location.search).get('view'), aktiv: (document.querySelector('#app-navigation li.active') || {}).getAttribute && document.querySelector('#app-navigation li.active').getAttribute('data-id') }));
	pruefe('Favoriten: nach dem Schließen weiter in Favoriten', nachSchliessen.view === 'favorites' && nachSchliessen.aktiv === 'favorites', JSON.stringify(nachSchliessen));

	// Direkteinstieg ?view=favorites (window.FileList ist dann das des Browsers)
	await d.goto(BASIS + '/index.php/apps/files/?view=favorites', { waitUntil: 'load' });
	await d.waitForSelector('#fileList tr[data-file="bild-03.jpg"]', { timeout: 30000 }).catch(() => {});
	await d.waitForTimeout(1000);
	fehlerVorher = dFehler.length;
	await inGalerieOeffnen(d, 'bild-03.jpg');
	pruefe('Favoriten (Direkteinstieg): Diashow öffnet ohne Skriptfehler', await diashowOffen(d) && dFehler.length === fehlerVorher, dFehler.slice(fehlerVorher).join(' | '));
	await d.keyboard.press('Escape');
	await diashowZu(d);

	// Öffnen von der Startseite und Rückweg
	await d.goto(BASIS + '/index.php/apps/files/?dir=/' + ALBUM + '&scrollto=bild-02.jpg&openfile=bild-02.jpg&back=dashboard', { waitUntil: 'load' });
	const wahl = d.locator('a.menuitem[data-action="Gallery"]:visible, button.menuitem[data-action="Gallery"]:visible').first();
	if (await wahl.waitFor({ timeout: 10000 }).then(() => true).catch(() => false)) {
		await wahl.click();
	}
	const startOffen = await diashowOffen(d);
	await d.keyboard.press('Escape');
	const zurStart = await d.waitForURL(/\/apps\/dashboard\//, { timeout: 15000 }).then(() => true).catch(() => false);
	pruefe('Startseite → Bild → Diashow → Schließen führt zurück zur Startseite', startOffen && zurStart, 'offen ' + startOffen + ', Adresse ' + d.url().replace(BASIS, ''));
	pruefe('keine Skriptfehler (Dateien-App)', dFehler.length === 0, dFehler.join(' | '));
	await g.kontext.close();

	// ======================================================================
	// Galerie-App, 400 px
	// ======================================================================
	const m = await seiteOeffnen(browser, 400, 800, true);
	await m.seite.goto(BASIS + '/index.php/apps/gallery/#' + encodeURIComponent(ALBUM), { waitUntil: 'load' });
	await m.seite.waitForSelector('#gallery a.row-element', { timeout: 30000 });
	await m.seite.waitForTimeout(1500);
	const mLeiste = await m.seite.evaluate(() => Array.from(document.querySelectorAll('#controls .button, #controls #breadcrumbs')).filter((e) => e.getClientRects().length).map((e) => Math.round(e.getBoundingClientRect().right)));
	pruefe('400 px: alle Knöpfe der Leiste im Fenster', mLeiste.length > 0 && Math.max.apply(null, mLeiste) <= 400, mLeiste.join(','));
	const mHoehe = await kasten(m.seite, '#controls');
	pruefe('400 px: Leiste bleibt einzeilig', !!mHoehe && mHoehe.h <= 64, mHoehe && mHoehe.h);
	const reiter = await kasten(m.seite, '.oco-tabbar');
	const inhalt = await kasten(m.seite, '#content');
	pruefe('400 px: Fotowand endet über der Reiterleiste', !!reiter && !!inhalt && inhalt.b <= reiter.y + 1, inhalt && reiter && (inhalt.b + ' / ' + reiter.y));
	const mEnde = await bisZumEndeRollen(m.seite, '#content');
	pruefe('400 px: Nachladen bis zum letzten Bild', mEnde.ist === mEnde.soll && mEnde.soll > 70, mEnde.ist + ' von ' + mEnde.soll);
	const mPasst = await reihenPassen(m.seite);
	pruefe('400 px: Reihen passen', mPasst.weitester <= mPasst.galerieRechts + 0.5, JSON.stringify(mPasst));
	const mBreite = await m.seite.evaluate(() => document.documentElement.scrollWidth);
	pruefe('400 px: kein waagerechtes Rollen', mBreite <= 400, mBreite);
	pruefe('keine Konsolenfehler (Galerie, 400)', m.fehler.length === 0, m.fehler.join(' | '));
	await m.kontext.close();

	// ======================================================================
	// Linkseite der Dateien-App
	// ======================================================================
	const l = await seiteOeffnen(browser, 1440, 900, false);
	await l.seite.goto(BASIS + '/index.php/s/' + token, { waitUntil: 'load' });
	await l.seite.waitForSelector('#fileList tr[data-file="bild-01.jpg"]', { timeout: 30000 }).catch(() => {});
	await l.seite.waitForSelector('#gallery-button', { state: 'visible', timeout: 8000 }).catch(() => {});
	const lk = await kasten(l.seite, '#gallery-button');
	const lc = await kasten(l.seite, '#controls');
	pruefe('Linkseite: Knopf „Galerie-Ansicht“ im Kartenkopf', !!lk && lk.sichtbar && !!lc && lk.y >= lc.y && lk.b <= lc.b && lk.r <= lc.r, lk && lc && (JSON.stringify(lk) + ' in ' + JSON.stringify(lc)));
	await Promise.all([l.seite.waitForNavigation({ timeout: 20000 }).catch(() => {}), l.seite.click('#gallery-button').catch(() => {})]);
	pruefe('Linkseite: Knopf führt in die öffentliche Galerie', l.seite.url().indexOf('/apps/gallery/s/' + token) !== -1, l.seite.url().replace(BASIS, ''));
	await l.kontext.close();

	// ======================================================================
	// Öffentliche Galerie
	// ======================================================================
	for (const breite of [1440, 400]) {
		const o = await seiteOeffnen(browser, breite, breite === 400 ? 800 : 900, false);
		const q = o.seite;
		await q.goto(BASIS + '/index.php/apps/gallery/s/' + token, { waitUntil: 'load' });
		await q.waitForSelector('#gallery a.row-element', { timeout: 30000 });
		await q.waitForTimeout(1500);
		const kopfRechts = await kasten(q, '#header .header-right');
		const logo = await kasten(q, '#header .logo-icon');
		const herunter = await kasten(q, '#header #download');
		pruefe(breite + ' px öffentlich: Logo links, Aktionen rechts, ohne Überlappung',
			!!kopfRechts && !!logo && logo.x <= 32 && kopfRechts.r >= breite - 32 && kopfRechts.x >= logo.r && herunter && herunter.sichtbar,
			JSON.stringify({ logo, kopfRechts, herunter }));
		const qLeiste = await kasten(q, '#controls');
		pruefe(breite + ' px öffentlich: Leiste unter dem Kopf', !!qLeiste && Math.abs(qLeiste.y - 64) <= 1, qLeiste && qLeiste.y);
		const qEnde = await bisZumEndeRollen(q, 'window');
		pruefe(breite + ' px öffentlich: Nachladen bis zum letzten Bild', qEnde.ist === qEnde.soll && qEnde.soll > 70, qEnde.ist + ' von ' + qEnde.soll);
		const klebt = await kasten(q, '#controls');
		pruefe(breite + ' px öffentlich: Leiste klebt beim Rollen oben', !!klebt && Math.abs(klebt.y) <= 1, klebt && klebt.y);
		const qPasst = await reihenPassen(q);
		pruefe(breite + ' px öffentlich: Reihen passen', qPasst.weitester <= qPasst.galerieRechts + 0.5, JSON.stringify(qPasst));
		const qBreite = await q.evaluate(() => document.documentElement.scrollWidth);
		pruefe(breite + ' px öffentlich: kein waagerechtes Rollen', qBreite <= breite, qBreite);
		if (breite === 1440) {
			const speichern = await kasten(q, '#save-button');
			pruefe('öffentlich: „Hinzufügen“ sichtbar im Kopf', !!speichern && speichern.sichtbar && speichern.y < 64, JSON.stringify(speichern));
			await q.evaluate(() => window.scrollTo(0, 0));
			await q.locator('#gallery a.row-element[data-path$="bild-05.jpg"]').click();
			pruefe('öffentlich: Diashow öffnet', await diashowOffen(q));
			await q.keyboard.press('Escape');
			await diashowZu(q);
		}
		pruefe('keine Konsolenfehler (öffentlich, ' + breite + ')', o.fehler.length === 0, o.fehler.join(' | '));
		await o.kontext.close();
	}

	await browser.close();
	await favorit('bild-03.jpg', false);

	let fehler = 0;
	for (const e of ergebnisse) {
		console.log((e.ok ? 'OK    ' : 'FEHL  ') + e.name + (e.zusatz ? '  (' + e.zusatz + ')' : ''));
		if (!e.ok) {
			fehler++;
		}
	}
	console.log('\n' + (ergebnisse.length - fehler) + '/' + ergebnisse.length + ' bestanden');
	process.exit(fehler === 0 ? 0 : 1);
})().catch(async (e) => {
	console.error(e);
	try {
		await favorit('bild-03.jpg', false);
	} catch (x) {
		// Aufräumen ist best effort
	}
	process.exit(2);
});
