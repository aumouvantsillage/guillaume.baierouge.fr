
const debug     = require("debug")("metalsmith-sections");
const {extname} = require("path");
const {JSDOM}   = require("jsdom");

module.exports = ({level=Infinity, nested=true} = {}) => {
    return (files, metalsmith, done) => {
        for (let [filename, file] of Object.entries(files)) {
            if (html(filename)) {
                debug("generating HTML5 sections for file: %s", filename);

                // Parse the file contents as an HTML document and get its body element
                const document = new JSDOM(file.contents.toString()).window.document;
                const body = document.querySelector("body");

                // Prepare a target element that will receive the transformed elements
                const target = document.createElement("div");
                let currentTarget = target;

                // Start at heading level 0
                let currentLevel = 0;

                let currentElement;
                while (currentElement = body.firstChild) {
                    // Check that the current element is a heading.
                    if (/h\d/i.test(currentElement.tagName)) {
                        // Check that the heading level is lower that, or equal to,
                        // the desired max level.
                        const headingLevel = parseInt(currentElement.tagName.slice(1));
                        if (headingLevel <= level) {
                            // While the heading has a level lower than, or equal to,
                            // the current level, move up the document hierarchy.
                            while ((!nested || headingLevel <= currentLevel) && currentLevel > 0) {
                                currentTarget = currentTarget.parentNode;
                                currentLevel --;
                            }
                            // Create a new section element into the current target element.
                            // Move down the hierarchy to the new section.
                            const section = document.createElement("section");
                            currentTarget.appendChild(section);
                            currentTarget = section;
                            currentLevel ++;
                        }
                    }
                    // Move the current element into the current target element.
                    currentTarget.appendChild(currentElement);
                }

                // Serialize the content of the target
                file.contents = Buffer.from(target.innerHTML);
            }
        }
        done();
    };
};

function html(filename) {
    return /\.html?$/i.test(extname(filename));
}
