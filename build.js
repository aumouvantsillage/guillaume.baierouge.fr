var Metalsmith = require("metalsmith");
var assets = require("metalsmith-assets");
var drafts = require("metalsmith-drafts");
var permalinks = require("metalsmith-permalinks");
var markdown = require("metalsmith-markdown");
var templates = require("metalsmith-templates");
var sass = require("metalsmith-sass");
var tags = require("metalsmith-tags");
var collections = require("metalsmith-collections");
var more = require("metalsmith-more");

Metalsmith(__dirname)
    .metadata({
        siteTitle: "guillaume savaton - au mouvant sillage",
        piwik: {
            siteId: 3,
            url: "http://baierouge.fr/piwik"
        },
        flattr: {
            userId: "senshu",
            url: encodeURIComponent("http://guillaume.baierouge.fr")
        }
    })
    .source("src")
    .destination("build")
    .use(assets({
        source: "assets",
        destination: "assets"
    }))
    .use(sass({
        outputStyle: "compressed",
        outputDir: "css"
    }))
    .use(drafts())
    .use(markdown({
        smartypants: false,
        gfm: true,
        tables: true
    }))
    .use(more())
    .use(permalinks({
		pattern: ":date/:title",
		relative: false
	}))
    .use(tags({
        sortBy: "date",
        reverse: true,
        template: "tag.html"
    }))
    .use(collections({
        posts: {
            sortBy: "date",
            reverse: true
        }
    }))
    .use(templates("nunjucks"))
    .build();

