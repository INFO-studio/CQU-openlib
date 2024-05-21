## 0. 前提  
- 类似 `{xxx}` 大括号内不以叹号 `!` 开头的是每个人不同的，您需要根据您的情况进行修改  
- 类似 `{!xxx}` 大括号内以叹号 `!` 开头的是每个人不同的，但是无需修改，您只需要执行描述的操作即可  
- 这是 `Python` 和 `Rust` 语言虚拟环境管理工具 `conda` 的部署教程，您可以使用该工具在同一台电脑下实现不同版本、安装不同库的 `Python` 隔离环境
- 前置知识  
    - [判断您的操作系统和系统架构](../计算机基础/判断您的操作系统和系统架构.md)  
    - [命令行基础](../计算机基础/命令行基础.md)  

## 1. 安装
- `Anaconda` 为更全面更丰富且带有图形化页面的 `conda` 版本，大约占用电脑 10 G 空间，`Miniconda` 为最简化仅带有基础命令行功能的 `conda` 版本，占用电脑大约 1 G 空间
- 官方安装网站：[Anaconda](https://www.anaconda.com/download/success)、[Miniconda](https://docs.anaconda.com/free/miniconda/index.html)
- [清华大学镜像站](https://mirrors.tuna.tsinghua.edu.cn/) - 右侧 `获取下载链接` - 上方 `应用软件` - `Conda` 选择您的操作系统和系统架构对应的安装包下载

## 2. 换源
请在命令行输入以下指令  
```bash
conda config --show channels
conda config --remove-key channels
conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/main
conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/free
conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/r
conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/pro
conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/msys2
conda config --set show_channel_urls yes
```
（本教程默认使用清华源，您可以使用其他镜像源，这里不做教程，请自行适配）  

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