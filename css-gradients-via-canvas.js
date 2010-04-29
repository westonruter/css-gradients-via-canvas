/*!
 * CSS Gradients via Canvas v1.3
 *  by Weston Ruter <http://weston.ruter.net/> @westonruter
 *  Homepage: http://weston.ruter.net/projects/css-gradients-via-canvas/
 *  Latest: http://github.com/westonruter/css-gradients-via-canvas
 *  Copyright (c) 2009: Weston Ruter,
 *                      Shepherd Interactive <http://shepherdinteractive.com/>
 *  License: GPL <http://creativecommons.org/licenses/GPL/2.0/> and
 *           MIT <http://creativecommons.org/licenses/MIT/>
 * 
 * Some comments include excerpts from "Introducing CSS Gradients"
 *   <http://webkit.org/blog/175/introducing-css-gradients/>
 */

var cssGradientsViaCanvas = {
	useCache:false, // set to true to utilize sessionStorage to remember the CSS rules containing
	                // gradients, so that they don't have to be parsed out of the stylesheets each time
	hasNativeSupport: null,
	supportsCanvas: null,
	enabled: null,
	//proprietaryPropertyPrefixes: ['webkit', 'moz', 'o', 'ms', 'khtml'],
	oninit: function(){ //user-overridable initialization callback function
		if(this.enabled)
			document.documentElement.className += " css-gradients-via-canvas";
		else if(this.hasNativeSupport)
			document.documentElement.className += " native-css-gradients";
		else
			document.documentElement.className += " no-css-gradients";
	},
	createCanvas: function(){ //in case a non-native implementation is available, author can override this
		return document.createElement('canvas');
	}
};

(function(){
var config = cssGradientsViaCanvas;

//Check to see if CSS Gradients are natively supported
var div = document.createElement('div');
div.style.cssText = [
	"background-image:-webkit-gradient(linear, 0% 0%, 0% 100%, from(red), to(blue));",
	"background-image:-moz-linear-gradient(top left, bottom right, from(red), to(blue));", /*Firefox 3.6 Alpha*/
	"background-image:-moz-linear-gradient(left, red, blue);" /*Firefox 3.6*/
].join('');
if(div.style.backgroundImage){
	config.enabled = false;
	config.hasNativeSupport = true;
	if(config.oninit)
		config.oninit();
	return;
}
config.hasNativeSupport = false;

var domLoaded = false;
	
//Die for loops, die!
var forEach = Array.forEach || function(object, block, context) {
	for (var i = 0; i < object.length; i++) {
		block.call(context, object[i], i, object);
	}
};

//Get the best-available querySelectorAll 
function querySelectorAll(selector){
	if(document.querySelectorAll)
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

/**
 * Apply a set of gradients to a given selector
 */
function applyGradients(selector, gradients){
	var selectedElements = querySelectorAll(selector);
	if(!selectedElements.length)
		return;
	
	//Iterate over all of the selected elements and apply the gradients to each
	forEach(selectedElements, function(el){
		// Provide a function on the selected element for refreshing
		// the CSS gradient. This is also used for the initial paint.
		el.refreshCSSGradient = function(){
			var canvas = config.createCanvas();
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
				
				//Paint the gradient
				ctx.fillStyle = canvasGradient;
				ctx.fillRect(0,0,canvas.width,canvas.height);
				
			}); //end forEach(gradients
			
			//Apply the gradient to the selectedElement
			this.style.backgroundImage = "url('" + canvas.toDataURL() + "')";
		};
		el.refreshCSSGradient();
	}); //end forEach(selectedElements... 
}



// Once the page loads: search the stylesheets for instances of CSS gradients,
// and then apply those gradients to their selected elements.
var initalized = false;
function provideGradientsViaCanvas(evt){
	if(evt && evt.type == 'DOMContentLoaded')
		domLoaded = true;
	
	// Don't run if this is not the result of DOMContentLoaded event, or if function
	// has already been run in its entirety
	if(!domLoaded || initalized)
		return;
	initalized = true;
	
	//Detect support for canvas
	var canvas = config.createCanvas();
	config.supportsCanvas = (canvas.getContext && canvas.toDataURL);
	if(!config.supportsCanvas){
		if(window.console && console.info)
			console.info('This browser does not support canvas, therefore CSS Gradients via Canvas will not work.');
		config.enabled = false;
		if(config.oninit)
			config.oninit();
		return;
	}
	
	/**
	 * Use the CSS Gradients that have been cached from previous runs
	 */
	if(config.useCache && window.sessionStorage && sessionStorage.cssGradientsViaCanvasCache && window.JSON && JSON.parse){
		var cache = JSON.parse(sessionStorage.cssGradientsViaCanvasCache.toString());
		if(cache){
			forEach(cache, function(obj){
				applyGradients(obj.selector, obj.gradients);
			});
			config.enabled = true;
			if(config.oninit)
				config.oninit();
			return;
		}
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
	
	
	//Parse the stylesheets for CSS Gradients
	var reProperty = /([^}]+){[^}]*?([a-z\-]*background-image*)\s*:\s*(-webkit-gradient[^;]+)/g; //([a-z\-]*background[a-z\-]*):
	var reGradient = /gradient\((radial|linear),(\S+) ([^,]+)(?:,(\d+\.?\d*))?,(\S+) ([^,]+)(?:,(\d+\.?\d*))?,(.+?)\)(?=\s*(?:!important\s*)?$|\s*,\s*(?:-\w+-)?gradient)/g; //don't look at this regular expression :-)
	var reColorStop = /(?:(from|to)\((\w+\(.+?\)|.+?)\)|color-stop\((\d*\.?\d*)(%)?,(\w+\(.+?\)|.+?)\))(?=,|$)/g;
	
	var cache = [];
	
	forEach(document.styleSheets, function(stylesheet){
		// Only do this for screen media
		var media = stylesheet.media.item ? stylesheet.media.item(0) : stylesheet.media;
		if(media && media != 'screen' && media != 'all')
			return;
		
		// Ignore stylesheets that have class~=no-css-gradients
		if(stylesheet.ownerNode && stylesheet.ownerNode.className && /(^|\s)no-css-gradients(\s|$)/i.test(stylesheet.ownerNode.className))
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
			var propertyName = ruleMatch[2];
			var propertyValue = normalizeWhitespace(ruleMatch[3]).toLowerCase().replace(/\s*(,|:|\(|\))\s*/g, '$1');
			
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
				// color-stop(0, ...) and color-stop(1.0, ...) respectively.
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
			
			//Push the cache
			cache.push({
				selector:selector,
				gradients:gradients
			});
			
			applyGradients(selector, gradients);
		} //end while(ruleMatch = reProperty.exec(sheetCssText))
	}); //end forEach(document.styleSheets...
	
	//Store the parsed CSS Gradients for faster recall next time a page is loaded
	if(config.useCache && window.sessionStorage && window.JSON && JSON.stringify){
		sessionStorage.cssGradientsViaCanvasCache = JSON.stringify(cache);
	}
	
	//Success
	config.enabled = true;
	if(config.oninit)
		config.oninit();
	
} //end function provideGradientsViaCanvas
if(document.addEventListener)
	document.addEventListener('DOMContentLoaded', provideGradientsViaCanvas, false);
else if(window.attachEvent){
	window.attachEvent('onload', function(){
		provideGradientsViaCanvas({type:'DOMContentLoaded'});
	});
}

})();