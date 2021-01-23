const child = require("child_process");
const fs = require("fs");

const featPreffix = "feat:";
const fixPreffix = "fix:";
const breakPreffix = "break:";
const approvedByPreffix = "Approved-by:";
const versionFile = "version.json";
const changelogFile = "CHANGELOG.md";

// ------------------ //
// ----- SCRIPT ----- //
// ------------------ //

let newVersion = {};

newVersion.date = new Date();
newVersion.branch = getCurrentBranch();
const lines = getLastCommitAsSeparatedLines();
newVersion.commit = getCommit(lines);
newVersion.author = getAuthor(lines);
newVersion.changes = getChanges(lines);
newVersion.approvals = getApprovals(lines);
let versionFileContent = getJsonObject(versionFile);
let previousVersion = getPreviousVersionAsText(versionFileContent);
newVersion.version = getUpdatedVersion(previousVersion, newVersion.changes);
updateVersionFile(versionFileContent);
updateChangelogFile(newVersion);
commitAndTag(newVersion.version);

// --------------------- //
// ----- FUNCTIONS ----- //
// --------------------- //
function cleanLine(text) {
    return text
        .trim()
        .replace("* ", "")
        .replace(`${featPreffix}: `, featPreffix)
        .replace(`${fixPreffix}: `, fixPreffix)
        .replace(`${breakPreffix}: `, breakPreffix);
}

function getJsonObject(filePath) {
    return JSON.parse(fs.readFileSync(filePath));
}

function asPrettyJson(jsonObject) {
    return JSON.stringify(jsonObject, null, 4);
}

function updateChangelogWith(changelog, title, changeContents) {
    if (changeContents.length > 0) {
        changelog += `${title}`;
        changeContents.forEach(content => {
            changelog += content;
        });
    }
    return changelog;
}

function getUpdatedVersion(version, changes) {
    let versionFileContent = version.split(".");
    let major = parseInt(versionFileContent[0], 10);
    let minor = parseInt(versionFileContent[1], 10);
    let patch = parseInt(versionFileContent[2], 10);
    let secondary = 0;
    if (versionFileContent.length > 3) {
        secondary = parseInt(versionFileContent[3], 10);
    }

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

function getChange(line) {
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
}

function getAuthor(lines) {
    return lines[1].replace("Author: ", "").trim();
}

function getCommit(lines) {
    return lines[0].split(" ")[1];
}

function getCurrentBranch() {
    return child.execSync(`git status`)
        .toString("utf-8")
        .split("\n")[0]
        .replace("On branch ", "")
        .trim();
}

function isApprovalLine(line) {
    return line.trim().startsWith(`${approvedByPreffix} `);
}

function getChanges(lines) {
    return lines
        .filter((line, index, arr) => index >= 8 && !isApprovalLine(line))
        .map(line => cleanLine(line))
        .filter(line => line.length > 0)
        .map(line => getChange(line));
}

function getApprovals(lines) {
    return lines
        .filter(line => isApprovalLine(line))
        .map(line => line
            .replace(`${approvedByPreffix} `, "")
            .trim());
}

function getPreviousVersionAsText(versionFileContent) {
    let previousVersion = "";
    if (versionFileContent.versions.length > 0) {
        previousVersion = versionFileContent.versions[0].version;
    } else {
        previousVersion = "0.0.0.0";
    }
    return previousVersion;
}

function updateVersionFile(versionFileContent) {
    let newVersions = [];
    newVersions.push(newVersion);
    for (let index = 0; index < versionFileContent.versions.length; index++) {
        newVersions.push(versionFileContent.versions[index]);
    }
    fs.writeFileSync(versionFile, asPrettyJson({
        versions: newVersions
    }));
}

function updateChangelogFile(newVersion) {
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
    changelog = updateChangelogWith(
        changelog,
        "###### :thumbsup: Approval(s): ",
        [`${newVersion.approvals.join(", ")}\n`]);
    changelog += "- - -\n";
    changelog += "- - -\n";
    let previousChangelog = "";
    try {
        previousChangelog = fs.readFileSync(changelogFile, "utf-8");
    } catch (error) {
        previousChangelog = "";
    }
    fs.writeFileSync(changelogFile, `${changelog}${previousChangelog}`);
}

function commitAndTag(newVersionAsText) {
    child.execSync(`git add ${versionFile}`);
    child.execSync(`git add ${changelogFile}`);
    child.execSync(`git commit -m "[SKIP CI] Bump to version ${newVersionAsText}"`);
    child.execSync(`git tag -a -m "Tag for version ${newVersionAsText}" ${newVersionAsText}`);
    child.execSync(`git push --follow-tags`);
}

function getLastCommitAsSeparatedLines() {
    return child.execSync("git log -1 --format=full")
        .toString("utf-8")
        .split("\n");
}