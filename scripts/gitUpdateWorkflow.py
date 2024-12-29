# ChatGPT生成 未测试 请勿使用

from git import Repo, GitCommandError
import sys

# 主程序
def main():
    try:
        # 初始化 Repo 对象，确保脚本运行在 git 仓库根目录
        repo = Repo(".")
        if repo.bare:
            print("当前目录不是一个有效的 git 仓库。", file=sys.stderr)
            sys.exit(1)

        # 第一步：执行 git pull
        print("执行 git pull...")
        try:
            origin = repo.remote(name='origin')
            origin.pull()
            print("git pull 完成。")
        except GitCommandError as e:
            print(f"git pull 失败: {e}", file=sys.stderr)
            sys.exit(1)

        print("调用 Python 代码 updateLog...")
        try:
            from updateLog import main
            main()
        except ImportError as e:
            print(f"导入失败: {e}", file=sys.stderr)
            sys.exit(1)

        # 第三步：执行 git add .
        print("执行 git add . ...")
        repo.git.add(all=True)
        print("git add . 完成。")

        # 第四步：执行 git commit
        print("执行 git commit ...")
        commit_message = """一个md的内容
（包含换行等）"""  # 替换为您的实际提交信息
        try:
            repo.index.commit(commit_message)
            print("git commit 完成。")
        except GitCommandError as e:
            print(f"git commit 失败: {e}", file=sys.stderr)
            sys.exit(1)

        # 第五步：执行 git push
        print("执行 git push ...")
        try:
            origin.push()
            print("git push 完成。")
        except GitCommandError as e:
            print(f"git push 失败: {e}", file=sys.stderr)
            sys.exit(1)

    except Exception as e:
        print(f"发生错误: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()