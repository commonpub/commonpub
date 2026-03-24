use std::fs;
use tempfile::TempDir;

#[test]
fn scaffold_creates_full_nuxt_structure() {
    let tmp = TempDir::new().unwrap();

    let config = create_commonpub::prompts::InstanceConfig::with_defaults("test-instance");
    let result = create_commonpub::scaffold::create_instance_at(tmp.path(), "test-instance", &config);
    assert!(result.is_ok());

    let dir = tmp.path().join("test-instance");

    // Root config files
    assert!(dir.join(".env").exists());
    assert!(dir.join("commonpub.config.ts").exists());
    assert!(dir.join("nuxt.config.ts").exists());
    assert!(dir.join("package.json").exists());
    assert!(dir.join("tsconfig.json").exists());
    assert!(dir.join("app.vue").exists());
    assert!(dir.join("docker-compose.yml").exists());
    assert!(dir.join(".gitignore").exists());
    assert!(dir.join("README.md").exists());

    // Nuxt directories
    assert!(dir.join("pages").exists());
    assert!(dir.join("components").exists());
    assert!(dir.join("composables").exists());
    assert!(dir.join("layouts").exists());
    assert!(dir.join("plugins").exists());
    assert!(dir.join("server/api").exists());
    assert!(dir.join("server/utils").exists());
    assert!(dir.join("server/middleware").exists());
    assert!(dir.join("public").exists());
    assert!(dir.join("uploads/.gitkeep").exists());

    // Server utils (all 5)
    assert!(dir.join("server/utils/config.ts").exists());
    assert!(dir.join("server/utils/db.ts").exists());
    assert!(dir.join("server/utils/auth.ts").exists());
    assert!(dir.join("server/utils/validate.ts").exists());
    assert!(dir.join("server/utils/errors.ts").exists());

    // Server middleware
    assert!(dir.join("server/middleware/auth.ts").exists());
    assert!(dir.join("server/middleware/security.ts").exists());

    // Plugin + composable
    assert!(dir.join("plugins/auth.ts").exists());
    assert!(dir.join("composables/useAuth.ts").exists());

    // Pages + layouts
    assert!(dir.join("layouts/default.vue").exists());
    assert!(dir.join("pages/index.vue").exists());
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
    assert!(dir.join("server/utils/db.ts").exists());
    assert!(dir.join("server/middleware/auth.ts").exists());
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
    assert!(tmp.path().join("app.vue").exists());
    assert!(tmp.path().join("pages/index.vue").exists());
    assert!(tmp.path().join("server/utils/db.ts").exists());
    assert!(tmp.path().join("server/middleware/auth.ts").exists());
    assert!(tmp.path().join("composables/useAuth.ts").exists());
}

#[test]
fn generated_env_has_correct_values() {
    let config = create_commonpub::prompts::InstanceConfig::with_defaults("my-community");
    let env = create_commonpub::template::render_env(&config);

    assert!(env.contains("INSTANCE_NAME=my-community"));
    assert!(env.contains("INSTANCE_DOMAIN=my-community.localhost"));
    assert!(env.contains("FEATURE_CONTENT=true"));
    assert!(env.contains("FEATURE_HUBS=true"));
    assert!(env.contains("FEATURE_FEDERATION=false"));
    assert!(env.contains("EMAIL_ADAPTER=console"));
    assert!(env.contains("SMTP_HOST"));
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
fn package_json_conditional_deps() {
    // All optional features enabled (default)
    let config = create_commonpub::prompts::InstanceConfig::with_defaults("full");
    let json = create_commonpub::template::render_package_json(&config);
    assert!(json.contains("@commonpub/docs"));
    assert!(json.contains("@commonpub/learning"));
    assert!(json.contains("@commonpub/explainer"));
    assert!(json.contains("@commonpub/editor"));
    assert!(json.contains("\"pg\":"));
    assert!(json.contains("\"zod\":"));
    assert!(!json.contains("@commonpub/protocol"));

    // Minimal
    let mut minimal = create_commonpub::prompts::InstanceConfig::with_defaults("minimal");
    minimal.feature_content = false;
    minimal.feature_docs = false;
    minimal.feature_learning = false;
    minimal.feature_explainers = false;
    minimal.feature_federation = false;
    let json = create_commonpub::template::render_package_json(&minimal);
    assert!(!json.contains("@commonpub/docs"));
    assert!(!json.contains("@commonpub/learning"));
    assert!(!json.contains("@commonpub/explainer"));
    assert!(!json.contains("@commonpub/editor"));
    assert!(!json.contains("@commonpub/protocol"));

    // Federation
    let mut federated = create_commonpub::prompts::InstanceConfig::with_defaults("federated");
    federated.feature_federation = true;
    let json = create_commonpub::template::render_package_json(&federated);
    assert!(json.contains("@commonpub/protocol"));
}

#[test]
fn generated_server_infra_is_correct() {
    let tmp = TempDir::new().unwrap();
    let config = create_commonpub::prompts::InstanceConfig::with_defaults("my-site");
    create_commonpub::scaffold::create_instance_at(tmp.path(), "my-site", &config).unwrap();

    let dir = tmp.path().join("my-site");

    // Auth middleware uses configurable email adapter (console, smtp, resend)
    let auth_mw = fs::read_to_string(dir.join("server/middleware/auth.ts")).unwrap();
    assert!(auth_mw.contains("SmtpEmailAdapter"));
    assert!(auth_mw.contains("ResendEmailAdapter"));
    assert!(auth_mw.contains("ConsoleEmailAdapter"));
    assert!(auth_mw.contains("createEmailAdapter"));

    // DB util has pool + singleton
    let db = fs::read_to_string(dir.join("server/utils/db.ts")).unwrap();
    assert!(db.contains("pg.Pool"));
    assert!(db.contains("useDB"));

    // Auth util has require/optional helpers
    let auth = fs::read_to_string(dir.join("server/utils/auth.ts")).unwrap();
    assert!(auth.contains("requireAuth"));
    assert!(auth.contains("requireAdmin"));
    assert!(auth.contains("getOptionalUser"));

    // Security middleware has rate limiting
    let sec = fs::read_to_string(dir.join("server/middleware/security.ts")).unwrap();
    assert!(sec.contains("RateLimitStore"));
    assert!(sec.contains("Content-Security-Policy"));

    // Plugin bridges SSR auth to client
    let plugin = fs::read_to_string(dir.join("plugins/auth.ts")).unwrap();
    assert!(plugin.contains("defineNuxtPlugin"));
    assert!(plugin.contains("import.meta.server"));

    // Composable has full auth API
    let composable = fs::read_to_string(dir.join("composables/useAuth.ts")).unwrap();
    assert!(composable.contains("signIn"));
    assert!(composable.contains("signUp"));
    assert!(composable.contains("signOut"));
    assert!(composable.contains("isAdmin"));
}

// ── Feature-aware page generation ─────────────────────────

#[test]
fn default_scaffold_generates_feature_pages() {
    let tmp = TempDir::new().unwrap();
    let config = create_commonpub::prompts::InstanceConfig::with_defaults("full-site");
    create_commonpub::scaffold::create_instance_at(tmp.path(), "full-site", &config).unwrap();

    let dir = tmp.path().join("full-site");

    // Default config has content, hubs, docs, learning ON — contests, admin OFF
    assert!(dir.join("pages/explore.vue").exists());
    assert!(dir.join("pages/hubs.vue").exists());
    assert!(dir.join("pages/docs.vue").exists());
    assert!(dir.join("pages/learn.vue").exists());
    assert!(!dir.join("pages/contests.vue").exists());
    assert!(!dir.join("pages/admin.vue").exists());
}

#[test]
fn minimal_scaffold_skips_feature_pages() {
    let tmp = TempDir::new().unwrap();
    let mut config = create_commonpub::prompts::InstanceConfig::with_defaults("minimal-site");
    config.feature_content = false;
    config.feature_hubs = false;
    config.feature_docs = false;
    config.feature_learning = false;
    config.feature_contests = false;
    config.feature_admin = false;
    create_commonpub::scaffold::create_instance_at(tmp.path(), "minimal-site", &config).unwrap();

    let dir = tmp.path().join("minimal-site");

    // Only index page should exist
    assert!(dir.join("pages/index.vue").exists());
    assert!(!dir.join("pages/explore.vue").exists());
    assert!(!dir.join("pages/hubs.vue").exists());
    assert!(!dir.join("pages/docs.vue").exists());
    assert!(!dir.join("pages/learn.vue").exists());
    assert!(!dir.join("pages/contests.vue").exists());
    assert!(!dir.join("pages/admin.vue").exists());
}

#[test]
fn contests_and_admin_scaffold_generates_their_pages() {
    let tmp = TempDir::new().unwrap();
    let mut config = create_commonpub::prompts::InstanceConfig::with_defaults("contest-site");
    config.feature_contests = true;
    config.feature_admin = true;
    create_commonpub::scaffold::create_instance_at(tmp.path(), "contest-site", &config).unwrap();

    let dir = tmp.path().join("contest-site");
    assert!(dir.join("pages/contests.vue").exists());
    assert!(dir.join("pages/admin.vue").exists());
}

// ── Feature-aware nav ─────────────────────────────────────

#[test]
fn layout_nav_matches_enabled_features() {
    let tmp = TempDir::new().unwrap();
    let mut config = create_commonpub::prompts::InstanceConfig::with_defaults("nav-test");
    config.feature_contests = true;
    config.feature_admin = true;
    config.feature_docs = false;
    config.feature_learning = false;
    create_commonpub::scaffold::create_instance_at(tmp.path(), "nav-test", &config).unwrap();

    let dir = tmp.path().join("nav-test");
    let layout = fs::read_to_string(dir.join("layouts/default.vue")).unwrap();

    assert!(layout.contains("Home"));
    assert!(layout.contains("Explore"));    // content is on
    assert!(layout.contains("Hubs"));       // hubs is on
    assert!(layout.contains("Contests"));   // contests on
    assert!(layout.contains("Admin"));      // admin on
    assert!(!layout.contains("Docs"));      // docs off
    assert!(!layout.contains("Learn"));     // learning off
}

// ── CLI flags override defaults ───────────────────────────

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

    // Feature pages present for enabled features
    assert!(dir.join("pages/explore.vue").exists());
    assert!(dir.join("pages/hubs.vue").exists());
    assert!(dir.join("pages/contests.vue").exists());
    assert!(dir.join("pages/admin.vue").exists());

    // Feature pages absent for disabled features
    assert!(!dir.join("pages/docs.vue").exists());
    assert!(!dir.join("pages/learn.vue").exists());

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

    // Nav only shows enabled features
    let layout = fs::read_to_string(dir.join("layouts/default.vue")).unwrap();
    assert!(layout.contains("Hubs"));
    assert!(layout.contains("Contests"));
    assert!(layout.contains("Admin"));
    assert!(!layout.contains("Docs"));
    assert!(!layout.contains("Learn"));

    // Package.json has no docs/learning/explainer deps
    let pkg = fs::read_to_string(dir.join("package.json")).unwrap();
    assert!(!pkg.contains("@commonpub/docs"));
    assert!(!pkg.contains("@commonpub/learning"));
    assert!(!pkg.contains("@commonpub/explainer"));
    assert!(pkg.contains("@commonpub/editor")); // content is on

    // .env has correct flags
    let env = fs::read_to_string(dir.join(".env")).unwrap();
    assert!(env.contains("FEATURE_CONTESTS=true"));
    assert!(env.contains("FEATURE_DOCS=false"));
    assert!(env.contains("FEATURE_LEARNING=false"));
}
