"use strict";

const Metalsmith  = require("metalsmith");
const assets      = require("metalsmith-assets");
const drafts      = require("metalsmith-drafts");
const permalinks  = require("metalsmith-permalinks");
const markdown    = require("metalsmith-markdownit");
const templates   = require("metalsmith-templates");
const sass        = require("metalsmith-sass");
const tags        = require("metalsmith-tags");
const collections = require("metalsmith-collections");
const more        = require("metalsmith-more");
const date        = require('metalsmith-build-date');
const sections    = require("./plugins/metalsmith-sections");
const highlight   = require("highlight.js");
const katex       = require("katex");
const nunjucks    = require("nunjucks");
const container   = require("markdown-it-container");
const anchor      = require("markdown-it-anchor");
const math        = require("markdown-it-math");

/*
 * Configure nunjucks.
 * Disable file watching in nunjucks to prevent an exception.
 * Disable autoescaping.
 * Add a filter for relative links.
 */

nunjucks.configure({watch: false, autoescape: false}).addFilter("relative", function (childName, parentName) {
    const path = require("path");
    return path.relative(path.dirname(parentName), childName);
});

/*
 * Syntax highlighter configuration for Markdown code blocks.
 */

function highlighter(code, lang) {
    return lang ? highlight.highlight(lang, code).value : code;
}

/*
 * Configure Markdown processor.
 */

const md = markdown("commonmark", {
    highlight: highlighter,
    typographer: true,
    quotes: ['«\xA0', '\xA0»', '‹\xA0', '\xA0›']
});

md.parser
    .use(container, "info")
    .use(container, "warning")
    .use(anchor)
    .use(math, {
        inlineRenderer(str) {
            return katex.renderToString(str);
        },
        blockRenderer(str) {
            return katex.renderToString(str, {displayMode: true});
        }
    })
    .enable("table")
    .enable("smartquotes");

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
    .use(md)
    .use(sections({
        level: 2,
        nested: false
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
    .use(assets({
        source: "bower_components",
        destination: "bower_components"
    }))
    .build(function (err) {
        if (err) throw err;
    });
