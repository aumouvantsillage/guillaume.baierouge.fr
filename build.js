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
var date = require('metalsmith-build-date');

Metalsmith(__dirname)
    .metadata({
        site: {
            title: "guillaume savaton - au mouvant sillage",
            url: "http://guillaume.baierouge.fr",
            root: ""
        },
        piwik: {
            siteId: 3,
            url: "http://baierouge.fr/piwik"
        },
        flattr: {
            userId: "senshu"
        },
        github: "https://github.com/senshu/",
        twitter: "https://twitter.com/senshua",
        linkedIn: "http://fr.linkedin.com/in/gsavaton/",
        googlePlus: "https://plus.google.com/115225184510134342799/posts"
    })
    .use(date())
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
    .use(assets({
        source: "assets",
        destination: "assets"
    }))
    .build();
