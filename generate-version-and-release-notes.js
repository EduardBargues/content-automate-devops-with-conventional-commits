const child = require("child_process");
const fs = require("fs");

const featPreffix = "feat:";
const fixPreffix = "fix:";
const breakPreffix = "break:";
const versionFile = "version.json";
const changelogFile = "CHANGELOG.md";

const updateChangelogWith = (changelog, title, changeContents) => {
    if (changeContents.length > 0) {
        changelog += `${title}`;
        changeContents.forEach(content => {
            changelog += content;
        });
    }
    return changelog;
}
const getUpdatedVersion = (version, changes) => {
    let versionFileContent = version.split(".");
    let major = parseInt(versionFileContent[0], 10);
    let minor = parseInt(versionFileContent[1], 10);
    let patch = parseInt(versionFileContent[2], 10);
    let secondary = parseInt(versionFileContent[3], 10);

    let newMajor = 0;
    let newMinor = 0;
    let newPatch = 0;
    let newSecondary = 0;
    if (changes.some(change => change.type === "break")) {
        newMajor = major + 1;
        newMinor = 0;
        newPatch = 0;
        newSecondary = 0;
    } else if (changes.some(change => change.type === "feat")) {
        newMajor = major;
        newMinor = minor + 1;
        newPatch = 0;
        newSecondary = 0;
    } else if (changes.some(change => change.type === "fix")) {
        newMajor = major;
        newMinor = minor;
        newPatch = patch + 1;
        newSecondary = 0;
    } else {
        newMajor = major;
        newMinor = minor;
        newPatch = patch;
        newSecondary = secondary + 1;
    }

    return `${newMajor}.${newMinor}.${newPatch}.${newSecondary}`;
}
const getChanges = lines => lines
    .filter(line => line.startsWith("* "))
    .map(line => line.replace("* ", "").trim())
    .map(line => {
        if (line.startsWith(featPreffix)) {
            return {
                type: featPreffix.replace(":", ""),
                content: line.replace(featPreffix, "").trim()
            };
        } else if (line.startsWith(fixPreffix)) {
            return {
                type: fixPreffix.replace(":", ""),
                content: line.replace(fixPreffix, "").trim()
            };
        } else if (line.startsWith(breakPreffix)) {
            return {
                type: breakPreffix.replace(":", ""),
                content: line.replace(breakPreffix, "").trim()
            };
        } else {
            return {
                type: "none",
                content: line.trim()
            };
        }
    });
const updateChangelogFile = newVersion => {
    let changelog = `# :confetti_ball: ${newVersion.version} (${newVersion.date})\n`;
    changelog += "- - -\n";
    changelog = updateChangelogWith(
        changelog,
        "## :boom: BREAKING CHANGES\n",
        newVersion.changes.filter(change => change.type == "break").map(change => `* ${change.content}\n`));
    changelog = updateChangelogWith(
        changelog,
        "## :hammer: Features\n",
        newVersion.changes.filter(change => change.type == "feat").map(change => `* ${change.content}\n`));
    changelog = updateChangelogWith(
        changelog,
        "## :bug: Fixes\n",
        newVersion.changes.filter(change => change.type == "fix").map(change => `* ${change.content}\n`));
    changelog = updateChangelogWith(
        changelog,
        "## :newspaper: Others\n",
        newVersion.changes.filter(change => change.type == "none").map(change => `* ${change.content}\n`));
    changelog = updateChangelogWith(
        changelog,
        "###### :construction_worker: Author: ",
        [`${newVersion.author}\n`]);
    changelog += "- - -\n";
    changelog += "- - -\n";
    let previousChangelog = "";
    if (fs.existsSync(changelogFile)) {
        previousChangelog = fs.readFileSync(changelogFile, "utf-8");
    }
    fs.writeFileSync(changelogFile, `${changelog}${previousChangelog}`);
}
const commitAndTag = (newVersionAsText) => {
    child.execSync(`git add ${versionFile}`);
    child.execSync(`git add ${changelogFile}`);
    child.execSync(`git commit -m "[SKIP CI] Bump to version ${newVersionAsText}"`);
    child.execSync(`git tag -a -m "Tag for version ${newVersionAsText}" ${newVersionAsText}`);
    child.execSync(`git push --follow-tags`);
}

////////// SCRIPT //////////
let newVersion = {};
newVersion.date = new Date();
newVersion.branch = child.execSync(`git status`)
    .toString("utf-8")
    .split("\n")[0]
    .replace("On branch ", "")
    .trim();
const lines = child.execSync("git log -1 --format=full")
    .toString("utf-8")
    .split("\n");
newVersion.commit = lines[0].split(" ")[1];
newVersion.author = lines[1].replace("Author: ", "").trim();
newVersion.changes = getChanges(lines);
let previousVersion = "0.0.0.0";
if (fs.existsSync(versionFile)) {
    previousVersion = JSON.parse(fs.readFileSync(versionFile));
}
newVersion.version = getUpdatedVersion(previousVersion, newVersion.changes);
fs.writeFileSync(versionFile, JSON.stringify({
    current: newVersion.version
}, null, 4));
updateChangelogFile(newVersion);
commitAndTag(newVersion.version);