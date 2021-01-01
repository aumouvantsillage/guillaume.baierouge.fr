"use strict";

const Metalsmith  = require("metalsmith");
const branch      = require("metalsmith-branch");
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
const katex       = require("katex");
const nunjucks    = require("nunjucks");
const container   = require("markdown-it-container");
const anchor      = require("markdown-it-anchor");
const math        = require("markdown-it-math");
const prism       = require("markdown-it-prism");

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
 * Configure Markdown processor.
 */

const md = markdown("commonmark", {
    typographer: true,
    quotes: ['«\xA0', '\xA0»', '‹\xA0', '\xA0›']
});

md.parser
    .use(container, "info")
    .use(container, "warning")
    .use(anchor)
    .use(prism)
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
        github: "https://github.com/aumouvantsillage/",
        twitter: "https://twitter.com/umouvantsillage",
        mastodon: "https://mamot.fr/@aumouvantsillage",
        linkedIn: "http://fr.linkedin.com/in/gsavaton/",
        buymeacoffee: "https://www.buymeacoffee.com/THtbNvnqE"
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
    .use(branch()
            .filter((name, file) => file.subtitle)
            .use(permalinks({
        		pattern: ":date/:title.-:subtitle",
        		relative: false
        	}))
    )
    .use(branch()
            .filter((name, file) => !file.subtitle)
            .use(permalinks({
        		pattern: ":date/:title",
        		relative: false
        	}))
    )
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
        source: "node_modules/normalize.css",
        destination: "css/normalize.css"
    }))
    .use(assets({
        source: "node_modules/katex/dist",
        destination: "css/katex"
    }))
    .use(assets({
        source: "node_modules/@fortawesome/fontawesome-free",
        destination: "css/fontawesome"
    }))
    .use(assets({
        source: "node_modules/fontsource-pt-serif",
        destination: "css/pt-serif"
    }))
    .use(assets({
        source: "node_modules/fontsource-pt-sans-narrow",
        destination: "css/pt-sans-narrow"
    }))
    .use(assets({
        source: "node_modules/fontsource-jetbrains-mono",
        destination: "css/jetbrains-mono"
    }))
    .build(function (err) {
        if (err) throw err;
    });
