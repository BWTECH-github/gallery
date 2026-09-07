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

	// Die Sonderansichten (Favoriten, geteilte Dateien, Tags, Papierkorb) fuehren
	// kein Verzeichnis. Ohne diese Pruefung landet der Aufruf beim nativen
	// window.FileList des Browsers und bricht mit einem TypeError ab.
	if (!fileList || typeof fileList.getCurrentDirectory !== 'function') {
		GalleryButton.url = null;
		GalleryButton.toggleButton(false);
		return;
	}

	GalleryButton.buildGalleryUrl(fileList.getCurrentDirectory().replace(/^\//, ''));
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

	// Der Kern haelt die Liste der aktiven Ansicht bereit; das alte globale
	// FileList gibt es nur noch in der Standardansicht.
	if (OCA.Files && OCA.Files.App && typeof OCA.Files.App.getCurrentFileList === 'function') {
		return OCA.Files.App.getCurrentFileList();
	}

	return (typeof FileList !== 'undefined') ? FileList : null;
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

			$('#fileList').on('updated', GalleryButton.onFileListUpdated);

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

			$('#controls').prepend(GalleryButton.button);
		}
	}
);
