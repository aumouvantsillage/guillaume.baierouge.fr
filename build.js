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
var katex = require("metalsmith-katex");

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
        paypal: {
            key: "-----BEGIN PKCS7-----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-----END PKCS7-----"
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
    .use(katex())
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
