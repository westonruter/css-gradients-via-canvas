<h1>CSS Gradients via Canvas</h1>

<p>In <del>a current project</del> <ins>an old project when I worked</ins> at <a href="http://shepherdinteractive.com/">Shepherd Interactive</a>, certain page elements were designed with background <a href="http://en.wikipedia.org/wiki/Image_gradient" title="Image gradient @ Wikipedia">gradients</a>. Given the desire to <a href="http://developer.yahoo.com/performance/rules.html#num_http" title="Minimize HTTP Requests @ Best Practices for Speeding Up Your Web Site">minimize</a> the need for externally-loaded background images wherever possible, I thought this would be a great opportunity to play around with WebKit's proposed <a href="http://webkit.org/blog/175/introducing-css-gradients/" title="Introducing CSS Gradients">CSS Gradients</a>, which are natively supported by Safari, Chrome, and other WebKit-based browsers. In being a WebKit proposal, however, CSS Gradients are not (yet) natively supported in other rendering engines as used by Firefox, Opera, and Internet Explorer.</p>

<p><dfn>CSS Gradients via Canvas</dfn> provides a subset of WebKit's CSS Gradients proposal for browsers that implement the HTML5 <a href="http://www.whatwg.org/specs/web-apps/current-work/multipage/the-canvas-element.html" title="The canvas element @ HTML5"><code>canvas</code></a> element. To use, just include <a href="https://github.com/westonruter/css-gradients-via-canvas/blob/master/css-gradients-via-canvas.js">css-gradients-via-canvas.js</a> (12KB) anywhere on the page. Unlike WebKit, this implementation does not currently allow gradients to be used for border images, list bullets, or generated content. The script employs <a href="https://developer.mozilla.org/En/DOM/Document.querySelectorAll"><code>document.querySelectorAll()</code></a>—it has no external dependencies if this function is implemented; otherwise, it looks for the presence of jQuery, Prototype, or Sizzle to provide selector-querying functionality.</p>

<p id="browser-support">The implementation works in Firefox 2/3+ and Opera 9.64 (at least). Safari and Chrome have native support for CSS Gradients since they use WebKit, as already mentioned. Beginning with version 3.6, CSS Gradients are also <a href="https://developer.mozilla.org/en/CSS/Gradients" title="CSS Gradients @ Mozilla Developer Center">natively supported</a> by Firefox and this implementation will defer in such case; note that you will need to specify two separate <code>background</code> CSS properties, one with <code>-webkit-gradient</code> and another with <code>-moz-linear/radial-gradient</code> which has a <em>different syntax</em>). This implementation does <em>not</em> work in Internet Explorer since IE does not support Canvas, although IE8 does support the <code>data:</code> URI scheme, which is a prerequisite (see <a href="http://weston.ruter.net/2009/05/07/detecting-support-for-data-uris/" title="Detecting Support for data: URIs">support detection method</a>). <del datetime="2010-03-09">When/if Gears's <a href="http://code.google.com/apis/gears/api_canvas.html">Canvas API</a> fully implements the HTML5 canvas specification, then this implementation should be tweakable to work in IE8. In the mean time,</del> rudimentary gradients may be achieved in IE by means of its non-standard <a href="http://msdn.microsoft.com/en-us/library/ms532997%28VS.85%29.aspx">gradient filter</a>.</p>

<p>CSS Gradients via Canvas works by parsing all stylesheets upon page load (<code>DOMContentLoaded</code>), and searches for all instances of CSS gradients being used as <em>background images</em>. The source code for the external stylesheets is loaded via <code>XMLHttpRequest</code>—ensure that they are cached by serving them with a <a href="http://developer.yahoo.com/performance/rules.html#expires">far-future Expires</a> header to avoid extra HTTP traffic. The CSS selector associated with the gradient background image property is used to query all elements on the page; for each of the selected elements, a canvas is created of the same size as the element's dimensions, and the specified gradients are drawn onto that canvas. Thereafter, the gradient image is retrieved via <code>canvas.toDataURL()</code> and this data is supplied as the <code>background-image</code> for the element.</p>

<p id="notes">A few notes regarding interactivity with this implementation: CSS gradients will not be applied to elements dynamically added after <code>DOMContentLoaded</code>. Additionally, each element that has a CSS gradient applied to it gets assigned a method called <code>refreshCSSGradient()</code>; at any time, this method may be invoked to redraw the gradient on a given element. This is especially useful (and necessary) when an element's size dynamically changes, for example as the result of some user interaction. Likewise, it is important to note that it will not work to rely on event handlers to invoke <code>refreshCSSGradient()</code> on elements whose style is changed by CSS rules with pseudo-selectors like <code>:hover</code> and <code>:active</code>; this is because event handlers are fired before the rule's style changes are applied to the element. Toggling an element's class name by scripting is how you can assure that its style will be changed before calling <code>refreshCSSGradient()</code>.</p>

<p><strong>See <a href="http://westonruter.github.com/css-gradients-via-canvas/example.html">examples</a>.</strong></p>

<h3 id="changelog">Changelog</h3>
<dl>
    <dt><time>2010-04-29</time></dt>
    <dd>Updated license to be GPL/MIT dual license instead of just GPL.</dd>
    
    <dt>1.3 (<time>2010-03-09</time>): </dt>
    <dd>Detecting native support in Firefox 3.6; it had only been detecting support for 3.6 alpha, which
    had significantly different syntax. I ported the linear gradient examples over to use the new native Firefox
    syntax, but am still working on the radial gradients; the syntax has changed a lot!</dd>
    
    <dt>1.2 (<time>2009-09-30</time>): </dt>
    <dd>Phong Nguyen raised an <a href="http://weston.ruter.net/projects/css-gradients-via-canvas/#comment-9539"
    title="This is pretty nice – except for one major issue I’ve seen. I’m
    using the jQuery UI library and it includes a fairly large CSS file
    (nearly 1700 lines!) that causes the forEach(document.styleSheets … )
    loop to take a good long while to finish. This blocks the user from doing
    anything to the page – in my case, for 2-3 seconds. That’s pretty
    annoying for any user to have to deal with. Is there some way to speed up
    that core loop? (Failing that, I could try and detect if I’m loading
    certain large files and ignore them).">excellent point</a>
    in that stylesheets which don't contain any CSS Gradients should be ignored in order
    to improve performance (in his case, for example, the jQuery UI
    stylesheets are large and don't need to be parsed).
    Now you can add <code>class="no-css-gradients"</code> to any
    <code>style</code> or <code>link</code> element and that will prevent
    this script from looking for CSS Gradients to apply with canvas.</dd>
    
    <dt>1.1 (<time>2009-08-12</time>): </dt>
    <dd>Now if <code>cssGradientsViaCanvas.useCache</code> is set to
    <code>true</code>, the CSS rules containing gradients are cached in
    <code>sessionStorage</code> instead of having to be re-parsed out of
    the stylesheets each time a page loads. For this to work, there
    must be implementations of <code>JSON.stringify()</code> and
    <code>JSON.parse()</code> available (e.g. <a
    href="http://www.json.org/json2.js">json2.js</a>).</dd>
    
    <dd>Ability to use
    <code>data:</code> URIs for images is not explicitly detected since
    testing for the presence of <code>canvas.toDataURI()</code> is
    sufficient.</dd>
    
    
    <dt>1.0.3 (<time>2009-08-10</time>): </dt>
    <dd>Detecting support for native support for CSS Gradients in Firefox 3.6</dd>
    
    <dt>1.0.2 (<time>2009-08-05</time>): </dt>
    <dd>Now requiring that <code>gradient(…)</code> only be used with the
    <code>background-image</code> property instead of with the
    <code>background</code> shorthand properties since the
    additional <code>background-*</code> properties are not parsed out.</dd>
</dl>

<p><em>(Since I started redirecting from my blog to GitHub, I've archived the <a href="http://westonruter.github.com/css-gradients-via-canvas/wordpress-comment-archive.html">old comments</a> I had received there.)</em></p>
