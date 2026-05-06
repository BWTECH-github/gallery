<?php
/**
 * Gallery
 *
 * This file is licensed under the Affero General Public License version 3 or
 * later. See the COPYING file.
 *
 * @author Olivier Paroz <galleryapps@oparoz.com>
 * Modified by BW-Tech GmbH for owncloud.online (PHP 8.4).
 *
 * @copyright Olivier Paroz 2016
 */

namespace OCA\Gallery\Service;

/**
 * Base64 encoding utility method
 *
 * @package OCA\Gallery\Service
 */
trait Base64Encode {

	/**
	 * Returns base64 encoded data of a preview
	 *
	 * Using base64_encode for files which are downloaded
	 * (cached Thumbnails, SVG, GIFs) and using __toStrings
	 * for the previews which are instances of \OC_Image
	 *
	 * @param \OC_Image|string $previewData
	 *
	 * @return string
	 */
	protected function encode($previewData) {
		if ($previewData instanceof \OC_Image) {
			$previewData = \base64_encode($previewData->data() ?? '');
		} else {
			$previewData = \base64_encode((string)$previewData);
		}

		return $previewData;
	}
}
