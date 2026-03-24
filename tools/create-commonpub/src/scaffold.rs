use std::fs;
use std::path::{Path, PathBuf};

use include_dir::{include_dir, Dir};

use crate::prompts::InstanceConfig;
use crate::template;

/// The entire reference app, embedded at compile time.
/// Excludes node_modules, .nuxt, .output, uploads, .env via .gitignore + include_dir filtering.
static REFERENCE_APP: Dir = include_dir!("$CARGO_MANIFEST_DIR/reference-app");

/// Files and directories to skip when copying the reference app
const SKIP_NAMES: &[&str] = &[
    "node_modules",
    ".nuxt",
    ".output",
    ".stryker-tmp",
    "uploads",
    ".env",
    "vitest.config.ts",
    "__tests__",
    "e2e",
    "scripts",
];

fn should_skip(name: &str) -> bool {
    SKIP_NAMES.contains(&name)
}

pub fn create_instance(name: &str, config: &InstanceConfig) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let path = PathBuf::from(name);
    if path.exists() {
        return Err(format!("Directory '{}' already exists", name).into());
    }
    fs::create_dir_all(&path)?;
    write_reference_app(&path, config)?;
    Ok(fs::canonicalize(&path)?)
}

pub fn create_instance_at(base: &Path, name: &str, config: &InstanceConfig) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let path = base.join(name);
    if path.exists() {
        return Err(format!("Directory '{}' already exists", path.display()).into());
    }
    fs::create_dir_all(&path)?;
    write_reference_app(&path, config)?;
    Ok(fs::canonicalize(&path)?)
}

pub fn init_instance(config: &InstanceConfig) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let path = PathBuf::from(".");
    write_reference_app(&path, config)?;
    Ok(fs::canonicalize(&path)?)
}

pub fn init_instance_at(dir: &Path, config: &InstanceConfig) -> Result<PathBuf, Box<dyn std::error::Error>> {
    write_reference_app(dir, config)?;
    Ok(fs::canonicalize(dir)?)
}

fn write_reference_app(dir: &Path, config: &InstanceConfig) -> Result<(), Box<dyn std::error::Error>> {
    // 1. Copy the entire embedded reference app
    copy_dir_recursive(&REFERENCE_APP, dir)?;

    // 2. Patch package.json — workspace:* → npm versions, rename, add @types/node
    patch_package_json(dir, config)?;

    // 3. Patch nuxt.config.ts — replace monorepo theme paths with npm package paths
    patch_nuxt_config(dir, config)?;

    // 4. Write .env from config
    let env_content = template::render_env(config);
    fs::write(dir.join(".env"), env_content)?;

    // 5. Write commonpub.config.ts from config
    let config_content = template::render_config(config);
    fs::write(dir.join("commonpub.config.ts"), config_content)?;

    // 6. Write docker-compose.yml if requested
    if config.use_docker {
        let compose = template::render_docker_compose(config);
        fs::write(dir.join("docker-compose.yml"), compose)?;
    }

    // 7. Write drizzle.config.ts (standalone version, not monorepo)
    let drizzle_config = template::render_drizzle_config(config);
    fs::write(dir.join("drizzle.config.ts"), drizzle_config)?;

    // 8. Ensure uploads directory exists
    fs::create_dir_all(dir.join("uploads"))?;
    fs::write(dir.join("uploads/.gitkeep"), "")?;

    // 9. Write .gitignore
    fs::write(dir.join(".gitignore"), template::render_gitignore())?;

    // 10. Write README
    let readme = format!(
        "# {}\n\n{}\n\nBuilt with [CommonPub](https://commonpub.dev).\n",
        config.name, config.description
    );
    fs::write(dir.join("README.md"), readme)?;

    Ok(())
}

/// Recursively copy an embedded directory to disk, skipping excluded paths
fn copy_dir_recursive(embedded: &Dir, target: &Path) -> Result<(), Box<dyn std::error::Error>> {
    for file in embedded.files() {
        let name = file.path().file_name().and_then(|n| n.to_str()).unwrap_or("");
        if should_skip(name) {
            continue;
        }

        let dest = target.join(file.path());
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&dest, file.contents())?;
    }

    for sub_dir in embedded.dirs() {
        let name = sub_dir.path().file_name().and_then(|n| n.to_str()).unwrap_or("");
        if should_skip(name) {
            continue;
        }
        copy_dir_recursive(sub_dir, target)?;
    }

    Ok(())
}

/// Patch package.json: replace workspace:* with published versions, rename, adjust scripts
fn patch_package_json(dir: &Path, config: &InstanceConfig) -> Result<(), Box<dyn std::error::Error>> {
    let pkg_path = dir.join("package.json");
    let content = fs::read_to_string(&pkg_path)?;

    let patched = content
        // Replace workspace references with published versions
        .replace("\"workspace:*\"", "\"^0.3.1\"")
        // Rename package
        .replace("\"@commonpub/reference\"", &format!("\"{}\"", config.name))
        // Remove monorepo-only scripts
        .replace("\"generate\": \"nuxt generate\",\n    ", "")
        .replace("\"test\": \"vitest run\",\n    ", "")
        .replace("\"lint\": \"eslint .\",\n    ", "")
        .replace("\"typecheck\": \"nuxt typecheck\",\n    ", "")
        .replace("\"clean\": \"rm -rf .nuxt .output\",\n    ", "")
        .replace("\"seed\": \"tsx scripts/seed.ts\"\n", "\"db:push\": \"drizzle-kit push\",\n    \"db:studio\": \"drizzle-kit studio\"\n");

    // Add @types/node and drizzle-kit to devDependencies if not present
    let patched = if !patched.contains("@types/node") {
        patched.replace(
            "\"devDependencies\": {",
            "\"devDependencies\": {\n    \"@types/node\": \"^22.0.0\",\n    \"drizzle-kit\": \"^0.31.0\","
        )
    } else {
        patched
    };

    fs::write(&pkg_path, patched)?;
    Ok(())
}

/// Patch nuxt.config.ts: replace monorepo theme paths with npm package paths
fn patch_nuxt_config(dir: &Path, config: &InstanceConfig) -> Result<(), Box<dyn std::error::Error>> {
    let config_path = dir.join("nuxt.config.ts");
    let content = fs::read_to_string(&config_path)?;

    let patched = content
        // Remove monorepo path resolver
        .replace("import { fileURLToPath } from 'node:url';\n", "")
        .replace("import { resolve, dirname } from 'node:path';\n", "")
        .replace("\nconst __dirname = dirname(fileURLToPath(import.meta.url));\n", "")
        .replace("const uiTheme = (file: string) => resolve(__dirname, '../../packages/ui/theme', file);\n", "")
        // Replace uiTheme() calls with direct npm package paths
        .replace("uiTheme('base.css')", "'@commonpub/ui/theme/base.css'")
        .replace("uiTheme('dark.css')", "'@commonpub/ui/theme/dark.css'")
        .replace("uiTheme('components.css')", "'@commonpub/ui/theme/components.css'")
        .replace("uiTheme('prose.css')", "'@commonpub/ui/theme/prose.css'")
        .replace("uiTheme('layouts.css')", "'@commonpub/ui/theme/layouts.css'")
        .replace("uiTheme('forms.css')", "'@commonpub/ui/theme/forms.css'")
        .replace("uiTheme('editor-panels.css')", "'@commonpub/ui/theme/editor-panels.css'")
        // Remove pathPrefix: false (standalone needs default prefix behavior for nested components)
        .replace("  components: {\n    dirs: [\n      { path: '~/components', pathPrefix: false },\n    ],\n  },\n", "")
        // Replace monorepo vite fs.allow
        .replace("allow: ['../..']", "allow: ['..']")
        // Update default site URL/domain/name
        .replace("siteUrl: 'http://localhost:3000'", &format!("siteUrl: 'http://{}'", config.domain))
        .replace("domain: 'localhost:3000'", &format!("domain: '{}'", config.domain))
        .replace("siteName: 'CommonPub'", &format!("siteName: '{}'", config.name))
        .replace("siteDescription: 'A CommonPub instance'", &format!("siteDescription: '{}'", config.description))
        // Patch feature flag defaults in runtimeConfig.public.features
        .replace("content: true,\n        social: true,\n        hubs: true,\n        docs: true,\n        video: true,\n        contests: false,\n        learning: true,\n        explainers: true,\n        federation: false,\n        admin: false,",
            &format!("content: {},\n        social: {},\n        hubs: {},\n        docs: {},\n        video: {},\n        contests: {},\n        learning: {},\n        explainers: {},\n        federation: {},\n        admin: {},",
                config.feature_content, config.feature_social, config.feature_hubs,
                config.feature_docs, config.feature_video, config.feature_contests,
                config.feature_learning, config.feature_explainers, config.feature_federation,
                config.feature_admin))
        // Patch content types
        .replace("contentTypes: 'project,article,blog,explainer'", &format!("contentTypes: '{}'", config.content_types.join(",")))
        // Patch contest creation
        .replace("contestCreation: 'admin'", &format!("contestCreation: '{}'", config.contest_creation));

    fs::write(&config_path, patched)?;
    Ok(())
}
