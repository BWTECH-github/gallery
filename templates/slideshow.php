<div id="slideshow">
	<div class="icon-loading-dark"></div>
	<input type="button" class="svg next icon-view-next"/>
	<input type="button" class="svg play icon-view-play"/>
	<input type="button" class="svg pause icon-view-pause hidden"/>
	<input type="button" class="svg previous icon-view-previous"/>
	<input type="button" class="svg exit icon-view-close"/>
	<div class="notification"></div>
	<div class="menu">
		<input type="button"
			   class="menuItem svg downloadImage icon-view-download hidden"/>
		<input type="button"
			   class="menuItem svg changeBackground icon-view-toggle-background hidden"/>
		<input type="button"
			   class="menuItem svg deleteImage icon-view-delete hidden">
			   <input id="rot" type="button"
			   class="menuItem svg rotationCup icon-rotate hidden">
	</div>
	<?php /* Kein self-closing <div/>: jQuery >= 3.5 expandiert das nicht mehr,
	         der Browser parst es als offenes Tag und .bigshotContainer wuerde
	         Kind des versteckten .progress-Elements (schwarze Slideshow). */ ?>
	<div class="progress icon-view-pause"></div>
	<div class="name">
		<div class="title"></div>
	</div>
	<div class="bigshotContainer"></div>
</div>

