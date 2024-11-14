!!! warning "pip 是完全免费的软件，如果软件提示收费，请勿缴费并将其删除，您下到了盗版软件"

## 0. 前提  
- 您可能需要额外某些库才能执行您的 Python 代码。如果您收到报错 `ModuleNotFoundError: No module named '{库名}'`，那么您正需要额外安装该库到您的电脑上  
- 作为该教程的进阶，您可以选择不使用 `pip` ，而使用[conda管理Python环境](conda管理Python环境.md)，这需要额外大约 `10 G` 的空间，但是后续的操作也会变得简单  
- 前置知识  
    - [命令行基础](../计算机基础/命令行基础.md)  

## 1. 安装方法  
正常的安装十分缓慢，通过换源可以极大的改善这种情况  
#### 操作方法  
1. 打开命令行  
2. 换源并安装  
    - 临时变更  
        如题，这种方法只能为您当次安装换源  
        输入以下指令（请替换花括号内的内容）  
        ```bash
        pip install -i {镜像站} {库名}
        ```
        `{镜像站}` 请参考[A. 镜像站](#a-镜像站)并自行选用，`{库名}` 为您想要安装的库  
    - 永久变更  
        输入以下指令  
        ```bash
        pip config set global.index-url {镜像站}
        ```
        `{镜像站}` 请参考下面的链接并自行选用  
        等待执行完成后输入以下指令  
        ```bash
        pip install {库名}
        ```
        `{库名}` 为您想要安装的库  

## A. 镜像站  
- 普遍较为好用  
    - 清华大学：`https://pypi.tuna.tsinghua.edu.cn/simple`  
    - 阿里云：`http://mirrors.aliyun.com/pypi/simple`  
    - 豆瓣：`http://pypi.douban.com/simple`  
- 如果您使用重庆大学电信校园网可以考虑  
    - 重庆大学：`https://mirrors.cqu.edu.cn/pypi/web/simple`  


