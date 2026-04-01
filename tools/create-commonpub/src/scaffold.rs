use std::fs;
use std::path::{Path, PathBuf};

use crate::prompts::InstanceConfig;
use crate::template;

pub fn create_instance(name: &str, config: &InstanceConfig) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let path = PathBuf::from(name);
    if path.exists() {
        return Err(format!("Directory '{}' already exists", name).into());
    }
    fs::create_dir_all(&path)?;
    write_instance(&path, config)?;
    Ok(fs::canonicalize(&path)?)
}

pub fn create_instance_at(base: &Path, name: &str, config: &InstanceConfig) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let path = base.join(name);
    if path.exists() {
        return Err(format!("Directory '{}' already exists", path.display()).into());
    }
    fs::create_dir_all(&path)?;
    write_instance(&path, config)?;
    Ok(fs::canonicalize(&path)?)
}

pub fn init_instance(config: &InstanceConfig) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let path = PathBuf::from(".");
    write_instance(&path, config)?;
    Ok(fs::canonicalize(&path)?)
}

pub fn init_instance_at(dir: &Path, config: &InstanceConfig) -> Result<PathBuf, Box<dyn std::error::Error>> {
    write_instance(dir, config)?;
    Ok(fs::canonicalize(dir)?)
}

fn write_instance(dir: &Path, config: &InstanceConfig) -> Result<(), Box<dyn std::error::Error>> {
    // Create directory structure
    fs::create_dir_all(dir.join("assets"))?;
    fs::create_dir_all(dir.join("components"))?;
    fs::create_dir_all(dir.join("server/utils"))?;
    fs::create_dir_all(dir.join("public"))?;
    fs::create_dir_all(dir.join("uploads"))?;
    fs::write(dir.join("uploads/.gitkeep"), "")?;

    // Core config files
    fs::write(dir.join("package.json"), template::render_package_json(config))?;
    fs::write(dir.join("nuxt.config.ts"), template::render_nuxt_config(config))?;
    fs::write(dir.join("commonpub.config.ts"), template::render_config(config))?;
    fs::write(dir.join("server/utils/config.ts"), template::render_server_config())?;
    fs::write(dir.join("tsconfig.json"), template::render_tsconfig())?;

    // Branding
    fs::write(dir.join("components/SiteLogo.vue"), template::render_site_logo(config))?;
    fs::write(dir.join("assets/theme.css"), template::render_theme_css(config))?;
    fs::write(dir.join("public/favicon.svg"), template::render_favicon())?;

    // Environment
    fs::write(dir.join(".env"), template::render_env(config))?;
    fs::write(dir.join(".env.example"), template::render_env_example(config))?;

    // Deployment
    fs::write(dir.join("Dockerfile"), template::render_dockerfile())?;
    if config.use_docker {
        fs::write(dir.join("docker-compose.yml"), template::render_docker_compose(config))?;
    }
    fs::create_dir_all(dir.join(".github/workflows"))?;
    fs::write(dir.join(".github/workflows/deploy.yml"), template::render_deploy_workflow(config))?;

    // Database
    fs::write(dir.join("drizzle.config.ts"), template::render_drizzle_config(config))?;

    // Misc
    fs::write(dir.join(".gitignore"), template::render_gitignore())?;
    fs::write(dir.join("README.md"), template::render_readme(config))?;

    Ok(())
}
