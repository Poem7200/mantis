# 项目目标&非目标

## 目标

针对远程岗位招聘信息分散、检索繁琐的痛点，自动定时从各个远程招聘平台获取岗位信息
当前阶段追求：稳定、可扩展、可维护

## 非目标

高并发/商业级爬虫
另技能有限，目前**暂不考虑反爬虫对抗&分布式抓取**

# 系统职责&边界

| 技术栈     | 用途                                   |
| ---------- | -------------------------------------- |
| NestJS     | 对外暴露接口，提供定时任务             |
| Playwright | 模拟人类行为从网站上获取所需的岗位信息 |
| PostgreSQL | 存储爬取数据，减少重复爬取             |

# 核心模块&抽象

- browser # Playwright的浏览器操作方法封装
  - browser-pool.service # 浏览器池
  - browser.service # 浏览器操作封装（打开页面/点击/获取元素……）
- config
  - constants # 项目使用的所有常量
  - database.config # 数据库连接的配置项（目前只有PostgreSQL）
- crawler # 爬虫模块
  - strategies # 爬虫策略（一个网站一个策略）
  - crawler.controller # 爬虫任务触发接口
  - crawler.service # 爬虫策略的注册/读取，使用单个/多个策略进行爬虫并存储数据库
  - crawler-scheduler.service # 爬虫定时触发
- jobs # 岗位的实体类&增删改查方法
- scripts # 本地测试的爬虫脚本

# 执行流程

（待完善）

# 技术选型

（待完善）

# 可扩展点&限制
