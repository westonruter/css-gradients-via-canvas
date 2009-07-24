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
		str = str.replace(/\s+/g, ' ').replace(/^ | $/g, ''); //Normalize whitespace
		return str;
	}
	
	//Get the best-available querySelectorAll 
	var querySelectorAll = function(selector){
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
			value = parseFloat(value.substr(0, value.length-1))/100;
		//Convert bare number (a pixel value)
		else 
			value = parseFloat(value);
		
		if(isNaN(value))
			throw Error("Unable to parse coordinate: " + value);
		
		return value;
	}
	
	
	//Parse the stylesheets for CSS Gradients
	var reProperty = /([^}]+){[^}]*?((?=(?:-\w+-)?gradient)[^;]+)/g;
	//var reGradient = /gradient\s*\(\s*(radial|linear)\s*,\s*([^,]+)\s+([^,]+)(?:\s*,\s*([^,]+))?\s*,\s*([^,]+)\s+([^,])(?:\s*,\s*([^,]+))?\s*(.+?)\)(?=\s*$|\s*,\s*(?:-\w+-)?gradient)/g; //don't look at this regular expression :-)
	var reGradient = /gradient\((radial|linear),(\S+) ([^,]+)(?:,(\d+\.?\d*))?,(\S+) ([^,]+)(?:,(\d+\.?\d*))?,(.+?)\)(?=\s*$|\s*,\s*(?:-\w+-)?gradient)/g; //don't look at this regular expression :-)
	var reColorStop = /(?:(from|to)\((\w+\(.+?\)|.+?)\)|color-stop\((\d+\.?\d*)(%)?,(\w+\(.+?\)|.+?)\))(?=,|$)/g;
	for(var i = 0; i < document.styleSheets.length; i++){
		var stylesheet = document.styleSheets[i];
		
		// Only do this for screen media
		//var media = stylesheet.media.item ? stylesheet.media.item(i) : stylesheet.media;
		//if(media && media != 'screen' && media != 'all')
		//	break;
		
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
			
			while(propertyMatch = reGradient.exec(propertyValue)){
				//gradient(linear, <point>, <point> [, <stop>]*)
				//gradient(radial, <point> , <radius>, <point>, <radius> [, <stop>]*)
				var type = propertyMatch[1], //The type of a gradient is either linear or radial.
				    x0 = propertyMatch[2],
				    y0 = propertyMatch[3],
				    r0 = parseFloat(propertyMatch[4]),
				    x1 = propertyMatch[5],
				    y1 = propertyMatch[6],
				    r1 = parseFloat(propertyMatch[7]),
				    colorStops = [];
				
				//If x0 = x1 and y0 = y1, then the linear gradient must paint nothing.
				if(type == 'linear' && x0 == x2 && y0 == y1)
					break;
				
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
					colorStops.push({stop:stop, color:color});
				}
				
				if(type == 'radial'){
					if(window.console && console.warn)
						console.warn('radial CSS gradients are not yet supported: ' + propertyMatch[0]);
					continue;
				}
				
				
				//Iterate over all of the selected elements and apply the gradients to each
				for(var j = 0; j < selectedElements.length; j++){
					var el = selectedElements[j];
					console.info(el)
				
					console.info(
						[x0,
						y0,
						r0,
						x1,
						y1,
						r1, colorStops]
					)
					var canvas = document.createElement('canvas');
					
					//Browser that supports canvas
					if(canvas.getContext){
						var computedStyle = document.defaultView.getComputedStyle(el,null);
						canvas.width  = parseInt(computedStyle.width) + parseInt(computedStyle.paddingLeft) + parseInt(computedStyle.paddingRight);
						canvas.height = parseInt(computedStyle.height) + parseInt(computedStyle.paddingTop) + parseInt(computedStyle.paddingBottom);
						console.info(canvas.width)
						console.info(canvas.height)
						
						var _x0 = parseCoordinate(x0, canvas.width),
						    _y0 = parseCoordinate(y0, canvas.height),
						    _x1 = parseCoordinate(x1, canvas.width),
						    _y1 = parseCoordinate(y1, canvas.height);
						
						var ctx = canvas.getContext('2d');
						
						console.info([_x0,_y0,_x1,_y1])
						var gradient = ctx.createLinearGradient(_x0,_y0,_x1,_y1);
						for(var k = 0; k < colorStops.length; k++)
							gradient.addColorStop(colorStops[k].stop, colorStops[k].color);
						
						ctx.fillStyle = gradient;
						ctx.fillRect(0,0,canvas.width,canvas.height);
						el.style.backgroundImage = "url('" + canvas.toDataURL() + "')";
						//if(x1 == x2)
						//	target.style.backgroundRepeat = 'repeat-x';
						//else if(y1 == y2)
						//	target.style.backgroundRepeat = 'repeat-y';
					}
				}
				
				

				
			}
			
			
			
			
			
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