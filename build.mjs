// Copyright (C) 2026 RYJASM
// Licensed under the GNU General Public License version 3.

import { build } from "esbuild";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const sourceFile = path.resolve("./src/umbrella-man.flexui.js");
const scriptsDir = path.resolve("./");
const livePluginFile = path.join(os.homedir(), "Documents", "OpenRCT2", "plugin", "umbrella-man.js");

function getTimestampId() {
    const now = new Date();
    const pad = (value, size = 2) => String(value).padStart(size, "0");
    return [
        now.getFullYear(),
        pad(now.getMonth() + 1),
        pad(now.getDate()),
        "_",
        pad(now.getHours()),
        pad(now.getMinutes()),
        pad(now.getSeconds()),
        "_",
        pad(now.getMilliseconds(), 3)
    ].join("");
}

function getVersionFromSource(sourceContent) {
    const match = sourceContent.match(/version:\s*["']([^"']+)["']/);
    return match ? match[1] : "unknown";
}

async function ensureDir(filePath) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function main() {
    const isRelease = process.argv.includes("--release");

    const sourceContent = await fs.readFile(sourceFile, 'utf-8');

    const buildId = isRelease ? `v${getVersionFromSource(sourceContent)}` : getTimestampId();
    const historyFile = path.join(scriptsDir, `/builds/umbrella-man-${buildId}.js`);

    const finalContent = sourceContent;


    await ensureDir(historyFile);
    await ensureDir(livePluginFile);

    await build({
        stdin: {
            contents: finalContent,
            resolveDir: path.dirname(sourceFile),
            sourcefile: sourceFile,
            loader: 'js',
        },
        bundle: true,
        format: "iife",
        platform: "browser",
        target: "es5",
        banner: {
            js: "if (typeof String.prototype.trim !== 'function') { String.prototype.trim = function () { return String(this).replace(/^\\s+|\\s+$/g, ''); }; }"
        },
        outfile: historyFile,
        logLevel: "info"
    });

    await fs.copyFile(historyFile, livePluginFile);

    console.log(`History build: ${historyFile}`);
    console.log(`Live plugin:   ${livePluginFile}`);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
