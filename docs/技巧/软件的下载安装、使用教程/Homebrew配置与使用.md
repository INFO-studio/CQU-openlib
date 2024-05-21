## 0. 前情提要  
- 类似 `{xxx}` 大括号内不以叹号 `!` 开头的是每个人不同的，您需要根据您的情况进行修改  
- 类似 `{!xxx}` 大括号内以叹号 `!` 开头的是每个人不同的，但是无需修改，您只需要执行描述的操作即可  
- 本页面适用于 `MacOS` 和 `Linux` 用户，请甄别您的系统类型  
- 本页面使用 `清华大学开源软件站` 驱动，您可自行更换软件源  
- 前置知识
    - []
    - [命令行基础](命令行基础.md)

## 1. 准备措施  
对于 `MacOS` 用户，您需要额外执行此步骤，`Linux` 用户可以跳过  
```bash
xcode-select --install
```

## 2. 换源  
请执行如下指令  
```bash
export HOMEBREW_INSTALL_FROM_API=1
export HOMEBREW_API_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api"
export HOMEBREW_BOTTLE_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles"
export HOMEBREW_BREW_GIT_REMOTE="https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/brew.git"
export HOMEBREW_CORE_GIT_REMOTE="https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/homebrew-core.git"
```
（本教程默认使用清华源，您可以使用其他镜像源，这里不做教程，请自行适配）  

## 3. 安装  
请执行如下指令  
```bash
git clone --depth=1 https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/install.git brew-install
/bin/bash brew-install/install.sh
rm -rf brew-install
```

## 4. 添加环境变量  
- 如果您是 `MacOS` 用户
    - 请使用指令 `uname -m` 来获取您的 `系统架构`  
    - 如果您的 `系统架构` 是 `arm64`，请执行如下指令  
        ```bash
        test -r ~/.bash_profile && echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.bash_profile
        test -r ~/.zprofile && echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        ```
    - 如果您的 `系统架构` 是 `x86_64`，您可以跳过此步骤  
- 如果您是 `Linux` 用户，请执行如下指令  
    ```bash
    test -d ~/.linuxbrew && eval "$(~/.linuxbrew/bin/brew shellenv)"
    test -d /home/linuxbrew/.linuxbrew && eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
    test -r ~/.bash_profile && echo "eval \"\$($(brew --prefix)/bin/brew shellenv)\"" >> ~/.bash_profile
    test -r ~/.profile && echo "eval \"\$($(brew --prefix)/bin/brew shellenv)\"" >> ~/.profile
    test -r ~/.zprofile && echo "eval \"\$($(brew --prefix)/bin/brew shellenv)\"" >> ~/.zprofile
    ```

## 5. 常用指令  
- `brew help` 查看有哪些指令可以使用  
- `brew search {app}`：查找软件 `{app}`  
- `brew install mongodb`：安裝软件 `{app}`  
- `brew info {app}`：查看已安裝软件 `{app}` 的信息  
- `brew uninstall mongodb`：卸载软件 `{app}`  
- `brew list`：列出目前已安裝的软件  
- `brew outdated`：查询有哪些软件版本已经过期  
- `brew cleanup -n`：刪除旧版本软件  
    - 默认的情況下，Homebrew 不会删除旧版本的软件，但是这样会导致电脑上存在过多的无用历史版本，建议使用cleanup定期清除（-n 是显示删除过程）  
- `brew upgrade {app}`：更新软件 `{app}`  
- `brew update && brew upgrade && brew doctor`：更新所有软件  

## 6. 全部指令  
根据 homebrew 官方提示，所有功能如下  
```
==> Built-in commands
--cache           deps              log               tap-info
--caskroom        desc              migrate           tap
--cellar          developer         missing           uninstall
--env             docs              nodenv-sync       unlink
--prefix          doctor            options           unpin
--repository      fetch             outdated          untap
--version         formulae          pin               update-report
analytics         gist-logs         postinstall       update-reset
autoremove        help              pyenv-sync        update
casks             home              rbenv-sync        upgrade
cleanup           info              readall           uses
command           install           reinstall         vendor-install
commands          leaves            search
completions       link              setup-ruby
config            list              shellenv

==> Built-in developer commands
audit                               pr-publish
bottle                              pr-pull
bump-cask-pr                        pr-upload
bump-formula-pr                     prof
bump-revision                       release
bump-unversioned-casks              rubocop
bump                                ruby
cat                                 rubydoc
contributions                       sh
create                              style
determine-test-runners              tap-new
dispatch-build-bottle               test
edit                                tests
extract                             typecheck
formula                             unbottled
generate-cask-api                   unpack
generate-formula-api                update-license-data
generate-man-completions            update-maintainers
install-bundler-gems                update-python-resources
irb                                 update-sponsors
linkage                             update-test
livecheck                           vendor-gems
pr-automerge

==> External commands
services
```
您可以使用 `brew help {command}` 指令来获取 `{command}` 的用法信息  