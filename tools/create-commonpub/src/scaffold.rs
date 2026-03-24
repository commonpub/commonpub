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

    let nuxt_config = template::render_nuxt_config(config);
    fs::write(dir.join("nuxt.config.ts"), nuxt_config)?;

    let package_json = template::render_package_json(config);
    fs::write(dir.join("package.json"), package_json)?;

    let tsconfig = template::render_tsconfig();
    fs::write(dir.join("tsconfig.json"), tsconfig)?;

    let app_vue = template::render_app_vue(config);
    fs::write(dir.join("app.vue"), app_vue)?;

    if config.use_docker {
        let compose = template::render_docker_compose(config);
        fs::write(dir.join("docker-compose.yml"), compose)?;
    }

    // Nuxt 3 directory structure
    fs::create_dir_all(dir.join("pages"))?;
    fs::create_dir_all(dir.join("components"))?;
    fs::create_dir_all(dir.join("composables"))?;
    fs::create_dir_all(dir.join("layouts"))?;
    fs::create_dir_all(dir.join("server/api"))?;
    fs::create_dir_all(dir.join("server/utils"))?;
    fs::create_dir_all(dir.join("server/middleware"))?;
    fs::create_dir_all(dir.join("public"))?;
    fs::create_dir_all(dir.join("uploads"))?;

    // Server utils
    fs::write(dir.join("server/utils/config.ts"), template::render_server_config())?;
    fs::write(dir.join("server/utils/db.ts"), template::render_server_db())?;
    fs::write(dir.join("server/utils/auth.ts"), template::render_server_auth())?;
    fs::write(dir.join("server/utils/validate.ts"), template::render_server_validate())?;
    fs::write(dir.join("server/utils/errors.ts"), template::render_server_errors())?;

    // Server middleware
    fs::write(dir.join("server/middleware/auth.ts"), template::render_middleware_auth())?;
    fs::write(dir.join("server/middleware/security.ts"), template::render_middleware_security())?;

    // Plugins
    fs::create_dir_all(dir.join("plugins"))?;
    fs::write(dir.join("plugins/auth.ts"), template::render_plugin_auth())?;

    // Composables
    fs::write(dir.join("composables/useAuth.ts"), template::render_composable_auth())?;

    // Default layout
    fs::write(dir.join("layouts/default.vue"), template::render_default_layout(config))?;

    // Index page
    fs::write(dir.join("pages/index.vue"), template::render_index_page(config))?;

    // .gitignore
    fs::write(dir.join(".gitignore"), template::render_gitignore())?;

    // Uploads placeholder
    fs::write(dir.join("uploads/.gitkeep"), "")?;

    // README
    let readme = format!("# {}\n\n{}\n\nPowered by [CommonPub](https://commonpub.dev).\n", config.name, config.description);
    fs::write(dir.join("README.md"), readme)?;

    Ok(())
}
