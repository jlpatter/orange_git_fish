# Oxidized Git

## Note: This project is still under construction and doesn't have a release version yet!
You are free to compile the project and try it if you want, but there are still a bunch of things I want to fix/add before the full release! I'm also planning on setting up a website for the project and getting proper code signing and such so stay tuned!

## Usage
### Windows
* Install WebView2 https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download-section
### Linux
* You may need to install the equivalent of WebView2 on Linux (if you're having trouble getting it work, maybe try installing dependencies listed here: https://tauri.app/v1/guides/getting-started/prerequisites#setting-up-linux)
* Make sure you have gnome-keyring installed and libsecret. If it isn't working, make sure you've created a default keyring in it!

## For Development
### Windows
* Install the Microsoft Visual Studio C++ build tools https://visualstudio.microsoft.com/visual-cpp-build-tools/
* Install WebView2 https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download-section
* Install Rust https://www.rust-lang.org/tools/install
* Install NodeJS https://nodejs.org/en/
### Mac
* Install xcode
* Install homebrew
* Install Rust: https://www.rust-lang.org/tools/install
* Install NodeJS: `brew install node`
### Linux
#### Debian-based distros (Untested)
* Install Tauri dependencies: https://tauri.app/v1/guides/getting-started/prerequisites
* Install Rust: https://www.rust-lang.org/tools/install
* Install NodeJS: `sudo apt install nodejs npm`
#### Arch-based distros
* Install Tauri dependencies: https://tauri.app/v1/guides/getting-started/prerequisites
* Install Rust: https://www.rust-lang.org/tools/install
* Install NodeJS: `sudo pacman -S nodejs npm`
### All
* Create the `(project root)/ui/dist` directory (so tauri doesn't get confused when compiling)
* Run `cargo install tauri-cli`
* Run `npm install` inside the `ui` directory
* Run `cargo tauri dev` in the project root to run the dev environment or `cargo tauri build` to package the application
### Making a Release
For creating release packages, you will need to set the `TAURI_PRIVATE_KEY` and `TAURI_KEY_PASSWORD` environment variable to sign updates

There are 2 places that the version number needs to be updated BEFORE pushing the version tag (which should kick off the pipelines that create a GitHub release):
* `src-tauri/Cargo.toml`
* `src-tauri/tauri.conf.json`

Once the GitHub release has been created and published (which you have to do manually), you'll need to update the `version`
field and the `signature` fields (by copying the signatures generated in the associated `.sig` files) in `current_version.json`
and push it up (so that the tauri updater will automatically download from the new release):
