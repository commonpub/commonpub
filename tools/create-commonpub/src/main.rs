use clap::{Parser, Subcommand};

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
    },
    /// Initialize a CommonPub instance in the current directory
    Init {
        /// Skip interactive prompts and use defaults
        #[arg(long)]
        defaults: bool,
    },
}

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::New { name, defaults } => {
            let config = if defaults {
                prompts::InstanceConfig::with_defaults(&name)
            } else {
                match prompts::prompt_config(&name) {
                    Ok(c) => c,
                    Err(e) => {
                        eprintln!("Error reading input: {}", e);
                        std::process::exit(1);
                    }
                }
            };
            match scaffold::create_instance(&name, &config) {
                Ok(path) => {
                    println!("\n✅ Created CommonPub instance '{}' at {}", name, path.display());
                    println!("\nNext steps:");
                    println!("  cd {}", name);
                    println!("  docker compose up -d");
                    println!("  pnpm install && pnpm dev");
                }
                Err(e) => {
                    eprintln!("Error creating instance: {}", e);
                    std::process::exit(1);
                }
            }
        }
        Commands::Init { defaults } => {
            let name = std::env::current_dir()
                .ok()
                .and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_string()))
                .unwrap_or_else(|| "cpub-instance".to_string());
            let config = if defaults {
                prompts::InstanceConfig::with_defaults(&name)
            } else {
                match prompts::prompt_config(&name) {
                    Ok(c) => c,
                    Err(e) => {
                        eprintln!("Error reading input: {}", e);
                        std::process::exit(1);
                    }
                }
            };
            match scaffold::init_instance(&config) {
                Ok(_) => {
                    println!("\n✅ Initialized CommonPub instance in current directory");
                    println!("\nNext steps:");
                    println!("  docker compose up -d");
                    println!("  pnpm install && pnpm dev");
                }
                Err(e) => {
                    eprintln!("Error initializing instance: {}", e);
                    std::process::exit(1);
                }
            }
        }
    }
}
