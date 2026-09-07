#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalizeCargoTargetDir, cleanAndroidJniLibs } from "./android-jni-libs.mjs";
import { patchAndroidGradle } from "./patch-android-gradle.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function findSccache() {
	if (process.env.RUSTC_WRAPPER) {
		return process.env.RUSTC_WRAPPER;
	}
	if (process.platform === "win32") {
		const result = spawnSync("where.exe", ["sccache"], { encoding: "utf8" });
		const path = result.stdout?.trim().split(/\r?\n/)[0];
		if (result.status === 0 && path) {
			return path;
		}
		for (const dir of (process.env.PATH || "").split(delimiter)) {
			if (!dir) {
				continue;
			}
			const candidate = join(dir, "sccache.exe");
			if (existsSync(candidate)) {
				return candidate;
			}
		}
		return "";
	}
	const result = spawnSync("which", ["sccache"], { encoding: "utf8" });
	const path = result.stdout?.trim();
	return result.status === 0 && path ? path : "";
}

const sdkRoot =
	process.env.ANDROID_HOME ||
	process.env.ANDROID_SDK_ROOT ||
	"/opt/homebrew/share/android-commandlinetools";
const ndkVersion = process.env.ANDROID_NDK_VERSION || "27.2.12479018";
const ndkHome = process.env.ANDROID_NDK_HOME || join(sdkRoot, "ndk", ndkVersion);
const prebuiltRoot = join(ndkHome, "toolchains", "llvm", "prebuilt");
const prebuiltHostCandidates = [
	process.platform === "darwin" && process.arch === "arm64" ? "darwin-arm64" : "",
	process.platform === "darwin" ? "darwin-x86_64" : "",
	process.platform === "linux" ? "linux-x86_64" : "",
	process.platform === "win32" ? "windows-x86_64" : "",
	"darwin-arm64",
	"darwin-x86_64",
	"linux-x86_64",
	"windows-x86_64",
].filter(Boolean);
const prebuiltHost = prebuiltHostCandidates.find((host) =>
	existsSync(join(prebuiltRoot, host)),
);
if (!prebuiltHost) {
	console.error(`Android NDK prebuilt toolchain not found under: ${prebuiltRoot}`);
	process.exit(1);
}
const llvmBin = join(prebuiltRoot, prebuiltHost, "bin");
const api = process.env.ANDROID_API_LEVEL || "35";
const javaHomeCandidates = [
	process.env.ANDROID_JAVA_HOME,
	"/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home",
	"/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home",
	process.env.JAVA_HOME,
].filter(Boolean);
const javaHome = javaHomeCandidates.find((path) =>
	existsSync(join(path, "bin", "java")),
);
const javaBin = javaHome ? join(javaHome, "bin") : "";

if (!existsSync(llvmBin)) {
	console.error(`Android NDK LLVM toolchain not found: ${llvmBin}`);
	process.exit(1);
}

patchAndroidGradle();
cleanAndroidJniLibs(
	join(projectRoot, "src-tauri/gen/android/app/src/main/jniLibs"),
);

const sccache = findSccache();
if (sccache) {
	process.env.RUSTC_WRAPPER = sccache;
} else if (!process.env.RUSTC_WRAPPER) {
	console.warn(
		"[Risuko] sccache not found; install sccache and add it to PATH to speed up Rust rebuilds",
	);
}

const env = canonicalizeCargoTargetDir({
	...process.env,
	...(sccache ? { RUSTC_WRAPPER: sccache } : {}),
	ANDROID_HOME: sdkRoot,
	ANDROID_SDK_ROOT: sdkRoot,
	ANDROID_NDK_HOME: ndkHome,
	NDK_HOME: ndkHome,
	...(javaHome ? { JAVA_HOME: javaHome } : {}),
	PATH: [javaBin, llvmBin, process.env.PATH || ""].filter(Boolean).join(delimiter),
	CC_aarch64_linux_android: join(llvmBin, `aarch64-linux-android${api}-clang`),
	CXX_aarch64_linux_android: join(llvmBin, `aarch64-linux-android${api}-clang++`),
	AR_aarch64_linux_android: join(llvmBin, "llvm-ar"),
	RANLIB_aarch64_linux_android: join(llvmBin, "llvm-ranlib"),
	CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER: join(
		llvmBin,
		`aarch64-linux-android${api}-clang`,
	),
	CC_armv7_linux_androideabi: join(llvmBin, `armv7a-linux-androideabi${api}-clang`),
	CXX_armv7_linux_androideabi: join(llvmBin, `armv7a-linux-androideabi${api}-clang++`),
	AR_armv7_linux_androideabi: join(llvmBin, "llvm-ar"),
	RANLIB_armv7_linux_androideabi: join(llvmBin, "llvm-ranlib"),
	CARGO_TARGET_ARMV7_LINUX_ANDROIDEABI_LINKER: join(
		llvmBin,
		`armv7a-linux-androideabi${api}-clang`,
	),
	CC_i686_linux_android: join(llvmBin, `i686-linux-android${api}-clang`),
	CXX_i686_linux_android: join(llvmBin, `i686-linux-android${api}-clang++`),
	AR_i686_linux_android: join(llvmBin, "llvm-ar"),
	RANLIB_i686_linux_android: join(llvmBin, "llvm-ranlib"),
	CARGO_TARGET_I686_LINUX_ANDROID_LINKER: join(
		llvmBin,
		`i686-linux-android${api}-clang`,
	),
	CC_x86_64_linux_android: join(llvmBin, `x86_64-linux-android${api}-clang`),
	CXX_x86_64_linux_android: join(llvmBin, `x86_64-linux-android${api}-clang++`),
	AR_x86_64_linux_android: join(llvmBin, "llvm-ar"),
	RANLIB_x86_64_linux_android: join(llvmBin, "llvm-ranlib"),
	CARGO_TARGET_X86_64_LINUX_ANDROID_LINKER: join(
		llvmBin,
		`x86_64-linux-android${api}-clang`,
	),
});

const args = process.argv.slice(2);
if (args.length === 0) {
	console.log(`ANDROID_HOME=${env.ANDROID_HOME}`);
	console.log(`ANDROID_NDK_HOME=${env.ANDROID_NDK_HOME}`);
	if (env.JAVA_HOME) {
		console.log("JAVA_HOME is set");
	}
	if (env.RUSTC_WRAPPER) {
		console.log(`RUSTC_WRAPPER=${env.RUSTC_WRAPPER}`);
	}
	console.log(`PATH prefix=${llvmBin}`);
	process.exit(0);
}

const child = spawn(args[0], args.slice(1), {
	stdio: "inherit",
	env,
});

child.on("exit", (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
		return;
	}
	process.exit(code ?? 1);
});
