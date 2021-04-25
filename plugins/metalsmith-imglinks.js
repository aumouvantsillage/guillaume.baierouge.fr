
const debug = require("debug")("metalsmith-imglinks");
const extname = require("path").extname;
const {JSDOM} = require("jsdom");

module.exports = function ({filter}) {
    return function imglinks(files, metalsmith, done) {
        for (let [filename, file] of Object.entries(files)) {
            if (!html(filename)) {
                continue;
            }
            debug("creating links for images in file: %s", filename);
            const dom = new JSDOM(file.contents.toString());
            const document = dom.window.document;
            const body = document.querySelector("body");
            const images = document.querySelectorAll("img");
            debug("found: %d images", images.length);
            images.forEach(img => {
                // Do not create a link if there is one already.
                if (img.parentElement.tagName === "A") {
                    return;
                }

                // Filter out images that do not match the given regexp.
                const src = img.getAttribute("src");
                if (filter && !filter.test(src)) {
                    return;
                }

                const a = document.createElement("a");
                a.setAttribute("href", src);
                a.setAttribute("target", "_blank");
                img.parentNode.insertBefore(a, img);
                a.appendChild(img);
            });
            file.contents = Buffer.from(body.innerHTML);
        }
        done();
    };
}

function html(filename) {
    return /\.html?$/i.test(extname(filename));
}
