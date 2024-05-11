## 0. 前情提要
- 本页面适用于 `MacOS` 和 `Linux` 用户，请甄别您的系统类型  
- 本页面使用 `清华大学开源软件站` 驱动，您可自行更换软件源  
- 本页的所有命令均在 `终端` 内运行  
    - 如果您是 `MacOS` 操作系统（苹果电脑）用户  
        1. 进入 `控制台` 打开 `终端` 应用，或 ++cmd+spc++ 搜索 `终端` 并打开  
        2. 如您看到一个白色窗口，则打开成功，下述命令都将在此处执行  
        3. 请使用指令 `uname -m` 来获取您的 `系统架构`  
    - 如果您是 `Linux` 操作系统用户，请在应用菜单界面找到 `终端` 等字样的应用程序，下述命令都将在此处执行  
## 1. 准备措施  
对于 `MacOS` 用户，您需要额外输入命令执行此步骤，`Linux` 用户可以跳过  
```bash
xcode-select --install
```
完成后输入指令  
```bash
export HOMEBREW_INSTALL_FROM_API=1
export HOMEBREW_API_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api"
export HOMEBREW_BOTTLE_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles"
export HOMEBREW_BREW_GIT_REMOTE="https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/brew.git"
export HOMEBREW_CORE_GIT_REMOTE="https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/homebrew-core.git"
```
## 2. 安装  
请执行如下指令  
```bash
git clone --depth=1 https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/install.git brew-install
/bin/bash brew-install/install.sh
rm -rf brew-install
```
## 3. 添加环境变量  
- 如果您是 `MacOS` 用户且 `系统架构` 是 `arm64`，请执行如下指令  
    ```bash
    test -r ~/.bash_profile && echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.bash_profile
    test -r ~/.zprofile && echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    ```
- 如果您是 `MacOS` 用户且 `系统架构` 是 `x86_64`，您可以跳过此步骤  
- 如果您是 `Linux` 用户，请执行如下指令  
    ```bash
    test -d ~/.linuxbrew && eval "$(~/.linuxbrew/bin/brew shellenv)"
    test -d /home/linuxbrew/.linuxbrew && eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
    test -r ~/.bash_profile && echo "eval \"\$($(brew --prefix)/bin/brew shellenv)\"" >> ~/.bash_profile
    test -r ~/.profile && echo "eval \"\$($(brew --prefix)/bin/brew shellenv)\"" >> ~/.profile
    test -r ~/.zprofile && echo "eval \"\$($(brew --prefix)/bin/brew shellenv)\"" >> ~/.zprofile
    ```