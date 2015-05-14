var debug = require("debug")("metalsmith-sections");
var extname = require("path").extname;
var jsdom = require("jsdom");

module.exports = function (opts) {
    opts.level = opts.level || Infinity;
    opts.nested = opts.nested === undefined ? true : opts.nested;

    return function sections(files, metalsmith, done) {
        Object.keys(files).forEach(function (fileName) {
            if (html(fileName)) {
                debug("generating HTML5 sections for file: %s", fileName);
                // Parse the file contents as an HTML document and get its body element
                var document = jsdom.jsdom(files[fileName].contents.toString());
                var body = document.querySelector("body");

                // Prepare a target element that will receive the transformed elements
                var target = document.createElement("div");
                var currentTarget = target;

                // Start at heading level 0
                var currentLevel = 0;

                var currentElement;
                while (currentElement = body.firstChild) {
                    // Check that the current element is a heading.
                    if (/h\d/i.test(currentElement.tagName)) {
                        // Chack that the heading level is lower that, or equal to,
                        // the desired max level.
                        var headingLevel = parseInt(currentElement.tagName.slice(1));
                        if (headingLevel <= opts.level) {
                            // While the heading has a level lower than, or equal to,
                            // the current level, move up the document hierarchy.
                            while ((!opts.nested || headingLevel <= currentLevel) && currentLevel > 0) {
                                currentTarget = currentTarget.parentNode;
                                currentLevel --;
                            }
                            // Create a new section element into the current target element.
                            // Move down the hierarchy to the new section.
                            var section = document.createElement("section");
                            currentTarget.appendChild(section);
                            currentTarget = section;
                            currentLevel ++;
                        }
                    }
                    // Move the current element into the current target element.
                    currentTarget.appendChild(currentElement);
                }
                // Serialize the content of the target
                files[fileName].contents = new Buffer(target.innerHTML);
            }
        });
        done();
    };
};

function html(fileName) {
    return /\.html?$/i.test(extname(fileName));
}
