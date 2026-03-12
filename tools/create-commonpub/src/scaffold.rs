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
    write_files(&path, config)?;
    Ok(fs::canonicalize(&path)?)
}

pub fn create_instance_at(base: &Path, name: &str, config: &InstanceConfig) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let path = base.join(name);
    if path.exists() {
        return Err(format!("Directory '{}' already exists", path.display()).into());
    }
    fs::create_dir_all(&path)?;
    write_files(&path, config)?;
    Ok(fs::canonicalize(&path)?)
}

pub fn init_instance(config: &InstanceConfig) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let path = PathBuf::from(".");
    write_files(&path, config)?;
    Ok(fs::canonicalize(&path)?)
}

pub fn init_instance_at(dir: &Path, config: &InstanceConfig) -> Result<PathBuf, Box<dyn std::error::Error>> {
    write_files(dir, config)?;
    Ok(fs::canonicalize(dir)?)
}

fn write_files(dir: &Path, config: &InstanceConfig) -> Result<(), Box<dyn std::error::Error>> {
    // Generate and write each file
    let env_content = template::render_env(config);
    fs::write(dir.join(".env"), env_content)?;

    let config_content = template::render_config(config);
    fs::write(dir.join("commonpub.config.ts"), config_content)?;

    let package_json = template::render_package_json(config);
    fs::write(dir.join("package.json"), package_json)?;

    if config.use_docker {
        let compose = template::render_docker_compose(config);
        fs::write(dir.join("docker-compose.yml"), compose)?;
    }

    // Create directory structure
    fs::create_dir_all(dir.join("src/routes"))?;
    fs::create_dir_all(dir.join("src/lib"))?;
    fs::create_dir_all(dir.join("static"))?;

    // Write a basic README
    let readme = format!("# {}\n\n{}\n\nPowered by [CommonPub](https://commonpub.dev).\n", config.name, config.description);
    fs::write(dir.join("README.md"), readme)?;

    Ok(())
}
