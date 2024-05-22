!!! warning "个人版本的 conda 是完全免费的软件，如果软件提示收费，请勿缴费并将其删除，您下到了盗版软件"

## 0. 前提  
- 类似 `{xxx}` 大括号内不以叹号 `!` 开头的是每个人不同的，您需要根据您的情况进行修改  
- 类似 `{!xxx}` 大括号内以叹号 `!` 开头的是每个人不同的，但是无需修改，您只需要执行描述的操作即可  
- 这是 `Python` 和 `Rust` 语言虚拟环境管理工具 `conda` 的部署教程，您可以使用该工具在同一台电脑下实现不同版本、安装不同库的 `Python` 隔离环境  
- 本页面使用 `清华大学开源软件站` 驱动，您可自行更换软件源  
- 前置知识  
    - [判断您的操作系统和系统架构](../计算机基础/判断您的操作系统和系统架构.md)  
    - [命令行基础](../计算机基础/命令行基础.md)  

## 1. 安装  
- `Anaconda` 为更全面更丰富且带有图形化页面的 `conda` 版本，大约占用电脑 10 G 空间，`Miniconda` 为最简化仅带有基础命令行功能的 `conda` 版本，占用电脑大约 1 G 空间  
- 官方安装网站：[Anaconda](https://www.anaconda.com/download/success)、[Miniconda](https://docs.anaconda.com/free/miniconda/index.html)  
- [清华大学镜像站](https://mirrors.tuna.tsinghua.edu.cn/) - 右侧 `获取下载链接` - 上方 `应用软件` - `Conda` 选择您的操作系统和系统架构对应的安装包下载  
- 请按照指示进行进一步安装  

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

## 3. 常用指令  
#### 环境管理  
- `conda create`：创建环境  
    - `-n {envName}`：必要指令，创建新的名为 `{envName}` 的环境，同 `--name`  
    - `-p {path}`：必要指令，创建路径为 `{path}` 且名字为 `{path}` 最子文件夹的环境，同 `--prosix` ，与 `-n` 不兼容  
    - `{package}={ver}`：额外指令，指定新环境的 `{package}` 库版本为 `{ver}`  
    - `-c {envSourse}`：额外指令，在 `{envSourse}` 的基础上创建库，同 `--clone`  
    - 实例：  
        - `conda create -n new1`  
        - `conda create -n new2 python=3.11`  
        - `conda create -p "~\env\new3" numpy=1.8.0`  
        - `conda create -n new4 -c new3`  
- `conda activate {envName}`：进入名为 `{envName}` 的环境  
- `conda deactivate`：进入默认环境  
- `conda remove -n {envName} --all`：删除名为 `{envName}` 的环境  
#### 库管理  
- `conda list`：列举所属库  
    - `-n {envName}`：额外指令，列举名为 `{envName}` 的所属库  
- `conda search {package}`：查找源是否有 `{package}` 库  
- `conda install {package}`：安装 `{package}` 库  
    - `={ver}`：额外指令（前无空格），指定 `{package}` 库版本为 `{ver}`  
- `conda update {package}`：更新 `{package}` 库  
- `conda uninstall {package}`：卸载 `{package}` 库  