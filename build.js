var Metalsmith = require("metalsmith");
var drafts = require("metalsmith-drafts");
var markdown = require("metalsmith-markdown");
var templates = require("metalsmith-templates");
var sass = require("metalsmith-sass");
var tags = require("metalsmith-tags");

Metalsmith(__dirname)
    .source("src")
    .destination("build")
    .use(drafts())
    .use(markdown({
        smartypants: false,
        gfm: true,
        tables: true
    }))
    .use(tags({
        template: "tag.html"
    }))
    .use(templates("nunjucks"))
    .use(sass({
        outputStyle: "compressed",
        outputDir: "css"
    }))
    .build();

