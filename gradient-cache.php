<?php
/* 
 * Cache for CSS Gradients via Canvas:
 *  When Canvas is successfully used to implement 
 *  by Weston Ruter, Shepherd Interactive <http://www.shepherd-interactive.com/>
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

define('DEVELOPMENT_HTTP_HOST', 'si-googlecode'); //change this to reflect your development environemnt




/**
 * Function that sends errors back to the client
 */
function return_error($message, $status = 400){
	header("Content-Type: text/plain", true, $status);
	print $message;
	exit(1);
}

header('content-type:text/plain');

//Obtain the selector that specifies the CSS gradient
if(empty($_REQUEST['selector']))
	return_error("Error: Must provide CSS 'selector' parameter which is associated with the gradient image.");
if(get_magic_quotes_gpc())
	$_REQUEST['selector'] = stripslashes($_REQUEST['selector']);

//Get SQLite database which stores the gradients
$db = @sqlite_open("gradient-cache.sqlite", 0666, $error_message);
if(!$db)
	return_error("Unable to open sqllite DB: $error_message");
$createTableSQL = "CREATE TABLE /*IF NOT EXISTS*/ gradients (
	selector TEXT NOT NULL PRIMARY KEY,
	mimeType TEXT NOT NULL,
	base64   TEXT NOT NULL
)";
@sqlite_exec($db, $createTableSQL, $error_message); #"IF NOT EXISTS" not supported in some versions of SQLite, so ignore if there is an error
#if(!@sqlite_exec($db, $createTableSQL, $error_message))
#	return_error("Unable to create table: $error_message");

//Store a new gradient in the 
if($_SERVER['REQUEST_METHOD'] == 'POST'){ #|| isset($_REQUEST['gradient'])
	//Prevent POST from working on environment other than development
	if(DEVELOPMENT_HTTP_HOST != $_SERVER['HTTP_HOST'])
		return_error("Error: Storing new gradients is only allowed on development machine.");
	
	//Get and parse the gradient data
	if(empty($_REQUEST['gradient']))
		return_error("Error: When POSTing new gradient to server, must provide the image data: URL in the 'gradient' parameter.");
	if(get_magic_quotes_gpc())
		$_REQUEST['gradient'] = stripslashes($_REQUEST['gradient']);
	if(!preg_match('{^data:\s*(.+?)\s*;\s*base64,(.+$)}i', $_REQUEST['gradient'], $matches))
		return_error("Error: Unable to parse 'gradient' pattern as a valid data: URI");
	
	//Store the gradient in the SQLite cache
	$insertSQL = 'REPLACE INTO gradients (selector, mimeType, base64) VALUES ("' . join('","', array(
		sqlite_escape_string($_REQUEST['selector']),
		sqlite_escape_string($matches[1]),
		sqlite_escape_string($matches[2])
	)) . '")';
	if(!@sqlite_exec($db, $insertSQL, $error_message))
		return_error("Unable to insert gradient: $error_message\n\n$insertSQL");
	
	print "Gradient cache successful:\n\n$insertSQL";
}
//Return the base64 decoded image with proper MIME type, or return 404 if not cached
else {
	$selectSQL = 'SELECT * FROM gradients WHERE selector = "' . sqlite_escape_string($_REQUEST['selector']) . '"';
	$result = @sqlite_array_query($db, $selectSQL, SQLITE_ASSOC);
	if(!$result || empty($result))
		return_error("Gradient for selector '" . $_REQUEST['selector'] . "' is not cached.\n\n$selectSQL", 404);
	$result = $result[0];
	
	if(isset($_REQUEST['data-uri'])){
		print "data:$result[mimeType];base64,$result[base64]";
	}
	else {
		header('Content-Type: ' . $result['mimeType']);
		print base64_decode($result['base64']);
	}
}
