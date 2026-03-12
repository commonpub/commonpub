use std::fs;
use tempfile::TempDir;

#[test]
fn scaffold_creates_directory_structure() {
    let tmp = TempDir::new().unwrap();

    let config = create_commonpub::prompts::InstanceConfig::with_defaults("test-instance");
    let result = create_commonpub::scaffold::create_instance_at(tmp.path(), "test-instance", &config);
    assert!(result.is_ok());

    let instance_dir = tmp.path().join("test-instance");
    assert!(instance_dir.join(".env").exists());
    assert!(instance_dir.join("commonpub.config.ts").exists());
    assert!(instance_dir.join("package.json").exists());
    assert!(instance_dir.join("docker-compose.yml").exists());
    assert!(instance_dir.join("src/routes").exists());
    assert!(instance_dir.join("src/lib").exists());
}

#[test]
fn scaffold_without_docker_skips_compose() {
    let tmp = TempDir::new().unwrap();

    let mut config = create_commonpub::prompts::InstanceConfig::with_defaults("no-docker");
    config.use_docker = false;
    let result = create_commonpub::scaffold::create_instance_at(tmp.path(), "no-docker", &config);
    assert!(result.is_ok());

    let instance_dir = tmp.path().join("no-docker");
    assert!(instance_dir.join(".env").exists());
    assert!(!instance_dir.join("docker-compose.yml").exists());
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
}

#[test]
fn generated_env_has_correct_values() {
    let config = create_commonpub::prompts::InstanceConfig::with_defaults("my-community");
    let env = create_commonpub::template::render_env(&config);

    assert!(env.contains("INSTANCE_NAME=my-community"));
    assert!(env.contains("INSTANCE_DOMAIN=my-community.localhost"));
    assert!(env.contains("FEATURE_COMMUNITIES=true"));
    assert!(env.contains("FEATURE_FEDERATION=false"));
}

#[test]
fn generated_config_is_valid_structure() {
    let config = create_commonpub::prompts::InstanceConfig::with_defaults("my-community");
    let ts_config = create_commonpub::template::render_config(&config);

    assert!(ts_config.contains("defineCommonPubConfig"));
    assert!(ts_config.contains("name: 'my-community'"));
    assert!(ts_config.contains("theme: 'base'"));
}
