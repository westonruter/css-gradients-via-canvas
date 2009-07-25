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

if(!window.console){
	console = {
		info:function(x){alert(x)}
	}
}

var cssGradientsViaCanvas = {
	hasNativeSupport: null,
	supportsDataURI: null
};

(function(){
//Check to see if CSS Gradients are natively supported
var testGradient = "linear, 0% 0%, 0% 100%, from(#000), to(#fff)";
var div = document.createElement('div');
div.style.cssText = 'background-image:gradient("' + testGradient + '");';
if(div.style.backgroundImage){
	cssGradientsViaCanvas.hasNativeSupport = true;
	return;
}
var prefixes = ['webkit', 'moz', 'o', 'ms'];
for(var i = 0; i < prefixes.length; i++){
	div.style.cssText = 'background-image:-' + prefixes[i] + '-gradient(' + testGradient + ');';
	if(div.style.backgroundImage){
		cssGradientsViaCanvas.hasNativeSupport = true;
		return;
	}
}
cssGradientsViaCanvas.hasNativeSupport = false;

//Detect support for canvas
var canvas = document.createElement('canvas');
if(!canvas.getContext || !canvas.toDataURL){
	if(window.console && console.info)
		console.info('This browser does not support canvas, therefore CSS Gradients via Canvas will not work.');
	return;
}

var domLoaded = false;

//Detect support for data: URI
var testDataURI = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
var img = new Image();
img.onload = img.onerror = function(){
	cssGradientsViaCanvas.supportsDataURI = (this.width == 1 && this.height == 1);
	provideGradientsViaCanvas();
}
img.src = testDataURI;


// Once the page loads: search the stylesheets for instances of CSS gradients,
// and for each create Canvases or attempt to load the cached canvas from the
// server.
var initalized = false;
function provideGradientsViaCanvas(evt){
	if(evt && evt.type == 'DOMContentLoaded')
		domLoaded = true;
	
	// Don't run until the data: URI test above has been executed, or if this
	// is not the result of DOMContentLoaded event, or if function has already
	// been run in its entirety
	if(cssGradientsViaCanvas.supportsDataURI == null || !domLoaded || initalized)
		return;
	initalized = true;
	
	//Abort if data: URIs aren't supported
	if(!cssGradientsViaCanvas.supportsDataURI){
		if(window.console && console.info)
			console.info('This browser does not support data: URIs, therefore CSS Gradients via Canvas will not work.');
		return;
	}

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
		str = str.replace(/\/\*(.|\s)*?\*\//g, ''); //Remove comments
		str = str.replace(/^\s*\*\//, ''); //Remove trailing comment after closing curly brace
		str = str.replace(/\s+/g, ' ').replace(/^ | $/g, ''); //Trim whitespace
		return str;
	}
	
	//Die for loops, die!
	var forEach = Array.forEach || function(object, block, context) {
		for (var i = 0; i < object.length; i++) {
			block.call(context, object[i], i, object);
		}
	};
	
	//Get the best-available querySelectorAll 
	function querySelectorAll(selector){
		if(false&&document.querySelectorAll)
			return document.querySelectorAll(selector);
		else if(window.jQuery)
			return jQuery(selector).get();
		else if(window.Sizzle)
			return Sizzle(selector);
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
	
	forEach(document.styleSheets, function(stylesheet){
		// Only do this for screen media
		var media = stylesheet.media.item ? stylesheet.media.item(i) : stylesheet.media;
		if(media && media != 'screen' && media != 'all')
			return;
		
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
			return;
		
		var ruleMatch, propertyMatch, colorStopMatch;
		while(ruleMatch = reProperty.exec(sheetCssText)){
			var selector = normalizeWhitespace(ruleMatch[1]);
			var propertyValue = normalizeWhitespace(ruleMatch[2]).toLowerCase().replace(/\s*(,|\(\))\s*/g, '$1');
			
			var selectedElements = querySelectorAll(selector);
			if(!selectedElements.length)
				continue;
			
			//Parse all of the gradients out of the property
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
				gradients.unshift(gradient);
				
			} //end while(propertyMatch = reGradient.exec(propertyValue))

			//Iterate over all of the selected elements and apply the gradients to each
			forEach(selectedElements, function(el){
				//(function(){
					el.refreshCssGradient = function(){
						var canvas = document.createElement('canvas');
						var computedStyle = document.defaultView.getComputedStyle(this, null);
						canvas.width  = parseInt(computedStyle.width) + parseInt(computedStyle.paddingLeft) + parseInt(computedStyle.paddingRight);
						canvas.height = parseInt(computedStyle.height) + parseInt(computedStyle.paddingTop) + parseInt(computedStyle.paddingBottom);
						var ctx = canvas.getContext('2d');
						
						//Iterate over the gradients and build them up
						forEach(gradients, function(gradient){
							var canvasGradient;
							
							// Linear gradient
							if(gradient.type == 'linear'){
								canvasGradient = ctx.createLinearGradient(
									parseCoordinate(gradient.x0, canvas.width),
									parseCoordinate(gradient.y0, canvas.height),
									parseCoordinate(gradient.x1, canvas.width),
									parseCoordinate(gradient.y1, canvas.height)
								);
							}
							// Radial gradient
							else /*if(gradient.type == 'radial')*/ {
								canvasGradient = ctx.createRadialGradient(
									parseCoordinate(gradient.x0, canvas.width),
									parseCoordinate(gradient.y0, canvas.height),
									gradient.r0,
									parseCoordinate(gradient.x1, canvas.width),
									parseCoordinate(gradient.y1, canvas.height),
									gradient.r1
								);
							}
							
							//Add each of the color stops to the gradient
							forEach(gradient.colorStops, function(cs){
								canvasGradient.addColorStop(cs.stop, cs.color);
							});
							ctx.fillStyle = canvasGradient;
							ctx.fillRect(0,0,canvas.width,canvas.height);
							
						}); //end forEach(gradients
						
						//Apply the gradient to the selectedElement
						this.style.backgroundImage = "url('" + canvas.toDataURL() + "')";
					};
					el.refreshCssGradient();
				//})();
			}); //end forEach(selectedElements... 
		} //end while(ruleMatch = reProperty.exec(sheetCssText))
	}); //end forEach(document.styleSheets...
	
}
if(document.addEventListener){
	document.addEventListener('DOMContentLoaded', provideGradientsViaCanvas, false);
	window.addEventListener('DOMContentLoaded', provideGradientsViaCanvas, false);
}

})();