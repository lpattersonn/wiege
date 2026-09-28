/**
 * Runs during HTML parsing, as the first child of the reader's <article>
 * (DESIGN §11.20, Next "preventing flash before hydration"): copies the
 * student's grade band and reading settings from the on-device store onto the
 * article before first paint, so the right level and text size render with no
 * flash and no layout shift. Values are checked against the allowed sets.
 */
export const READER_ID = 'reader';

export const READER_PREFS_SCRIPT = `(function(){try{var a=document.getElementById(${JSON.stringify(READER_ID)}),s=JSON.parse(localStorage.getItem("wiege:v1")||"null"),p=s&&s.prefs;if(!a||!p)return;var o={gradeBand:["data-level","7-8","9-10"],readingFont:["data-reading-font","book","clear"],textSize:["data-text-size","s","m","l","xl"],lineSpacing:["data-line-spacing","normal","relaxed","loose"]};for(var k in o){var v=p[k];if(o[k].indexOf(v)>0)a.setAttribute(o[k][0],v)}}catch(e){}})()`;
