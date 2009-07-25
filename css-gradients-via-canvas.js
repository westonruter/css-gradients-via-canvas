/* 
 * CSS Gradients via Canvas
 *  by Weston Ruter, Shepherd Interactive <http://www.shepherd-interactive.com/>
 * 
 * Some comments include excerpts from "Introducing CSS Gradients" <http://webkit.org/blog/175/introducing-css-gradients/>
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 * 
 * $Id$
 */

var cssGradientsViaCanvas = {
	hasNativeSupport: null,
	supportsDataURI: null,
	gradientCacheScript: './gradient-cache.php' //Ensure that whatever this is only allows POST when on development machine
};

(function(){

//Check to see if CSS Gradients are natively supported
var testGradient = "linear, 0% 0%, 0% 100%, from(#000), to(#fff)";
var div = document.createElement('div');
div.style.cssText = 'background:gradient("' + testGradient + '");';
if(div.style.cssText.indexOf('gradient') != -1){
	cssGradientsViaCanvas.hasNativeSupport = true;
	return;
}
var prefixes = ['webkit', 'moz', 'o', 'ms'];
for(var i = 0; i < prefixes.length; i++){
	div.style.cssText = 'background:-' + prefixes[i] + '-gradient(' + testGradient + ');';
	if(div.style.cssText.indexOf('gradient') != -1){
		cssGradientsViaCanvas.hasNativeSupport = true;
		return;
	}
}
cssGradientsViaCanvas.hasNativeSupport = false;


//Detect support for data: URI
var testDataURI = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
var img = new Image();
img.onload = img.onerror = function(){
	cssGradientsViaCanvas.supportsDataURI = (this.width == 1 && this.height == 1);
}
img.src = testDataURI;


// Once the page loads: search the stylesheets for instances of CSS gradients,
// and for each create Canvases or attempt to load the cached canvas from the
// server.
var initalized = false;
function provideGradientsViaCanvas(){
	if(initalized)
		return;
	initalized = true;
	
	//Get implementation of XMLHttpRequest, from: http://en.wikipedia.org/wiki/XMLHttpRequest
	if (typeof(XMLHttpRequest) == "undefined") {
		XMLHttpRequest = function() {
			try { return new ActiveXObject("Msxml2.XMLHTTP.6.0"); }
				catch(e) {}
			try { return new ActiveXObject("Msxml2.XMLHTTP.3.0"); }
				catch(e) {}
			try { return new ActiveXObject("Msxml2.XMLHTTP"); }
				catch(e) {}
			try { return new ActiveXObject("Microsoft.XMLHTTP"); }
				catch(e) {}
			throw new Error("This browser does not support XMLHttpRequest.");
		};
	}
	
	//Remove all comments and whitespace from a string
	function normalizeWhitespace(str){
		str = str.replace(/\/\*(.|\s)*?\*\//, ''); //Remove comments
		str = str.replace(/\s+/g, ' ').replace(/^ | $/g, ''); //Trim whitespace
		return str;
	}
	
	//Get the best-available querySelectorAll 
	function querySelectorAll(selector){
		if(document.querySelectorAll)
			return document.querySelectorAll(selector);
		else if(window.jQuery)
			return jQuery(selector).get();
		else if(window.Prototype && window.$$)
			return $$(selector);
		else
			throw Error("Neither document.querySelectorAll, jQuery, nor Prototype are available.");
	};
	
	//"A point is a pair of space-separated values. The syntax supports numbers,
	//percentages or the keywords top, bottom, left and right for point values."
	//This keywords and percentages into pixel equivalents
	function parseCoordinate(value, max){
		//Convert keywords
		switch(value){
			case 'top':
			case 'left':
				return 0;
			case 'bottom':
			case 'right':
				return max;
			case 'center':
				return max/2;
		}
		
		//Convert percentage
		if(value.indexOf('%') != -1)
			value = parseFloat(value.substr(0, value.length-1))/100*max;
		//Convert bare number (a pixel value)
		else 
			value = parseFloat(value);
		
		if(isNaN(value))
			throw Error("Unable to parse coordinate: " + value);
		
		return value;
	}
	
	
	//Parse the stylesheets for CSS Gradients
	var reProperty = /([^}]+){[^}]*?((?=(?:-\w+-)?gradient)[^;]+)/g;
	var reGradient = /gradient\((radial|linear),(\S+) ([^,]+)(?:,(\d+\.?\d*))?,(\S+) ([^,]+)(?:,(\d+\.?\d*))?,(.+?)\)(?=\s*$|\s*,\s*(?:-\w+-)?gradient)/g; //don't look at this regular expression :-)
	var reColorStop = /(?:(from|to)\((\w+\(.+?\)|.+?)\)|color-stop\((\d*\.?\d*)(%)?,(\w+\(.+?\)|.+?)\))(?=,|$)/g;
	for(var i = 0; i < document.styleSheets.length; i++){
		var stylesheet = document.styleSheets[i];
		
		// Only do this for screen media
		var media = stylesheet.media.item ? stylesheet.media.item(i) : stylesheet.media;
		if(media && media != 'screen' && media != 'all')
			continue;
		
		// We actually have to load the stylesheet in via XHR (inspired by
		// moofx); but this should be OK performance-wise if things are cached
		// properly
		var el = stylesheet[stylesheet.ownerNode ? 'ownerNode' : 'owningElement'];
		var sheetCssText;
		switch(el.nodeName.toLowerCase()){
			case 'style':
				sheetCssText = el.innerHTML; //does not work with inline styles because IE doesn't allow you to get the text content of a STYLE element
				break;
			case 'link':
				var xhr = new XMLHttpRequest();
				xhr.open('GET', el.href, false/*synchronous*/);
				xhr.send(null);
				sheetCssText = xhr.responseText;
				break;
		}
		if(!sheetCssText)
			continue;
		
		var ruleMatch, propertyMatch, colorStopMatch;
		while(ruleMatch = reProperty.exec(sheetCssText)){
			var selector = normalizeWhitespace(ruleMatch[1]);
			var propertyValue = normalizeWhitespace(ruleMatch[2]).toLowerCase().replace(/\s*(,|\(\))\s*/g, '$1');
			
			var selectedElements = querySelectorAll(selector);
			if(!selectedElements.length)
				continue;
			
			//Canvas is not supported, so attempt to get the gradient from the server
			if(!document.createElement('canvas').getContext){
				throw Error("ISSUE! We need to store not only the selector but also the element index that the generated data URI applies to");
				
				
				if(cssGradientsViaCanvas.supportsDataURI){
					
					//Use the 
					if(window.sessionStorage && sessionStorage.cssGradientsViaCanvas && sessionStorage.cssGradientsViaCanvas[selector]){
						
					}
					else {
						var xhr = new XMLHttpRequest();
						var url = cssGradientsViaCanvas.gradientCacheScript + "?selector="+encodeURIComponent(selector);
						if(cssGradientsViaCanvas.supportsDataURI)
							url += "&data-uri=on";
							
						xhr.open('GET', url);
						xhr.onreadystatechange = function(){
							if(xhr.readyState == 4 && xhr.status == 200){
								for(var i = 0; i < selectedElements.length; i++){
									if(window.sessionStorage){
										if(!sessionStorage.cssGradientsViaCanvas)
											sessionStorage.cssGradientsViaCanvas = {}
										sessionStorage.cssGradientsViaCanvas[selector] = xhr.responseText;
									}
									selectedElements[i].style.backgroundImage = 'url("' + xhr.responseText + '")';
								}
							}
						};
						xhr.send(null);
					}
					
					//We should store the result in sessionStorage to avoid recurrant lookups
					
				}
				//Link to the gradient images directly
				else {
					for(var i = 0; i < selectedElements.length; i++){
						selectedElements[i].style.backgroundImage = 'url("' + cssGradientsViaCanvas.gradientCacheScript + "?selector="+encodeURIComponent(selector)  + '")';
					}
				}
			}
			//Parse all of the gradients out of the property
			else {
				var gradients = [];
				
				while(propertyMatch = reGradient.exec(propertyValue)){
					//gradient(linear, <point>, <point> [, <stop>]*)
					//gradient(radial, <point> , <radius>, <point>, <radius> [, <stop>]*)
					
					var gradient = {
						type: propertyMatch[1],
						x0: propertyMatch[2],
						y0: propertyMatch[3],
						r0: parseFloat(propertyMatch[4]),
						x1: propertyMatch[5],
						y1: propertyMatch[6],
						r1: parseFloat(propertyMatch[7]),
						colorStops: []
					}
					
					//If x0 = x1 and y0 = y1, then the linear gradient must paint nothing.
					if(gradient.type == 'linear' && gradient.x0 == gradient.x2 && gradient.y0 == gradient.y1)
						continue;
					
					// A stop is a function, color-stop, that takes two arguments,
					// the stop value (either a percentage or a number between 0 and
					// 1.0), and a color (any valid CSS color). In addition the
					// shorthand functions from and to are supported. These
					// functions only require a color argument and are equivalent to
					// color-stop(0, …) and color-stop(1.0, …) respectively.
					while(colorStopMatch = reColorStop.exec(propertyMatch[8])){
						var stop;
						var color;
						if(colorStopMatch[1]){
							stop = colorStopMatch[1] == 'from' ? 0.0 : 1.0;
							color = colorStopMatch[2];
						}
						else {
							stop = parseFloat(colorStopMatch[3]);
							if(colorStopMatch[4]) //percentage
								stop /= 100;
							color = colorStopMatch[5];
						}
						gradient.colorStops.push({stop:stop, color:color});
					}
					
					if(gradient.type == 'radial'){
						//if(window.console && console.warn)
							//console.warn('radial CSS gradients are not yet supported: ' + propertyMatch[0]);
					}
					
					//if(type == 'radial')
					//	console.info(
					//		[x0,
					//		y0,
					//		r0,
					//		x1,
					//		y1,
					//		r1, colorStops]
					//	);
					gradients.push(gradient);
					
				} //end while(propertyMatch = reGradient.exec(propertyValue))
				
				console.info(gradients)

				//Iterate over all of the selected elements and apply the gradients to each
				for(var j = 0; j < selectedElements.length; j++){
					var el = selectedElements[j];
					var canvas = document.createElement('canvas');
					
					//Browser that supports canvas
					var computedStyle = document.defaultView.getComputedStyle(el,null);
					canvas.width  = parseInt(computedStyle.width) + parseInt(computedStyle.paddingLeft) + parseInt(computedStyle.paddingRight);
					canvas.height = parseInt(computedStyle.height) + parseInt(computedStyle.paddingTop) + parseInt(computedStyle.paddingBottom);
					var ctx = canvas.getContext('2d');
					
					//Iterate over the gradients and build them up
					for(var k = 0; k < gradients.length; k++){
						// Linear gradient
						if(gradients[k].type == 'linear'){
							var linearGradient = ctx.createLinearGradient(
												parseCoordinate(gradients[k].x0, canvas.width),
												parseCoordinate(gradients[k].y0, canvas.height),
												parseCoordinate(gradients[k].x1, canvas.width),
												parseCoordinate(gradients[k].y1, canvas.height)
											);
							
							//Add each of the color stops to the gradient
							for(var l = 0; l < gradients[k].colorStops.length; l++)
								linearGradient.addColorStop(gradients[k].colorStops[l].stop, gradients[k].colorStops[l].color);
							
							ctx.fillStyle = linearGradient;
							ctx.fillRect(0,0,canvas.width,canvas.height);
						}
						// Radial gradient
						else if(gradients[k].type == 'radial'){
							
						}
					}
					
					var dataURI = canvas.toDataURL();
					el.style.backgroundImage = "url('" + dataURI + "')";
					
					//Send the gradient to be cached on the server
					if(cssGradientsViaCanvas.gradientCacheScript){
						console.info('SEND: ' + selector)
						var xhr = new XMLHttpRequest();
						xhr.open('POST', cssGradientsViaCanvas.gradientCacheScript);
						xhr.setRequestHeader('content-type', 'application/x-www-form-urlencoded');
						xhr.send([
							'selector=' + encodeURIComponent(selector),
							'gradient=' + encodeURIComponent(dataURI)
						].join('&'));
					}

				} //end for each selectedElements
				
				
			} //end if canvas supported
			
			
			
			
		}
		
	}
	
	
	if(false){
	
		
		// Note: For IE we can enable a debug mode with a server-side script that
		// when developing with Firefox, it can automatically send back to the
		// server the data: URI image data, and then the server can convert that
		// into a regular PNG for inclusion; and then if Canvas isn't supported by
		// this browser, that PNG sent to the server can be set as the
		// backgroundImage instead of the actual data: URL.
		
		var target = document.querySelector('.linear');
		var computedStyle = document.defaultView.getComputedStyle(target,null);
		if(computedStyle.getPropertyValue("background-image").indexOf('gradient(') == -1){
			var x1 = 0.0;
			var y1 = 0.25;
			var x2 = 0.75;
			var y2 = 1.0;
			
			var canvas = document.createElement('canvas');
			//canvas.width  = target.offsetWidth; //parseInt(computedStyle.width); //0% 0%, 0% 100%
			//canvas.height = target.offsetHeight; //parseInt(computedStyle.height); //0% 0%, 0% 100%
			canvas.width  = parseInt(computedStyle.width) + parseInt(computedStyle.paddingLeft) + parseInt(computedStyle.paddingRight); //0% 0%, 0% 100%
			canvas.height = parseInt(computedStyle.height) + parseInt(computedStyle.paddingTop) + parseInt(computedStyle.paddingBottom); //0% 0%, 0% 100%
			
			var ctx = canvas.getContext('2d');
			var gradient = ctx.createLinearGradient(x1*canvas.width,y1*canvas.height, x2*canvas.width, y2*canvas.height);
			gradient.addColorStop(0.0,'red');
			gradient.addColorStop(0.2,'orange');
			gradient.addColorStop(0.4,'yellow');
			gradient.addColorStop(0.6,'green');
			gradient.addColorStop(0.8,'blue');
			gradient.addColorStop(1.0,'purple');
			ctx.fillStyle = gradient;
			ctx.fillRect(0,0,canvas.width,canvas.height);
			target.style.backgroundImage = "url('" + canvas.toDataURL() + "')";
			if(x1 == x2)
				target.style.backgroundRepeat = 'repeat-x';
			else if(y1 == y2)
				target.style.backgroundRepeat = 'repeat-y';
			
			//For IE8, get the data: URI not the actual binary representation.
		}
	}
	
}
if(document.addEventListener){
	window.addEventListener('load', provideGradientsViaCanvas, false);
	document.addEventListener('load', provideGradientsViaCanvas, false);
	document.addEventListener('DOMContentLoaded', provideGradientsViaCanvas, false);
}
else if(window.attachEvent)
	window.attachEvent('onload', provideGradientsViaCanvas);



})();