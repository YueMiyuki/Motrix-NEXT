#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const gradleDir = join(projectRoot, "src-tauri/gen/android");
const gradlePropsPath = join(gradleDir, "gradle.properties");
const tuningPath = join(scriptDir, "android-gradle.properties");
const marker = "# Risuko Gradle tuning (scripts/patch-android-gradle.mjs)";
const staleTuningKeys = [
	"org.gradle.jvmargs=-Xmx4g",
	"org.gradle.jvmargs=-Xmx2048m",
	"org.gradle.parallel=true",
	"org.gradle.configuration-cache=true",
	"org.gradle.caching=true",
];

function stripManagedBlock(content, tuning) {
	const markerIndex = content.indexOf(marker);
	if (markerIndex < 0) {
		return content;
	}
	const prefix = content.slice(0, markerIndex);
	const managedLines = new Set([
		...tuning.split("\n").map((line) => line.trim()),
		...staleTuningKeys,
	]);
	const rest = content.slice(markerIndex + marker.length).replace(/^\n+/, "");
	const lines = rest.split("\n");
	let start = 0;
	while (start < lines.length) {
		const trimmed = lines[start].trim();
		if (
			trimmed === "" ||
			managedLines.has(trimmed) ||
			staleTuningKeys.some((key) => trimmed.startsWith(key))
		) {
			start += 1;
			continue;
		}
		break;
	}
	const suffix = lines.slice(start).join("\n").trim();
	return suffix ? `${prefix.trimEnd()}\n\n${suffix}` : prefix.trimEnd();
}

export function patchAndroidGradle() {
	if (!existsSync(gradleDir)) {
		return false;
	}
	const tuning = readFileSync(tuningPath, "utf8").trim();
	let content = existsSync(gradlePropsPath)
		? readFileSync(gradlePropsPath, "utf8")
		: "";
	content = stripManagedBlock(content, tuning);
	content = content
		.split("\n")
		.filter((line) => !staleTuningKeys.some((key) => line.trim().startsWith(key)))
		.join("\n")
		.trimEnd();
	const next = `${content}\n\n${marker}\n${tuning}\n`;
	writeFileSync(gradlePropsPath, next);
	return true;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
	const patched = patchAndroidGradle();
	if (!patched) {
		console.warn(
			"[Risuko] Android project not initialized yet; gradle tuning will apply on first build",
		);
	}
}
