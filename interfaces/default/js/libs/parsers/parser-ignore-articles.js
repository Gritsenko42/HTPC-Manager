// https://cdnjs.cloudflare.com/ajax/libs/jquery.tablesorter/2.31.3/js/parsers/parser-ignore-articles.min.js
!function(e){"function"==typeof define&&define.amd?define(["jquery"],e):"object"==typeof module&&"object"==typeof module.exports?module.exports=e(require("jquery")):e(jQuery)}(function(e){return function(e){"use strict";var r=e.tablesorter;r.ignoreArticles={en:"the, a, an",de:"der, die, das, des, dem, den, ein, eine, einer, eines, einem, einen",nl:"de, het, de, een",es:"el, la, lo, los, las, un, una, unos, unas",pt:"o, a, os, as, um, uma, uns, umas",fr:"le, la, l'_, les, un, une, des",it:"il, lo, la, l'_, i, gli, le, un', uno, una, un",hu:"a, az, egy"},r.addParser({id:"ignoreArticles",is:function(){return!1},format:function(n,s,t,a){var i,o,l,d=s.config,u=n||"";return d.headers&&d.headers[a]&&d.headers[a].ignoreArticlesRegex||(d.headers||(d.headers={}),d.headers[a]||(d.headers[a]={}),l=r.getData(d.$headers.eq(a),r.getColumnData(s,d.headers,a),"ignoreArticles"),i=(r.ignoreArticles[l]||"the, a, an")+"",d.headers[a].ignoreArticlesRegex=new RegExp("^("+e.trim(i.split(/\s*\,\s*/).join("\\s|")+"\\s").replace("_\\s","")+")","i"),o=r.getData(d.$headers.eq(a),r.getColumnData(s,d.headers,a),"ignoreArticlesExcept"),d.headers[a].ignoreArticlesRegex2=""!==o?new RegExp("^("+o.replace(/\s/g,"\\s")+")","i"):""),!(i=d.headers[a].ignoreArticlesRegex).test(u)||(o=d.headers[a].ignoreArticlesRegex2)&&o.test(u)?u:u.replace(i,"")},type:"text"})}(e),e});
