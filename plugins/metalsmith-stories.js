
const debug = require("debug")("metalsmith-stories");

module.exports = () => {
    return (files, metalsmith, done) => {
        for (let [filename, file] of Object.entries(files)) {
            if (file.collection && file.collection.indexOf("stories") >= 0) {
                // If a file belongs to the "stories" category,
                // collect all other files with the exact same title
                // and sort them by date.
                file.story = [];
                for (const [otherFilename, otherFile] of Object.entries(files)) {
                    if (otherFile !== file && otherFile.title === file.title) {
                        file.story.push(otherFile);
                    }
                }

                // The date of a story is the date of the most recent post.
                file.story.sort((a, b) => a.date < b.date);
                file.storyDate = file.story.length ? file.story[file.story.length - 1] : file.date;

                // Add navigation info to each post in a story.
                if (file.story.length) {
                    file.storyNext = file.story[0];
                    file.story[0].storyPrev = file;
                }

                for (let i = 0; i < file.story.length; i ++) {
                    file.story[i].storyHome = file;
                    if (i > 0) {
                        file.story[i].storyPrev = file.story[i - 1];
                    }
                    if (i + 1 < file.story.length) {
                        file.story[i].storyNext = file.story[i + 1];
                    }
                }
            }
        }
        done();
    };
};
