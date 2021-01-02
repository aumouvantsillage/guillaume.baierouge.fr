
const debug = require("debug")("metalsmith-stories");

module.exports = () => {
    return (files, metalsmith, done) => {
        for (let [filename, file] of Object.entries(files)) {
            if (file.collection && file.collection.indexOf("stories") >= 0) {
                file.story = [];
                for (let [otherFilename, otherFile] of Object.entries(files)) {
                    if (otherFile !== file && otherFile.title === file.title) {
                        file.story.push(otherFile);
                    }
                }
                file.story.sort((a, b) => a.date < b.date);
                file.storyDate = file.story.length ? file.story[file.story.length - 1] : file.date;
            }
        }
        done();
    };
};
