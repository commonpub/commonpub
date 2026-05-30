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
    // The lockfile is optional via glob so a fresh one-click deploy
    // (no committed pnpm-lock.yaml) still builds; --frozen-lockfile
    // must NOT be reintroduced (it breaks the no-lockfile first deploy).
    assert!(dockerfile.contains("COPY package.json pnpm-lock.yaml* ./"));
    assert!(dockerfile.contains("RUN pnpm install"));
    assert!(!dockerfile.contains("--frozen-lockfile"));
    assert!(dockerfile.contains("pnpm build"));
    assert!(dockerfile.contains(".output/server/index.mjs"));
}

#[test]
fn dockerfile_pins_pnpm_not_latest() {
    // Regression: pnpm@latest broke deveco's deploy (session 140) when
    // pnpm >=10.11 tightened build-script approval. The scaffolder must
    // generate a PINNED pnpm so new instances aren't time-bombs.
    let dockerfile = create_commonpub::template::render_dockerfile();
    assert!(!dockerfile.contains("pnpm@latest"), "Dockerfile must pin pnpm, not @latest");
    assert!(dockerfile.contains("pnpm@10.10.0"), "Dockerfile should pin pnpm to the known-good version");
}

#[test]
fn dockerfile_runs_migrations_not_push() {
    // Production must apply committed migrations via db-migrate.mjs,
    // never `drizzle-kit push` (CLAUDE.md rule). The CMD chains the
    // migrate step before the server. (A cautionary comment in the
    // Dockerfile may *mention* drizzle-kit push — we assert it's not
    // an actual CMD/RUN invocation.)
    let dockerfile = create_commonpub::template::render_dockerfile();
    assert!(dockerfile.contains("scripts/db-migrate.mjs"));
    assert!(dockerfile.contains("node scripts/db-migrate.mjs && node .output/server/index.mjs"));
    assert!(!dockerfile.contains("RUN drizzle-kit push"));
    assert!(!dockerfile.contains("drizzle-kit push &&"));
}

#[test]
fn package_json_pins_current_commonpub_versions() {
    // Regression: pins were ~18 minors stale (layer ^0.3.24 vs current
    // ^0.21.x). Scaffolded instances must install a CURRENT layer.
    let config = create_commonpub::prompts::InstanceConfig::with_defaults("ver-test");
    let pkg = create_commonpub::template::render_package_json(&config);

    // Exact pins (not loose `^0.21` prefixes): this test is the forcing
    // function for the RELEASE CHECKLIST — it must fail when template.rs
    // pins go stale after a publish, so update both together.
    assert!(pkg.contains("\"@commonpub/layer\": \"^0.27.0\""), "layer pin must be ^0.27.0");
    assert!(pkg.contains("\"@commonpub/server\": \"^2.61.0\""), "server pin must be ^2.61.0");
    assert!(pkg.contains("\"@commonpub/schema\": \"^0.20.0\""), "schema pin must be ^0.20.0");
    assert!(pkg.contains("\"@commonpub/config\": \"^0.15.0\""), "config pin must be ^0.15.0");

    assert!(pkg.contains("\"pg\""));
    assert!(pkg.contains("\"db:migrate\""));
}

#[test]
fn db_migrate_script_uses_migrate_not_push() {
    // The script uses drizzle-orm's migrate(); a cautionary comment
    // mentions `drizzle-kit push` as the thing to avoid, so we assert
    // the positive behaviour rather than the absence of the phrase.
    let script = create_commonpub::template::render_db_migrate_script();
    assert!(script.contains("drizzle-orm/node-postgres/migrator"));
    assert!(script.contains("migrate(db"));
    assert!(script.contains("@commonpub/schema/migrations"));
    assert!(script.contains("import { migrate }"));
}

#[test]
fn scaffold_writes_db_migrate_script() {
    let tmp = TempDir::new().unwrap();
    let config = create_commonpub::prompts::InstanceConfig::with_defaults("mig-test");
    create_commonpub::scaffold::create_instance_at(tmp.path(), "mig-test", &config).unwrap();
    let script = tmp.path().join("mig-test/scripts/db-migrate.mjs");
    assert!(script.exists(), "scripts/db-migrate.mjs must be scaffolded");
    assert!(fs::read_to_string(script).unwrap().contains("migrate(db"));
}

#[test]
fn env_documents_fed_token_key() {
    let config = create_commonpub::prompts::InstanceConfig::with_defaults("env-fed");
    let env = create_commonpub::template::render_env(&config);
    assert!(env.contains("CPUB_FED_TOKEN_KEY"));
}

/// Extract the value after `KEY=` on its own line (stdlib parser; no
/// regex dep). Returns the substring until the first newline.
fn extract_env_value<'a>(env: &'a str, key: &str) -> Option<&'a str> {
    let needle = format!("\n{}=", key);
    let start = env.find(&needle)? + needle.len();
    let end = env[start..].find('\n').map(|i| start + i).unwrap_or(env.len());
    Some(&env[start..end])
}

/// `NUXT_AUTH_SECRET` and `CPUB_FED_TOKEN_KEY` must be auto-generated
/// real values, not the old `change-me-in-production-min-32-chars`
/// placeholder. Asserts both keys are present with hex values of
/// the right length (64 hex chars = 32 bytes per RFC 8439 + Better
/// Auth's signing length).
#[test]
fn env_auto_generates_strong_secrets() {
    let config = create_commonpub::prompts::InstanceConfig::with_defaults("secret-test");
    let env = create_commonpub::template::render_env(&config);

    // No placeholder text — the old `change-me-...` value would silently
    // ship to production if not caught by this test.
    assert!(
        !env.contains("change-me-in-production"),
        "render_env must not emit the placeholder NUXT_AUTH_SECRET"
    );

    let auth = extract_env_value(&env, "NUXT_AUTH_SECRET")
        .expect("NUXT_AUTH_SECRET must be present");
    let fed = extract_env_value(&env, "CPUB_FED_TOKEN_KEY")
        .expect("CPUB_FED_TOKEN_KEY must be present");

    // 64 hex chars = 32 bytes. Both consumers require exactly this.
    assert_eq!(auth.len(), 64, "NUXT_AUTH_SECRET must be 64 hex chars; got: {}", auth);
    assert_eq!(fed.len(), 64, "CPUB_FED_TOKEN_KEY must be 64 hex chars; got: {}", fed);
    assert!(
        auth.chars().all(|c| c.is_ascii_hexdigit() && (c.is_ascii_digit() || c.is_ascii_lowercase())),
        "NUXT_AUTH_SECRET must be lowercase hex: {}", auth
    );
    assert!(
        fed.chars().all(|c| c.is_ascii_hexdigit() && (c.is_ascii_digit() || c.is_ascii_lowercase())),
        "CPUB_FED_TOKEN_KEY must be lowercase hex: {}", fed
    );

    // The two secrets must NOT be identical (would mean the RNG is
    // broken or the same value was reused).
    assert_ne!(auth, fed, "AUTH_SECRET and FED_TOKEN_KEY must differ");
}

/// Two consecutive scaffolds must produce DIFFERENT secrets — keys
/// MUST be per-instance (commonpub.io decrypting deveco.io's stored
/// OAuth tokens would be a major confidentiality failure).
#[test]
fn env_secrets_are_unique_per_scaffold() {
    let config = create_commonpub::prompts::InstanceConfig::with_defaults("uniq-test");
    let env_a = create_commonpub::template::render_env(&config);
    let env_b = create_commonpub::template::render_env(&config);

    let auth_a = extract_env_value(&env_a, "NUXT_AUTH_SECRET").unwrap();
    let auth_b = extract_env_value(&env_b, "NUXT_AUTH_SECRET").unwrap();
    let fed_a = extract_env_value(&env_a, "CPUB_FED_TOKEN_KEY").unwrap();
    let fed_b = extract_env_value(&env_b, "CPUB_FED_TOKEN_KEY").unwrap();

    assert_ne!(auth_a, auth_b, "successive AUTH_SECRET values must differ");
    assert_ne!(fed_a, fed_b, "successive FED_TOKEN_KEY values must differ");
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

// ── Admin bootstrap + one-click DigitalOcean deploy ─────────

#[test]
fn env_defaults_to_first_user_admin() {
    // No --admin-user → the frictionless one-click path: first
    // registered user becomes admin.
    let config = create_commonpub::prompts::InstanceConfig::with_defaults("admin-default");
    let env = create_commonpub::template::render_env(&config);
    assert!(env.contains("ADMIN_BOOTSTRAP_FIRST_USER=true"));
    assert!(!env.contains("ADMIN_BOOTSTRAP_USER=admin-default"));
    // .env.example documents both knobs.
    let ex = create_commonpub::template::render_env_example(&config);
    assert!(ex.contains("ADMIN_BOOTSTRAP_FIRST_USER=true"));
    assert!(ex.contains("ADMIN_BOOTSTRAP_USER="));
}

#[test]
fn env_pins_explicit_admin_user_when_set() {
    let mut config = create_commonpub::prompts::InstanceConfig::with_defaults("admin-set");
    config.admin_user = Some("alice".to_string());
    let env = create_commonpub::template::render_env(&config);
    // The active (non-comment) line is ADMIN_BOOTSTRAP_USER=alice.
    assert!(env.lines().any(|l| l.trim() == "ADMIN_BOOTSTRAP_USER=alice"));
    // No active first-user line. The doc comment legitimately *mentions*
    // `ADMIN_BOOTSTRAP_FIRST_USER=true` (prefixed with `#`), so we check
    // by exact trimmed line, not substring.
    assert!(!env.lines().any(|l| l.trim() == "ADMIN_BOOTSTRAP_FIRST_USER=true"));
}

#[test]
fn do_app_spec_is_valid() {
    let config = create_commonpub::prompts::InstanceConfig::with_defaults("do-test");
    let spec = create_commonpub::template::render_do_app_spec(&config);
    assert!(spec.starts_with("spec:"));
    assert!(spec.contains("dockerfile_path: Dockerfile"));
    assert!(spec.contains("http_path: /api/health"));
    assert!(spec.contains("${db.DATABASE_URL}"));
    assert!(spec.contains("engine: PG"));
    // Default = first-user admin (zero-config one-click).
    assert!(spec.contains("ADMIN_BOOTSTRAP_FIRST_USER"));
}

#[test]
fn do_app_spec_uses_explicit_admin_when_set() {
    let mut config = create_commonpub::prompts::InstanceConfig::with_defaults("do-admin");
    config.admin_user = Some("bob".to_string());
    let spec = create_commonpub::template::render_do_app_spec(&config);
    assert!(spec.contains("ADMIN_BOOTSTRAP_USER"));
    assert!(spec.contains("value: \"bob\""));
    assert!(!spec.contains("ADMIN_BOOTSTRAP_FIRST_USER"));
}

#[test]
fn scaffold_writes_do_deploy_template() {
    let tmp = TempDir::new().unwrap();
    let config = create_commonpub::prompts::InstanceConfig::with_defaults("do-scaffold");
    create_commonpub::scaffold::create_instance_at(tmp.path(), "do-scaffold", &config).unwrap();
    let spec = tmp.path().join("do-scaffold/.do/deploy.template.yaml");
    assert!(spec.exists(), ".do/deploy.template.yaml must be scaffolded");
    assert!(fs::read_to_string(spec).unwrap().contains("dockerfile_path: Dockerfile"));
}

#[test]
fn readme_has_deploy_to_do_button() {
    let config = create_commonpub::prompts::InstanceConfig::with_defaults("btn-test");
    let readme = create_commonpub::template::render_readme(&config);
    assert!(readme.contains("Deploy to DO"));
    assert!(readme.contains("cloud.digitalocean.com/apps/new"));
    assert!(readme.contains("first user to register becomes admin"));
}

#[test]
fn cli_admin_user_flag_writes_bootstrap_user() {
    use assert_cmd::Command;
    let tmp = TempDir::new().unwrap();
    Command::cargo_bin("create-commonpub")
        .unwrap()
        .current_dir(tmp.path())
        .args(&["new", "flagadmin", "--admin-user", "carol", "--no-docker"])
        .assert()
        .success();
    let env = fs::read_to_string(tmp.path().join("flagadmin/.env")).unwrap();
    assert!(env.contains("ADMIN_BOOTSTRAP_USER=carol"));
    let readme = fs::read_to_string(tmp.path().join("flagadmin/README.md")).unwrap();
    assert!(readme.contains("`carol`"));
}

#[test]
fn env_example_uses_bare_s3_vars_with_cdn_recipe() {
    // Regression: the storage adapter reads bare process.env.S3_* — Nuxt
    // does NOT map NUXT_S3_* into process.env, so the old NUXT_S3_*
    // example was inert (silently no S3). Must emit bare S3_* + a
    // DO Spaces CDN recipe.
    let config = create_commonpub::prompts::InstanceConfig::with_defaults("s3test");
    let env = create_commonpub::template::render_env(&config);
    assert!(env.contains("S3_BUCKET="), "must document bare S3_BUCKET");
    assert!(env.contains("S3_CDN=true"), "must document the DO Spaces CDN knob");
    assert!(!env.contains("NUXT_S3_"), "NUXT_S3_* is inert — must not be emitted");
}
