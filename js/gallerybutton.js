/* global OC, OCA, FileList, $, t */
var GalleryButton = {};
GalleryButton.isPublic = false;
GalleryButton.button = {};
GalleryButton.url = null;

/**
 * Rebuilds the Gallery URL every time the files list has changed
 */
GalleryButton.onFileListUpdated = function () {
	"use strict";
	var fileList = GalleryButton.getFileList();

	// Die Sonderansichten (Favoriten, geteilte Dateien, Tags, Papierkorb) führen
	// kein Verzeichnis. Ohne diese Prüfung landet der Aufruf beim nativen
	// window.FileList des Browsers und bricht mit einem TypeError ab.
	if (!fileList || typeof fileList.getCurrentDirectory !== 'function') {
		GalleryButton.url = null;
		GalleryButton.toggleButton(false);
		return;
	}

	GalleryButton.buildGalleryUrl(fileList.getCurrentDirectory().replace(/^\//, ''));
	GalleryButton.place(fileList, true);
	GalleryButton.toggleButton(true);
};

/**
 * Returns the file list of the view which is currently shown
 */
GalleryButton.getFileList = function () {
	"use strict";

	if (GalleryButton.isPublic) {
		return (OCA.Sharing && OCA.Sharing.PublicApp) ? OCA.Sharing.PublicApp.fileList : null;
	}

	// Der Kern hält nur die Liste von „Alle Dateien“ bereit; in jeder anderen
	// Ansicht ist sie null – dort gibt es kein Verzeichnis, das die Galerie
	// zeigen könnte.
	if (OCA.Files && OCA.Files.App && 'fileList' in OCA.Files.App) {
		return OCA.Files.App.fileList;
	}

	return (typeof FileList !== 'undefined') ? FileList : null;
};

/**
 * Hängt den Knopf dorthin, wo die laufende Liste ihre Bedienelemente führt
 *
 * Im Redesign baut der Kern jede Ansicht beim Wechsel neu auf – mit neuem
 * #controls und neuer Liste. Einmal beim Laden angehängt, war der Knopf nach
 * dem ersten Wechsel weg. Deshalb wird bei jeder Aktualisierung der Liste
 * nachgesehen und nötigenfalls umgehängt.
 *
 * Bevorzugt steht er im Kartenkopf der Liste (.oco-list-head, rechts neben dem
 * Zieh-Hinweis). Den baut der Kern etwas nach der Liste (Beobachter mit
 * 120 ms Takt); bis dahin wird einmal gewartet, statt den Knopf erst in eine
 * eigene Zeile über der Tabelle und dann in den Kopf springen zu lassen.
 *
 * @param {Object} fileList
 * @param {boolean} warten beim ersten Versuch auf den Kartenkopf warten
 */
GalleryButton.place = function (fileList, warten) {
	"use strict";
	var $button = GalleryButton.button;
	if (!$button || !$button.length || !fileList || !fileList.$el) {
		return;
	}
	var $table = fileList.$el.find('#filestable');
	var $head = $table.parent().children('.oco-list-head');
	if ($head.length) {
		if ($button.parent()[0] !== $head[0]) {
			$head.append($button);
		}
		return;
	}
	if (warten) {
		clearTimeout(GalleryButton._platzTakt);
		GalleryButton._platzTakt = setTimeout(function () {
			GalleryButton.place(fileList, false);
		}, 250);
		if (!$.contains(document.documentElement, $button[0])) {
			return;
		}
	}
	var $controls = fileList.$el.find('#controls');
	if (!$controls.length) {
		$controls = $('#controls');
	}
	// Ans Ende: auf der Linkseite ist #controls eine Flex-Zeile (rechts außen),
	// in der alten Leiste schwamm der Knopf ohnehin per float nach rechts.
	if ($button.parent()[0] !== $controls[0]) {
		$controls.append($button);
	}
};

/**
 * Hides the button while no gallery URL could be built
 */
GalleryButton.toggleButton = function (visible) {
	"use strict";

	if (GalleryButton.button && typeof GalleryButton.button.toggle === 'function') {
		GalleryButton.button.toggle(!!visible);
	}
};

/**
 * Builds the URL which will load the exact same folder in Gallery
 *
 * @param dir
 */
GalleryButton.buildGalleryUrl = function (dir) {
	"use strict";
	var params = {};
	var tokenPath = '';
	var sharingTokenElement = $('#sharingToken');
	var token = (sharingTokenElement.val()) ? sharingTokenElement.val() : false;
	if (token) {
		params.token = token;
		tokenPath = 's/{token}';
	}
	GalleryButton.url =
		OC.generateUrl('apps/gallery/' + tokenPath, params) + '#' + encodeURIComponent(dir);
};

$(document).ready(function () {
		"use strict";
		if ($('#body-login').length > 0) {
			return true; //deactivate on login page
		}

		if ($('html').is('.ie8')) {
			return true; //deactivate in IE8
		}

		if ($('#isPublic').val()) {
			GalleryButton.isPublic = true;
		}

		if ($('#filesApp').val()) {

			// Am Dokument statt an #fileList: die Liste wird bei jedem
			// Ansichtswechsel neu gebaut, eine direkte Bindung liefe danach ins
			// Leere und der Knopf zeigte weiter auf den Ordner von vorher.
			$(document).on('updated', '#fileList', GalleryButton.onFileListUpdated);
			// Beim Wechsel der Ansicht sofort weg, bis die neue Liste steht –
			// sonst führte er kurz noch in den alten Ordner.
			$('#app-navigation').on('itemChanged', function () {
				GalleryButton.url = null;
				GalleryButton.toggleButton(false);
			});

			// Button for opening files list as gallery view
			// Rolle, Tabulatorstopp und Beschriftung machen den Knopf mit der
			// Tastatur bedienbar; das Bild selbst bleibt dekorativ.
			GalleryButton.button =
				$('<div id="gallery-button" class="button view-switcher" role="button" tabindex="0">' +
						'<div id="button-loading"></div>' +
					'<img class="svg" src="' + OC.imagePath('core', 'actions/toggle-pictures.svg') +
					'"' +
					'alt=""/>' +
					'</div>');
			GalleryButton.button.attr('aria-label', t('gallery', 'Gallery view'));
			GalleryButton.button.attr('title', t('gallery', 'Gallery view'));
			GalleryButton.button.hide();

			GalleryButton.button.on('click keydown', function (event) {
				if (event.type === 'keydown' &&
						event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') {
					return;
				}
				event.preventDefault();

				if (!GalleryButton.url) {
					return;
				}

				$(this).children('#button-loading').addClass('loading');
				window.location.href = GalleryButton.url;
			});
		}
	}
);
