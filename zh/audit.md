---
layout: default
title: 审查修复与迁移
lang: zh
permalink: /zh/audit/
---

# 26.11.02 审查修复

本次按用户提供的 Kimi 3.1 Pro 报告核实和修复。报告标题写有 32 项，但正文实际只有 28 项描述：高优先级第 2、3、5 项和中优先级第 7 项为空，无法推断其复现条件。以下编号沿用报告。NML/CSV 轴转换项在当前版本通过了全部 6 种轴排列的非对称、非等距测试，未复现报告所述错误。

| 编号 | 处理结果 |
| --- | --- |
| 高 1 | 大写 TIFF 后缀生成独立输出，显式同路径和链接别名被拒绝 |
| 高 4 | HTTP 实例使用独立私有运行目录，仅管理自身 Popen 子进程；不读取旧 PID 并发送信号 |
| 高 6、7 | Synful 初始化/恢复、LSD 恢复统一使用受限检查点读取器；恶意 pickle 回归测试 |
| 高 8、9 | Mito、LSD 完成记录绑定内容 SHA256，并验证实际 chunk 存在；缺失/篡改时拒绝续跑 |
| 高 10 | 旋转先写临时数组、读回核验，保留原目录作为备份后安装结果；异常时恢复 |
| 高 11 | Funke 数据库记录输入修订、科学配置和代码版本；不匹配或无身份的旧状态被拒绝 |
| 高 12 | 工作进程日志递归隐藏 MongoDB 凭据、密码和 token；派生配置权限为 0600 |
| 高 13 | Synful raw/labels 物理 ROI、分辨率及 split 对齐校验；默认只采样无需 context padding 的区域 |
| 中 1、2 | 逐切片拒绝 shape/dtype/channel 不一致；通道范围采用严格 1 基闭区间 |
| 中 3 | precomputed 数据传输成功后合并 multiscales，更新当前数据集并保留其他数据集 |
| 中 4 | 旋转更新 spacing 和 ROI 下角，保持原始物理 ROI 中心；不再清零原点 |
| 中 5 | HDF5 无属性时，将调用方 XYZ spacing/offset 转为 ZYX 数组顺序 |
| 中 6 | 当前 NML/CSV 实现经 6 种轴排列验证通过，保留现有明确的源轴到输出 XYZ 映射语义 |
| 中 8 | NMS 自适应扩展读取窗口至核心关联平台及其抑制边界完整，跨块采用相同全局质心 |
| 中 9 | bounding box、heatmap 和 IoU 辅助结构按真实实例数分配，保留 uint64 bounding box 标签 |
| 中 10 | normalize/CLAHE 在新目录完成整个栈及 QC 后替换；重跑不混入旧切片 |
| 中 11 | Slurm `%j`、查询和取消使用分号前的数值作业 ID |
| 中 12 | NML 合并重映射 node/tree/group、branchpoint、comment 引用；不支持的根结构明确拒绝 |
| 中 13 | 显式解析 affinities 的 `s0` 子数组，确保后续使用正确的 Daisy Array |
| 中 14 | LUT 阈值统一验证 0.01 网格，拒绝更细的步长；不再加载相邻百分比的近似 LUT |
| 中 15 | dense base 记录并校验 fragments 修订、节点摘要、轴和 dtype |
| 中 16 | 从同一字节快照加载并哈希检查点；读取/提交期间重新验证输入文件修订，变化时不记录完成 |
| 中 17 | 最终 WEBKNOSSOS 阶段异常时回滚本次新建 base、attachment 和 layer，支持修正后重跑；保留已有数据 |
| 低 1、2 | 零旋转的独立输出会复制数据及元信息；对齐 reader 按格式支持 PNG/JPEG |

额外对 crop、rotate、resample、Zarr3 子路径和 agglomerate 发布增加路径边界检查，拒绝 `..`、绝对子路径和符号链接逃逸。自动启动的 MongoDB 仅绑定 loopback；跨节点 worker 必须配置已有的认证 `db_host`。

## 升级与恢复

- 推荐为旧的 LSD/Mito 预测使用新输出目录。没有内容摘要的旧完成记录不能证明输出完整性，因此会被拒绝。
- 旧 Funke 数据库没有 run identity 时，不复用其完成记录，使用新数据库与新输出。
- Slurm 分布式 Funke 需要配置能被 worker 访问的认证 MongoDB；本地后处理可继续自动启动 loopback MongoDB。旧整链路 Slurm 脚本通过 `CONNECTIO_MONGODB_URI` 读取认证 URI，验证当前连接已认证；不再启动或关闭共享服务。
- Synful 如明确需要历史边缘补零，可设置 `training.allow_context_padding=true`；raw/labels 必须仍具有一致物理 ROI。
- LUT 阈值及步长必须落在 0.01 网格，历史因浮点截断产生的错误文件名应重新生成。
- `normalize`/CLAHE 的 `output_folder` 是该次完整产物目录，输入输出不得相同或嵌套。

## 验证与范围

故障注入覆盖覆盖源文件、创建失败、chunk 删除/篡改、恶意 pickle、链接逃逸、输入在推理期间变化、跨块平台和多阶段发布失败；同时运行原有双格式模型回归及真实 MongoDB/Daisy/Funke 小体积链路。执行结果见[验证记录]({{ "/validation/audit-26.11.02.json" | relative_url }})。

目录替换在进程异常时可恢复；突然断电或 SIGKILL 不等价于多文件系统的全局原子事务。旋转安装窗口内保留的 `.backup-*` 可用于人工恢复。跨节点 Slurm、生产规模 GPU 和断电恢复未在本次本地测试中验证。输入修订采用文件系统指纹，提供的是正常文件修改检测；持续修改的源数据应先生成只读快照。NMS 在平台跨越大范围时会扩大窗口，可能需要更多内存。
