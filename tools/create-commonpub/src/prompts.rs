use dialoguer::{theme::ColorfulTheme, Confirm, Input, FuzzySelect};

#[derive(Debug, Clone)]
pub struct InstanceConfig {
    pub name: String,
    pub domain: String,
    pub description: String,
    pub database_url: String,
    pub redis_url: String,
    pub theme: String,
    pub feature_communities: bool,
    pub feature_docs: bool,
    pub feature_learning: bool,
    pub feature_explainers: bool,
    pub feature_federation: bool,
    pub feature_admin: bool,
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
            feature_communities: true,
            feature_docs: true,
            feature_learning: true,
            feature_explainers: true,
            feature_federation: false,
            feature_admin: false,
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

    let themes = vec!["base", "deepwood", "hackbuild", "deveco"];
    let theme_idx = FuzzySelect::with_theme(&theme)
        .with_prompt("Theme")
        .items(&themes)
        .default(0)
        .interact()?;

    let use_docker = Confirm::with_theme(&theme)
        .with_prompt("Include Docker Compose?")
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

    let feature_communities = Confirm::with_theme(&theme)
        .with_prompt("Enable Communities?")
        .default(true)
        .interact()?;

    let feature_docs = Confirm::with_theme(&theme)
        .with_prompt("Enable Docs?")
        .default(true)
        .interact()?;

    let feature_learning = Confirm::with_theme(&theme)
        .with_prompt("Enable Learning paths?")
        .default(true)
        .interact()?;

    let feature_explainers = Confirm::with_theme(&theme)
        .with_prompt("Enable Explainers?")
        .default(true)
        .interact()?;

    let feature_federation = Confirm::with_theme(&theme)
        .with_prompt("Enable Federation?")
        .default(false)
        .interact()?;

    let feature_admin = Confirm::with_theme(&theme)
        .with_prompt("Enable Admin panel?")
        .default(false)
        .interact()?;

    Ok(InstanceConfig {
        name: instance_name,
        domain,
        description,
        database_url,
        redis_url,
        theme: themes[theme_idx].to_string(),
        feature_communities,
        feature_docs,
        feature_learning,
        feature_explainers,
        feature_federation,
        feature_admin,
        use_docker,
    })
}
