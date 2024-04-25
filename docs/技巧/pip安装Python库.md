## 前提  
您可能需要额外某些库才能执行您的 Python 代码  
如果您收到报错 `ModuleNotFoundError: No module named '{库名}'`，那么您正需要额外安装该库到您的电脑上  

## 安装方法  
正常的安装十分缓慢，通过换源可以极大的改善这种情况  
#### 操作方法  
1. 打开命令行  
    - 如果您是 `Windows` 操作系统（除了苹果电脑的大部分都是）  
        1. `Win+R` 快捷键打开 `运行` 窗口  
        2. 输入 `cmd` 并回车  
        3. 如果您看到一个黑色窗口，则打开成功，下述所有命令都将在此处执行  
    - 如果您是 `MacOS` 操作系统（苹果电脑）  
        1. 进入 `控制台` 打开 `终端` 应用，或 `commend+空格` 搜索 `终端` 并打开  
        2. 如您看到一个白色窗口，则打开成功，下述命令都将在此处执行  
2. 换源并安装  
    - 临时变更  
        如题，这种方法只能为您当次安装换源  
        输入以下指令（请替换花括号内的内容）  
        ```bash
        pip install -i {镜像站} {库名}
        ```
        `{镜像站}` 请参考下面的链接并自行选用，`{库名}` 为您想要安装的库  
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

## 镜像站  
- 普遍较为好用  
    - 清华大学：`https://pypi.tuna.tsinghua.edu.cn/simple`  
    - 阿里云：`http://mirrors.aliyun.com/pypi/simple`  
    - 豆瓣：`http://pypi.douban.com/simple`  
- 如果您使用重庆大学电信校园网可以考虑  
    - 重庆大学：`https://mirrors.cqu.edu.cn/pypi/web/simple`  


