use clap::{Args, Parser, Subcommand};

mod prompts;
mod scaffold;
mod template;

#[derive(Parser)]
#[command(name = "create-commonpub", version, about = "Scaffold a new CommonPub instance")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Create a new CommonPub instance in a new directory
    New {
        /// Name of the instance
        name: String,
        /// Skip interactive prompts and use defaults
        #[arg(long)]
        defaults: bool,
        #[command(flatten)]
        opts: SharedOpts,
    },
    /// Initialize a CommonPub instance in the current directory
    Init {
        /// Skip interactive prompts and use defaults
        #[arg(long)]
        defaults: bool,
        #[command(flatten)]
        opts: SharedOpts,
    },
}

#[derive(Args, Debug)]
struct SharedOpts {
    /// Features to enable (comma-separated: content,social,hubs,docs,video,contests,learning,explainers,federation,admin)
    #[arg(long, value_delimiter = ',')]
    features: Option<Vec<String>>,

    /// Content types to enable (comma-separated: project,article,blog,explainer)
    #[arg(long = "content-types", value_delimiter = ',')]
    content_types: Option<Vec<String>>,

    /// Auth methods to enable (comma-separated: email-password,magic-link,passkeys,github,google)
    #[arg(long, value_delimiter = ',')]
    auth: Option<Vec<String>>,

    /// Who can create contests: open, staff, or admin
    #[arg(long = "contest-creation")]
    contest_creation: Option<String>,

    /// Theme: base, dark, generics, agora, or agora-dark
    #[arg(long)]
    theme: Option<String>,

    /// Domain for the instance
    #[arg(long)]
    domain: Option<String>,

    /// Description for the instance
    #[arg(long)]
    description: Option<String>,

    /// Skip Docker Compose generation
    #[arg(long = "no-docker")]
    no_docker: bool,
}

fn apply_overrides(config: &mut prompts::InstanceConfig, opts: &SharedOpts) {
    if let Some(ref domain) = opts.domain {
        config.domain = prompts::sanitize_value(domain);
    }
    if let Some(ref desc) = opts.description {
        config.description = prompts::sanitize_value(desc);
    }
    if let Some(ref theme) = opts.theme {
        config.theme = theme.clone();
    }
    if opts.no_docker {
        config.use_docker = false;
    }
    if let Some(ref contest) = opts.contest_creation {
        config.contest_creation = contest.clone();
    }
    if let Some(ref ct) = opts.content_types {
        config.content_types = ct.iter().map(|s| s.trim().to_string()).collect();
    }

    // When --features is provided, set ALL to false first, then enable only the listed ones
    if let Some(ref features) = opts.features {
        config.feature_content = false;
        config.feature_social = false;
        config.feature_hubs = false;
        config.feature_docs = false;
        config.feature_video = false;
        config.feature_contests = false;
        config.feature_learning = false;
        config.feature_explainers = false;
        config.feature_federation = false;
        config.feature_admin = false;

        for f in features {
            match f.trim() {
                "content" => config.feature_content = true,
                "social" => config.feature_social = true,
                "hubs" => config.feature_hubs = true,
                "docs" => config.feature_docs = true,
                "video" => config.feature_video = true,
                "contests" => config.feature_contests = true,
                "learning" => config.feature_learning = true,
                "explainers" => config.feature_explainers = true,
                "federation" => config.feature_federation = true,
                "admin" => config.feature_admin = true,
                other => {
                    eprintln!("Unknown feature: '{}'. Valid: content, social, hubs, docs, video, contests, learning, explainers, federation, admin", other);
                    std::process::exit(1);
                }
            }
        }
    }

    // When --auth is provided, set ALL to false first, then enable only the listed ones
    if let Some(ref auth) = opts.auth {
        config.auth_email_password = false;
        config.auth_magic_link = false;
        config.auth_passkeys = false;
        config.auth_github = false;
        config.auth_google = false;

        for a in auth {
            match a.trim() {
                "email-password" => config.auth_email_password = true,
                "magic-link" => config.auth_magic_link = true,
                "passkeys" => config.auth_passkeys = true,
                "github" => config.auth_github = true,
                "google" => config.auth_google = true,
                other => {
                    eprintln!("Unknown auth method: '{}'. Valid: email-password, magic-link, passkeys, github, google", other);
                    std::process::exit(1);
                }
            }
        }
    }
}

fn has_any_flags(opts: &SharedOpts) -> bool {
    opts.features.is_some()
        || opts.content_types.is_some()
        || opts.auth.is_some()
        || opts.contest_creation.is_some()
        || opts.theme.is_some()
        || opts.domain.is_some()
        || opts.description.is_some()
        || opts.no_docker
}

fn resolve_config(name: &str, defaults: bool, opts: &SharedOpts) -> prompts::InstanceConfig {
    if defaults || has_any_flags(opts) {
        let mut config = prompts::InstanceConfig::with_defaults(name);
        apply_overrides(&mut config, opts);
        config
    } else {
        match prompts::prompt_config(name) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("Error reading input: {}", e);
                std::process::exit(1);
            }
        }
    }
}

fn print_next_steps(name: Option<&str>, config: &prompts::InstanceConfig) {
    if let Some(n) = name {
        println!("\n✅ Created CommonPub instance '{}'\n", n);
        println!("Next steps:");
        println!("  cd {}", n);
    } else {
        println!("\n✅ Initialized CommonPub instance\n");
        println!("Next steps:");
    }
    if config.use_docker {
        println!("  docker compose up -d    # Postgres, Redis, Meilisearch");
    }
    println!("  pnpm install");
    println!("  pnpm db:push             # Push schema to database");
    println!("  pnpm dev                 # Start Nuxt dev server");
}

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::New { name, defaults, opts } => {
            let config = resolve_config(&name, defaults, &opts);
            match scaffold::create_instance(&name, &config) {
                Ok(_) => print_next_steps(Some(&name), &config),
                Err(e) => {
                    eprintln!("Error creating instance: {}", e);
                    std::process::exit(1);
                }
            }
        }
        Commands::Init { defaults, opts } => {
            let name = std::env::current_dir()
                .ok()
                .and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_string()))
                .unwrap_or_else(|| "cpub-instance".to_string());
            let config = resolve_config(&name, defaults, &opts);
            match scaffold::init_instance(&config) {
                Ok(_) => print_next_steps(None, &config),
                Err(e) => {
                    eprintln!("Error initializing instance: {}", e);
                    std::process::exit(1);
                }
            }
        }
    }
}
