use std::fs;
use tempfile::TempDir;

#[test]
fn scaffold_generates_thin_instance() {
    let tmp = TempDir::new().unwrap();

    let config = create_commonpub::prompts::InstanceConfig::with_defaults("test-instance");
    let result = create_commonpub::scaffold::create_instance_at(tmp.path(), "test-instance", &config);
    assert!(result.is_ok());

    let dir = tmp.path().join("test-instance");

    // Core config files
    assert!(dir.join("package.json").exists());
    assert!(dir.join("nuxt.config.ts").exists());
    assert!(dir.join("commonpub.config.ts").exists());
    assert!(dir.join("server/utils/config.ts").exists());
    assert!(dir.join("tsconfig.json").exists());

    // Branding
    assert!(dir.join("components/SiteLogo.vue").exists());
    assert!(dir.join("assets/theme.css").exists());
    assert!(dir.join("public/favicon.svg").exists());

    // Environment
    assert!(dir.join(".env").exists());
    assert!(dir.join(".env.example").exists());

    // Deployment
    assert!(dir.join("Dockerfile").exists());
    assert!(dir.join("docker-compose.yml").exists());
    assert!(dir.join(".github/workflows/deploy.yml").exists());

    // Database
    assert!(dir.join("drizzle.config.ts").exists());

    // Misc
    assert!(dir.join(".gitignore").exists());
    assert!(dir.join("README.md").exists());
    assert!(dir.join("uploads/.gitkeep").exists());

    // Should NOT have layer files (those come from @commonpub/layer)
    assert!(!dir.join("pages/explore.vue").exists());
    assert!(!dir.join("pages/feed.vue").exists());
    assert!(!dir.join("components/ContentCard.vue").exists());
    assert!(!dir.join("server/api/content").exists());
    assert!(!dir.join("composables/useAuth.ts").exists());
    assert!(!dir.join("layouts/default.vue").exists());
}

#[test]
fn scaffold_without_docker_skips_compose() {
    let tmp = TempDir::new().unwrap();

    let mut config = create_commonpub::prompts::InstanceConfig::with_defaults("no-docker");
    config.use_docker = false;
    let result = create_commonpub::scaffold::create_instance_at(tmp.path(), "no-docker", &config);
    assert!(result.is_ok());

    let dir = tmp.path().join("no-docker");
    assert!(dir.join(".env").exists());
    assert!(dir.join("nuxt.config.ts").exists());
    assert!(!dir.join("docker-compose.yml").exists());
}

#[test]
fn scaffold_fails_if_directory_exists() {
    let tmp = TempDir::new().unwrap();

    fs::create_dir(tmp.path().join("existing")).unwrap();
    let config = create_commonpub::prompts::InstanceConfig::with_defaults("existing");
    let result = create_commonpub::scaffold::create_instance_at(tmp.path(), "existing", &config);
    assert!(result.is_err());
}

#[test]
fn init_creates_files_in_current_dir() {
    let tmp = TempDir::new().unwrap();

    let config = create_commonpub::prompts::InstanceConfig::with_defaults("test");
    let result = create_commonpub::scaffold::init_instance_at(tmp.path(), &config);
    assert!(result.is_ok());

    assert!(tmp.path().join(".env").exists());
    assert!(tmp.path().join("commonpub.config.ts").exists());
    assert!(tmp.path().join("nuxt.config.ts").exists());
    assert!(tmp.path().join("server/utils/config.ts").exists());
    assert!(tmp.path().join("components/SiteLogo.vue").exists());
}

#[test]
fn generated_env_has_correct_values() {
    let config = create_commonpub::prompts::InstanceConfig::with_defaults("my-community");
    let env = create_commonpub::template::render_env(&config);

    assert!(env.contains("NUXT_DATABASE_URL="));
    assert!(env.contains("NUXT_PUBLIC_SITE_URL=http://my-community.localhost"));
    assert!(env.contains("NUXT_PUBLIC_DOMAIN=my-community.localhost"));
    assert!(env.contains("NUXT_EMAIL_ADAPTER=console"));
    assert!(env.contains("my-community"));
}

#[test]
fn generated_config_is_valid_structure() {
    let config = create_commonpub::prompts::InstanceConfig::with_defaults("my-community");
    let ts_config = create_commonpub::template::render_config(&config);

    assert!(ts_config.contains("defineCommonPubConfig"));
    assert!(ts_config.contains("name: 'my-community'"));
    assert!(ts_config.contains("emailPassword: true"));
}

#[test]
fn package_json_has_correct_dependencies() {
    let config = create_commonpub::prompts::InstanceConfig::with_defaults("dep-test");
    let pkg = create_commonpub::template::render_package_json(&config);

    // Package named correctly
    assert!(pkg.contains("\"dep-test\""));

    // Layer dependency (the core of thin instances)
    assert!(pkg.contains("@commonpub/layer"));
    assert!(pkg.contains("@commonpub/schema"));
    assert!(pkg.contains("@commonpub/server"));
    assert!(pkg.contains("@commonpub/config"));

    // Build tools
    assert!(pkg.contains("drizzle-kit"));
    assert!(pkg.contains("@types/node"));

    // No workspace references
    assert!(!pkg.contains("workspace:"));
}

#[test]
fn nuxt_config_extends_layer() {
    let mut config = create_commonpub::prompts::InstanceConfig::with_defaults("layer-test");
    config.domain = "makers.example.com".to_string();
    config.name = "Makers Club".to_string();
    config.description = "A maker community".to_string();
    let nuxt = create_commonpub::template::render_nuxt_config(&config);

    // Extends the published layer
    assert!(nuxt.contains("extends: ['@commonpub/layer']"));

    // Instance-specific values
    assert!(nuxt.contains("Makers Club"));
    assert!(nuxt.contains("A maker community"));

    // Theme CSS override
    assert!(nuxt.contains("~/assets/theme.css"));

    // No monorepo paths
    assert!(!nuxt.contains("../../packages"));
    assert!(!nuxt.contains("fileURLToPath"));
}

#[test]
fn config_has_correct_feature_flags() {
    let mut config = create_commonpub::prompts::InstanceConfig::with_defaults("flag-test");
    config.feature_contests = true;
    config.feature_admin = true;
    config.feature_federation = true;
    config.feature_docs = false;
    config.feature_learning = false;
    config.feature_video = false;
    config.content_types = vec!["project".to_string(), "blog".to_string()];
    config.contest_creation = "staff".to_string();

    let cpub_config = create_commonpub::template::render_config(&config);
    assert!(cpub_config.contains("contests: true"));
    assert!(cpub_config.contains("admin: true"));
    assert!(cpub_config.contains("federation: true"));
    assert!(cpub_config.contains("docs: false"));
    assert!(cpub_config.contains("learning: false"));
    assert!(cpub_config.contains("video: false"));
    assert!(cpub_config.contains("contestCreation: 'staff'"));
    assert!(cpub_config.contains("contentTypes: ['project', 'blog']"));
}

#[test]
fn server_config_has_use_config_function() {
    let config_ts = create_commonpub::template::render_server_config();
    assert!(config_ts.contains("export function useConfig()"));
    assert!(config_ts.contains("CommonPubConfig"));
    assert!(config_ts.contains("commonpub.config"));
}

#[test]
fn theme_css_has_variable_overrides() {
    let mut config = create_commonpub::prompts::InstanceConfig::with_defaults("theme-test");
    config.theme = "deveco".to_string();
    let css = create_commonpub::template::render_theme_css(&config);

    assert!(css.contains("--accent:"));
    assert!(css.contains("--radius:"));
    assert!(css.contains("--border-width-default:"));
}

#[test]
fn dockerfile_is_production_ready() {
    let dockerfile = create_commonpub::template::render_dockerfile();
    assert!(dockerfile.contains("node:22-alpine"));
    assert!(dockerfile.contains("pnpm install --frozen-lockfile"));
    assert!(dockerfile.contains("pnpm build"));
    assert!(dockerfile.contains(".output/server/index.mjs"));
}

// ── CLI flags ─────────────────────────────────────────────

#[test]
fn cli_binary_with_feature_flags() {
    use assert_cmd::Command;

    let tmp = TempDir::new().unwrap();
    let name = "flag-test";

    Command::cargo_bin("create-commonpub")
        .unwrap()
        .current_dir(tmp.path())
        .args(&[
            "new", name,
            "--features", "content,social,hubs,contests,admin",
            "--content-types", "project,blog",
            "--contest-creation", "staff",
            "--no-docker",
        ])
        .assert()
        .success();

    let dir = tmp.path().join(name);

    // Docker skipped
    assert!(!dir.join("docker-compose.yml").exists());

    // Thin instance files present
    assert!(dir.join("nuxt.config.ts").exists());
    assert!(dir.join("components/SiteLogo.vue").exists());
    assert!(dir.join("server/utils/config.ts").exists());

    // Config has correct feature flags
    let config = fs::read_to_string(dir.join("commonpub.config.ts")).unwrap();
    assert!(config.contains("content: true"));
    assert!(config.contains("hubs: true"));
    assert!(config.contains("contests: true"));
    assert!(config.contains("admin: true"));
    assert!(config.contains("docs: false"));
    assert!(config.contains("learning: false"));
    assert!(config.contains("video: false"));
    assert!(config.contains("contestCreation: 'staff'"));
    assert!(config.contains("contentTypes: ['project', 'blog']"));

    // Package.json has layer dependency
    let pkg = fs::read_to_string(dir.join("package.json")).unwrap();
    assert!(pkg.contains("@commonpub/layer"));
    assert!(pkg.contains("@commonpub/schema"));
}
