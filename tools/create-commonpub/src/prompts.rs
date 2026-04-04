use dialoguer::{theme::ColorfulTheme, Confirm, Input, FuzzySelect, MultiSelect};

#[derive(Debug, Clone)]
pub struct InstanceConfig {
    pub name: String,
    pub domain: String,
    pub description: String,
    pub database_url: String,
    pub redis_url: String,
    pub theme: String,
    // Feature flags (aligned with @commonpub/config FeatureFlags)
    pub feature_content: bool,
    pub feature_social: bool,
    pub feature_hubs: bool,
    pub feature_docs: bool,
    pub feature_video: bool,
    pub feature_contests: bool,
    pub feature_learning: bool,
    pub feature_explainers: bool,
    pub feature_federation: bool,
    pub feature_admin: bool,
    // Contest permissions: "open", "staff", or "admin"
    pub contest_creation: String,
    // Content types to enable
    pub content_types: Vec<String>,
    // Auth methods
    pub auth_email_password: bool,
    pub auth_magic_link: bool,
    pub auth_passkeys: bool,
    pub auth_github: bool,
    pub auth_google: bool,
    // Infra
    pub use_docker: bool,
}

impl InstanceConfig {
    pub fn with_defaults(name: &str) -> Self {
        Self {
            name: sanitize_value(name),
            domain: format!("{}.localhost", sanitize_value(name)),
            description: format!("A CommonPub community: {}", sanitize_value(name)),
            database_url: "postgresql://commonpub:commonpub_dev@localhost:5432/commonpub".to_string(),
            redis_url: "redis://localhost:6379".to_string(),
            theme: "base".to_string(),
            feature_content: true,
            feature_social: true,
            feature_hubs: true,
            feature_docs: true,
            feature_video: true,
            feature_contests: false,
            feature_learning: true,
            feature_explainers: true,
            feature_federation: false,
            feature_admin: false,
            contest_creation: "admin".to_string(),
            content_types: vec!["project".to_string(), "article".to_string(), "blog".to_string(), "explainer".to_string()],
            auth_email_password: true,
            auth_magic_link: false,
            auth_passkeys: false,
            auth_github: false,
            auth_google: false,
            use_docker: true,
        }
    }
}

/// Remove control characters and newlines from user input to prevent injection
pub fn sanitize_value(input: &str) -> String {
    input
        .chars()
        .filter(|c| !c.is_control())
        .collect::<String>()
        .replace('\'', "")
}

pub fn prompt_config(name: &str) -> Result<InstanceConfig, Box<dyn std::error::Error>> {
    let theme = ColorfulTheme::default();

    println!("\n  ┌─ CommonPub Setup ─────────────────────┐");
    println!("  │  Let's configure your instance.        │");
    println!("  └────────────────────────────────────────┘\n");

    // ── Instance identity ──────────────────────────────────

    let instance_name: String = Input::with_theme(&theme)
        .with_prompt("Instance name")
        .default(name.to_string())
        .interact_text()?;
    let instance_name = sanitize_value(&instance_name);

    let domain: String = Input::with_theme(&theme)
        .with_prompt("Domain")
        .default(format!("{}.localhost", name))
        .interact_text()?;
    let domain = sanitize_value(&domain);

    let description: String = Input::with_theme(&theme)
        .with_prompt("Description")
        .default(format!("A CommonPub community: {}", name))
        .interact_text()?;
    let description = sanitize_value(&description);

    // ── Theme ──────────────────────────────────────────────

    let themes = ["base", "dark", "generics", "agora", "agora-dark"];
    let theme_idx = FuzzySelect::with_theme(&theme)
        .with_prompt("Theme")
        .items(&themes)
        .default(0)
        .interact()?;

    // ── Infrastructure ─────────────────────────────────────

    let use_docker = Confirm::with_theme(&theme)
        .with_prompt("Include Docker Compose? (Postgres, Redis, Meilisearch)")
        .default(true)
        .interact()?;

    let database_url: String = if use_docker {
        "postgresql://commonpub:commonpub_dev@localhost:5432/commonpub".to_string()
    } else {
        Input::with_theme(&theme)
            .with_prompt("Database URL")
            .default("postgresql://commonpub:commonpub_dev@localhost:5432/commonpub".to_string())
            .interact_text()?
    };

    let redis_url: String = if use_docker {
        "redis://localhost:6379".to_string()
    } else {
        Input::with_theme(&theme)
            .with_prompt("Redis URL")
            .default("redis://localhost:6379".to_string())
            .interact_text()?
    };

    // ── Features ───────────────────────────────────────────

    println!("\n  Features — select what to enable:");

    let feature_items = vec![
        ("Content system (CRUD, publishing, slugs)", true),
        ("Social (likes, comments, bookmarks)", true),
        ("Hubs (communities, feeds, moderation)", true),
        ("Docs (CodeMirror editor, versioning)", true),
        ("Video content type", true),
        ("Contests", false),
        ("Learning paths (enrollment, progress)", true),
        ("Explainers (interactive modules)", true),
        ("Federation (ActivityPub)", false),
        ("Admin panel (user mgmt, reports)", false),
    ];
    let feature_labels: Vec<&str> = feature_items.iter().map(|(l, _)| *l).collect();
    let feature_defaults: Vec<bool> = feature_items.iter().map(|(_, d)| *d).collect();

    let selected = MultiSelect::with_theme(&theme)
        .with_prompt("Features")
        .items(&feature_labels)
        .defaults(&feature_defaults)
        .interact()?;

    let feature_content = selected.contains(&0);
    let feature_social = selected.contains(&1);
    let feature_hubs = selected.contains(&2);
    let feature_docs = selected.contains(&3);
    let feature_video = selected.contains(&4);
    let feature_contests = selected.contains(&5);
    let feature_learning = selected.contains(&6);
    let feature_explainers = selected.contains(&7);
    let feature_federation = selected.contains(&8);
    let feature_admin = selected.contains(&9);

    // ── Content types ─────────────────────────────────────

    let content_types = if feature_content {
        println!("\n  Content types — select what content can be created:");

        let ct_items = [
            ("Projects", true),
            ("Articles", true),
            ("Blogs", true),
            ("Explainers", true),
        ];
        let ct_labels: Vec<&str> = ct_items.iter().map(|(l, _)| *l).collect();
        let ct_defaults: Vec<bool> = ct_items.iter().map(|(_, d)| *d).collect();

        let ct_selected = MultiSelect::with_theme(&theme)
            .with_prompt("Content types")
            .items(&ct_labels)
            .defaults(&ct_defaults)
            .interact()?;

        let type_names = ["project", "article", "blog", "explainer"];
        ct_selected.iter().map(|&i| type_names[i].to_string()).collect()
    } else {
        vec![]
    };

    // ── Contest permissions ───────────────────────────────

    let contest_creation = if feature_contests {
        let options = ["admin — only admins", "staff — staff and admins", "open — any user"];
        let idx = FuzzySelect::with_theme(&theme)
            .with_prompt("Who can create contests?")
            .items(&options)
            .default(0)
            .interact()?;
        match idx {
            0 => "admin",
            1 => "staff",
            _ => "open",
        }.to_string()
    } else {
        "admin".to_string()
    };

    // ── Auth methods ───────────────────────────────────────

    println!("\n  Authentication — select sign-in methods:");

    let auth_items = [
        ("Email / password", true),
        ("Magic link (passwordless email)", false),
        ("Passkeys (WebAuthn)", false),
        ("GitHub OAuth", false),
        ("Google OAuth", false),
    ];
    let auth_labels: Vec<&str> = auth_items.iter().map(|(l, _)| *l).collect();
    let auth_defaults: Vec<bool> = auth_items.iter().map(|(_, d)| *d).collect();

    let auth_selected = MultiSelect::with_theme(&theme)
        .with_prompt("Auth methods")
        .items(&auth_labels)
        .defaults(&auth_defaults)
        .interact()?;

    let auth_email_password = auth_selected.contains(&0);
    let auth_magic_link = auth_selected.contains(&1);
    let auth_passkeys = auth_selected.contains(&2);
    let auth_github = auth_selected.contains(&3);
    let auth_google = auth_selected.contains(&4);

    Ok(InstanceConfig {
        name: instance_name,
        domain,
        description,
        database_url,
        redis_url,
        theme: themes[theme_idx].to_string(),
        feature_content,
        feature_social,
        feature_hubs,
        feature_docs,
        feature_video,
        feature_contests,
        feature_learning,
        feature_explainers,
        feature_federation,
        feature_admin,
        contest_creation,
        content_types,
        auth_email_password,
        auth_magic_link,
        auth_passkeys,
        auth_github,
        auth_google,
        use_docker,
    })
}
