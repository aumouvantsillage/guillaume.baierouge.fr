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
const stories     = require("./plugins/metalsmith-stories");
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

nunjucks
    .configure({
        watch: false,
        autoescape: false
    })
    .addFilter("relative", (childName, parentName) => {
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

/*
 * Generate HTML
 */
 
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
    .use(drafts())
    .use(md)
    .use(sections({
        level: 2,
        nested: false
    }))
    .use(more())
    .use(branch()
            .filter((name, file) => file.subtitle)
            // TODO: Change to :data/:title/:subtitle.
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
        template: "tag.html",
        metadataKey: "allTags"
    }))
    .use(stories())
    .use(collections({
        posts: {
            sortBy: "date",
            reverse: true
        },
        stories: {
            sortBy: "storyDate",
            reverse: true
        }
    }))
    .use(templates("nunjucks"))
    .build(err => {
        if (err) throw err;
    });

/*
 * Compile stylesheets
 */

Metalsmith(__dirname)
    .source("styles")
    .use(sass({
        outputStyle: "compressed",
        outputDir: "css"
    }))
    .build(err => {
        if (err) throw err;
    });

/*
 * Copy assets
 */

const assetPaths = {
    "assets"                                    : "assets",
    "node_modules/normalize.css"                : "css/normalize.css",
    "node_modules/katex/dist"                   : "css/katex",
    "node_modules/@fortawesome/fontawesome-free": "css/fontawesome",
    "node_modules/fontsource-pt-serif"          : "css/pt-serif",
    "node_modules/fontsource-pt-sans-narrow"    : "css/pt-sans-narrow",
    "node_modules/fontsource-jetbrains-mono"    : "css/jetbrains-mono",
};

Object.entries(assetPaths)
    .reduce(
        (M, [source, destination]) => M.use(assets({source, destination})),
        Metalsmith(__dirname)
    )
    .build(err => {
        if (err) throw err;
    });
