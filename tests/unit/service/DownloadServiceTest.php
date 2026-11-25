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
 * Class DownloadServiceTest
 *
 * @package OCA\Gallery\Controller
 */
class DownloadServiceTest extends \Test\GalleryUnitTest {
	use Base64Encode;

	/** @var DownloadService */
	protected $service;

	/**
	 * Test set up
	 */
	public function setUp(): void {
		parent::setUp();

		$this->service = new DownloadService(
			$this->appName,
			$this->environment,
			$this->logger
		);
	}

	public function testDownloadRawFile() {
		/** @type File $file */
		$file = $this->mockJpgFile(12345);

		$download = [
			'preview'  => $file->getContent(),
			'mimetype' => $file->getMimeType()
		];

		$downloadResponse = $this->service->downloadFile($file);

		$this->assertSame($download['mimetype'], $downloadResponse['mimetype']);
		$this->assertSame($download['preview'], $downloadResponse['preview']);
	}

	public function testDownloadBase64EncodedFile() {
		/** @type File $file */
		$file = $this->mockJpgFile(12345);

		$download = [
			'preview'  => $this->encode($file->getContent()),
			'mimetype' => $file->getMimeType()
		];

		$downloadResponse = $this->service->downloadFile($file, true);

		$this->assertSame($download['mimetype'], $downloadResponse['mimetype']);
		$this->assertSame($download['preview'], $downloadResponse['preview']);
	}

	/**
	 */
	public function testDownloadNonExistentFile() {
		$this->expectException(\OCA\Gallery\Service\NotFoundServiceException::class);

		$file = $this->mockBadFile();

		$this->service->downloadFile($file);
	}

	public function providesIsDownloadAllowedData() {
		return [
			'eigene Datei' => [false, null, true],
			'Freigabe ohne Attribute' => [true, null, true],
			'Freigabe mit Download' => [true, true, true],
			'Freigabe ohne Angabe' => [true, 'unset', true],
			'Freigabe ohne Download' => [true, false, false],
		];
	}

	/**
	 * @dataProvider providesIsDownloadAllowedData
	 *
	 * @param bool $shared Datei liegt auf einer empfangenen Freigabe
	 * @param bool|null|string $download Attribut permissions.download (null: keine Attribute)
	 * @param bool $expected
	 */
	public function testIsDownloadAllowed($shared, $download, $expected) {
		$storage = $this->getMockBuilder(\OCA\Files_Sharing\SharedStorage::class)
						->disableOriginalConstructor()
						->getMock();
		$storage->method('instanceOfStorage')
				->willReturnCallback(function ($class) use ($shared) {
					return $shared && \ltrim($class, '\\') === 'OCA\Files_Sharing\SharedStorage';
				});
		$share = $this->getMockBuilder(\OCP\Share\IShare::class)->getMock();
		if ($download === null) {
			$share->method('getAttributes')->willReturn(null);
		} else {
			$attributes = $this->getMockBuilder(\OCP\Share\IAttributes::class)->getMock();
			$attributes->method('getAttribute')
					   ->with('permissions', 'download')
					   ->willReturn($download === 'unset' ? null : $download);
			$share->method('getAttributes')->willReturn($attributes);
		}
		$storage->method('getShare')->willReturn($share);
		$file = $this->getMockBuilder(File::class)->getMock();
		$file->method('getStorage')->willReturn($storage);

		$this->assertSame($expected, $this->service->isDownloadAllowed($file));
	}
}
