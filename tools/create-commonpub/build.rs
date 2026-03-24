use std::fs;
use std::path::Path;

fn main() {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let reference_src = Path::new(&manifest_dir).join("../../apps/reference");
    let reference_dest = Path::new(&manifest_dir).join("reference-app");

    // Only copy if source exists (monorepo context) and dest is stale/missing
    if reference_src.exists() {
        // Remove old snapshot
        if reference_dest.exists() {
            let _ = fs::remove_dir_all(&reference_dest);
        }
        copy_dir_filtered(&reference_src, &reference_dest).expect("Failed to copy reference app");
    }

    println!("cargo:rerun-if-changed=../../apps/reference");
}

fn copy_dir_filtered(src: &Path, dest: &Path) -> std::io::Result<()> {
    static SKIP: &[&str] = &[
        "node_modules", ".nuxt", ".output", ".stryker-tmp",
        "uploads", ".env", "__tests__", "e2e", "scripts",
        "vitest.config.ts",
    ];

    fs::create_dir_all(dest)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let name = entry.file_name();
        let name_str = name.to_str().unwrap_or("");

        if SKIP.contains(&name_str) {
            continue;
        }

        let src_path = entry.path();
        let dest_path = dest.join(&name);

        if src_path.is_dir() {
            copy_dir_filtered(&src_path, &dest_path)?;
        } else {
            fs::copy(&src_path, &dest_path)?;
        }
    }

    Ok(())
}
