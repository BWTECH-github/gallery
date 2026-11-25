<?php
/**
 * Gallery
 *
 * This file is licensed under the Affero General Public License version 3 or
 * later. See the COPYING file.
 *
 * @author Olivier Paroz <galleryapps@oparoz.com>
 *
 * @copyright Olivier Paroz 2016
 */

namespace OCA\Gallery\Service;

use OCP\Files\File;

/**
 * Prepares the file to download
 *
 * @package OCA\Gallery\Service
 */
class DownloadService extends Service {
	use Base64Encode;

	/**
	 * Darf das Original ausgeliefert werden? Nicht bei einer empfangenen Freigabe
	 * mit „Download nicht erlaubt“ (Attribut permissions.download) – dieselbe
	 * Regel wie im Kern (files_sharing ViewOnly, WebDAV ViewOnlyPlugin).
	 *
	 * @param File $file
	 *
	 * @return bool
	 */
	public function isDownloadAllowed($file) {
		$storage = $file->getStorage();
		if ($storage === null || !$storage->instanceOfStorage('OCA\Files_Sharing\SharedStorage')) {
			return true;
		}
		/** @var \OCA\Files_Sharing\SharedStorage $storage */
		$attributes = $storage->getShare()->getAttributes();
		if ($attributes === null) {
			return true;
		}

		return $attributes->getAttribute('permissions', 'download') !== false;
	}

	/**
	 * Downloads the requested file
	 *
	 * @param File $file
	 * @param bool $base64Encode
	 *
	 * @return array|false
	 * @throws NotFoundServiceException
	 */
	public function downloadFile($file, $base64Encode = false) {
		try {
			$this->logger->debug(
				"[DownloadService] File to Download: {name}",
				['name' => $file->getName()]
			);
			$download = [
				'preview'  => $file->getContent(),
				'mimetype' => $file->getMimeType()
			];

			if ($base64Encode) {
				$download['preview'] = $this->encode($download['preview']);
			}

			return $download;
		} catch (\Exception $exception) {
			throw new NotFoundServiceException('There was a problem accessing the file');
		}
	}
}
