# 重庆大学资源共享计划 「𝙲𝚀𝚄-𝚘𝚙𝚎𝚗𝚕𝚒𝚋」

> 这个库的旨在为同学消除选择课程，学习资料等信息差。  
> 在大学中存在大大小小的信息壁垒，然而要打破这些壁垒获取情报却要耗费大量时间精力。  
> 有时上完一节课才意识到应该如何去上这门课，但为时已晚，学习结果可能不尽人意留下遗憾。  
> 为了将那些不确定的，流状态的，短暂的，难以获取的，口口相传的信息保存下来，我们建立了这个库，希望能帮助到大家。 
（摘自[浙江大学课程攻略共享计划](https://github.com/QSCTech/zju-icicles)）

---

## PR请看
应校方要求，提交 PR 时，请将本次附带的文件以文件夹形式传入`PR_resources` 文件夹内，链接即指向 Github ，站长会审核后转入本站文件管理。  

---

𝙲𝚀𝚄-𝚘𝚙𝚎𝚗𝚕𝚒𝚋 想要做成一个只要关于重大，要什么有什么的网站：  

课件教材资源、作业习题答案、甚至哪个地方好吃哪里好逛，都可以在这里找到  

在大学中存在大大小小的信息壁垒，然而要打破这些壁垒获取情报却要耗费大量时间精力。  

有时上完一节课才意识到应该如何去上这门课，但为时已晚，学习结果可能不尽人意留下遗憾。  

为了将那些不确定的，流状态的，短暂的，难以获取的，口口相传的信息保存下来，我们建立了这一整个「𝚕𝚒𝚋」，希望能帮助到大家。  

如果觉得我们做得不错，请点一下 star 哦～拜托了！  

---

### 共享
您可以通过各种渠道共享您的各种资料  

推荐使用 Github Issue 来共享您的资料

「课程」栏有独立的文件上传路径，您可使用[表单](https://forms.office.com/Pages/ResponsePage.aspx?id=DQSIkWdsW0yxEjajBLZtrQAAAAAAAAAAAAMAAA7OwxpURE8xNTROTVRBQTc3M0tDTThaWTVQOENaRC4u)来共享您的（或您收集的）各种圣遗物

资料包括但不限于：笔记、教材pdf、教师PPT（请得到教师允许）、期中期末试卷  

---

### 使用
1. 本地部署
    ```bash
    cd {库根文件}
    python -m pip install -r requirements.txt
    python ./scripts/updateLog.py
    mkdocs serve
    ```
2. PR提交
    ```bash
    cd {库根文件}
    git pull origin main                                      
    git add .
    git commit -m "更新"
    python ./scripts/updateLog.py
    git push origin main
    ```

---

### 提醒  
请注意我们是一个纯非盈利性质的组织，也并非官方机构。目前我们并不会考虑开通打赏渠道，同样，也不接受任何推广服务。如您认为您的版权受到了侵犯，请邮箱联系 `beta-s@outlook.com`，我们会为您删掉对应的数据。  
