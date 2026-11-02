---
slug: tokenrouter-architecture-deep-analysis
title: TokenRouter 源码深度解析：Token 级 LLM 路由的高效 Serving 系统是如何炼成的
description: 从源码层面深度剖析 thu-nics/TokenRouter（NeurIPS 2026）的架构设计：基于 SGLang 的扩展点与 monkey patch 策略、route/send/receive 三接口抽象、PeerReq 增量 handoff 协议、batch_not_need 停车场与 KV 保留、delayed batching 死锁逃逸、多模型共卡显存求解，以及 R2R 算法剖面；并给出适合的负载画像、模型组合与单机/多机落地部署路径。
date: 2026-11-02
authors: caishaodong
tags: [AI, 开源项目, 源码分析, LLM Serving, SGLang, Token级路由, R2R, CITER, 推理优化, CUDA MPS, 分布式推理, NeurIPS]
keywords: [TokenRouter, token-level routing, LLM routing, SGLang, sglang 0.5.1, R2R, CITER, Co-LLM, R-Stitch, GlimpRouter, speculative decoding, KV cache rollback, delayed batching, PeerReq, BaseTokenRoutingScheduler, TokenRoutingEngine, CUDA MPS, 多模型部署, Qwen3-0.6B, Qwen3-32B, decoding throughput]
---

## 引言

[TokenRouter](https://github.com/thu-nics/TokenRouter) 是清华 thu-nics 组（天鹅座 AlphaLab）NeurIPS 2026 论文 *"TokenRouter: Efficient Serving System for Token-Level LLM Routing"*（arXiv:2610.12242）的官方代码实现。它解决的是一个被算法侧研究长期回避的工程问题：**当路由决策细到"每一个 token 由哪个模型生成"时，serving 系统该怎么支撑？**

过去两年的 LLM 路由研究基本停留在 query 级——一个请求进来，router 判断它"难不难"，然后整体交给大模型或小模型。这类系统（RouteLLM、各类 semantic router）本质上只是请求分发器，任何反向代理都能承载。但 R2R、CITER、Co-LLM、R-Stitch 这一族 token 级路由算法的粒度完全不同：小模型逐 token 解码，发现当前 token "超出了自己的能力"就切换到大模型，大模型生成若干 token 后可能又切回来——**一个请求的生命周期里会在模型之间往返多次**。

这对 serving 系统提出了几个刁钻的要求：

1. **handoff 不能重算 prefill**。如果每次切换都把上下文重新 prefill 一遍，token 级路由的收益会被彻底吃掉。
2. **KV cache 的所有权是跨模型的**。请求在模型 A 停下来时，A 已生成的 KV 怎么处理？切到 B 再切回来时还能续上吗？
3. **批调度被碎片化**。请求频繁在"本地解码"和"等 peer"两种状态间摇摆，朴素的批形成策略会制造大量 under-filled batch，大模型的算力利用率崩塌。

TokenRouter 的回答是：开发者只用三个接口描述路由逻辑——`route()`、`send()`、`receive()`——其余的全部交给系统。官方数字是在多种路由算法、负载和模型对组合下，解码吞吐相比现有系统提升 **2.01–64.15×**（论文宣称，本文末尾会讨论这个数字的语境）。

本文基于仓库 main 分支（62 个文件、约 1.35 万行 Python，2026-10-20 最后提交）做源码级分析，所有结论带文件与行号证据。

## 一、与 SGLang 的关系：继承 + 运行时补丁，不是 fork

TokenRouter 的第一个架构决策就值得注意：**它没有 fork SGLang**。依赖清单锁定了 `sglang==0.5.1`（`pyproject.toml:579`），然后通过两条路径在其上构建：

- **继承（subclass）**：`tokenrouter/server_args.py:50` 的 `ServerArgs` 直接继承 `sglang.srt.server_args.ServerArgs`，新增路由字段；`BaseTokenRoutingScheduler` 继承 sglang 的 `Scheduler`（`base_scheduler.py:105`）；`TokenRoutingEngine` 继承 sglang 的 `EngineBase`（`engine.py:69`）。
- **运行时 monkey patch**：`sglang_hidden_states_patch.py` 的模块 docstring 写得很清楚——"Both patches are installed at runtime without modifying the installed SGLang package"。

补丁修的是什么？`sglang_hidden_states_patch.py:1-10` 记录了一个 SGLang 0.5.1 的实际 bug：prefill 输出的 hidden states 按 `len(req.origin_input_ids)` 切片，但开了 radix cache 后模型只计算 uncached 的 extend suffix，**batch 里的请求会拿到隔壁请求的 hidden states**。这对普通 serving 无害（没人消费 prefill 的 hidden states），但对 token 路由是致命的——R2R 的 router 就是以 hidden states 为输入做切换决策的（`r2r_slm_scheduler.py:56`）。第二个补丁允许请求被移交给 peer 时跳过不必要的 unfinished-request radix insert（KV 分配还活着，没必要急着进 radix tree）。

另一个 `sglang_launch_server_patched.py` 复刻了 sglang 的 `_launch_subprocesses`，唯一目的是让它接受 `scheduler_class` 参数注入自定义调度器（`engine.py:418-425` 的 docstring）。

这个决策的代价与收益都很明确：收益是能持续吸收 sglang 上游的推理性能优化（attention 后端、CUDA graph、radix cache）；代价是版本强耦合——monkey patch 精确针对 0.5.1 的内部实现，升级 sglang 需要重新验证补丁。仓库里 `layers/attention/flashinfer_backend.py` 也是同样的"按需覆写"思路。

## 二、总体架构：分层与进程模型

```mermaid
title TokenRouter 单机部署的进程与通信拓扑
flowchart TB
    subgraph 客户端
        C1[OpenAI SDK / requests]
        C2[Python 进程内调用]
    end
    subgraph HTTP 入口节点
        HTTP[FastAPI http_server<br/>/v1/chat/completions + /generate]
        ENG[TokenRoutingEngine<br/>无 HTTP 直接嵌入]
        TM[TokenizerManager]
        DM[DetokenizerManager]
    end
    subgraph 调度进程["调度进程（每模型一个 scheduler 实例）"]
        S1["r2r_slm scheduler（Qwen3-0.6B）<br/>ZMQ PULL inbox: ipc://...peer_0"]
        S2["r2r_llm scheduler（Qwen3-32B, tp=2）<br/>ZMQ PULL inbox: ipc://...peer_1"]
    end
    C1 --> HTTP
    C2 --> ENG
    HTTP --> TM
    ENG --> TM
    TM -->|TokenizedGenerateReqInput| S1
    S1 -->|BatchTokenIDOut| DM
    DM --> TM
    TM --> HTTP
    S1 <-->|"PeerReq 增量 token 流<br/>PUSH 寻址 → PULL inbox"| S2
```

包结构与职责划分（README "Understanding the Code" 一节与源码核对一致）：

| 目录 | 职责 | 关键证据 |
| --- | --- | --- |
| `tokenrouter/entrypoints/` | FastAPI HTTP 服务、OpenAI 兼容 chat completions、Python 引擎 | `http_server.py`（1330 行，从 sglang 复用大量路由）、`openai/serving_chat.py`、`engine.py` |
| `tokenrouter/managers/` | tokenizer / detokenizer / TP worker、请求对象扩展、peer 消息 | `tokenizer_manager.py`、`peer_request.py`、`schedule_batch.py` |
| `tokenrouter/managers/schedulers/` | **核心**：调度器基类 + 13 个注册实现 | `base_scheduler.py`（2347 行）、`__init__.py:31-47` 的 `SCHEDULER_REGISTRY` |
| `tokenrouter/algorithms/` | 方法特定的路由逻辑（router 网络、切换策略） | `r2r/router.py`、`r2r/switching.py`（9 种切换策略）、`citer/conf_model.py`、`collm/threshold_schedule.py` |
| `tokenrouter/model_executor/` | 模型执行与 CUDA graph | `model_runner.py`、`cuda_graph_runner.py` |
| `config/` | 每算法 × 模型对的 YAML | `config/r2r/Qwen3-0.6B_Qwen3-32B.yaml` |
| `evaluation/` | 负载数据集、吞吐基准、报告、delayed-batching 优化器 | `test_throughput.sh`、`calculate_delayed_batching.py` |

一个微妙但重要的设计：**算法逻辑（algorithms/）与执行机制（managers/schedulers/）是分离的**。R2R 的切换策略族全部在 `algorithms/r2r/switching.py` 里实现为纯函数式的 `ModelSwitchingStrategy` 类，调度器只负责在恰当时机调用它们。这让你可以独立于 serving 机制去迭代算法。

## 三、核心抽象：三个接口 + 一条协议

### 3.1 `BaseTokenRoutingScheduler`

每个协作模型对应一个调度器实例，继承它并实现三个接口：

```python
# base_scheduler.py:1951-1991（签名与默认实现）
@abstractmethod
def route(self, batch, result) -> torch.Tensor:
    """每次前向后调用，返回 per-request 的路由决策。
    返回模型名列表（多模型）或 shape=(batch_size,) 的张量；
    旧式两模型调度器里 True/1 = 交给唯一 peer，False/0 = 本地继续。"""

def send(self, req, destination=None) -> PeerReq:
    """构造发给目标调度器的 PeerReq。默认传 origin_input_ids + 全部 output_ids。"""

def receive(self, msgs) -> None:
    """处理来自 peer 的 PeerReq。默认全盘接收 peer 发来的 token。"""
```

`route()` 的返回值语义经过一次明显的泛化：早期只支持双模型（布尔张量），后来多模型（ME 三模型）需要返回显式模型名，`_normalize_route_decisions`（`base_scheduler.py:1665`）负责把两种风格统一。这个演进痕迹在 `send_requests_to_peers`（`base_scheduler.py:704-718`）也能看到——列表形态为了双模型向后兼容保留，多模型必须传 `{destination: messages}` 字典。

### 3.2 `PeerReq`：增量 handoff 协议

`managers/peer_request.py:58-194` 定义了调度器之间的消息格式，这是整个系统最核心的数据结构：

```python
class PeerReq:
    rid: str                      # 跨调度器共享的请求 id
    new_token_ids: List[int]      # peer 产出的 token（控制消息为空）
    kvcache_loc: Dict[str, int]   # 每个模型"已同步到"的 token 位置
    sampling_params: SimpleSamplingParams | None  # 仅首次发送携带
    status: str                   # need / finished / new / retracted
    model_tokens: Dict[str, List[int]]  # 每模型各自视角的 token 序列
    handoff_seq: int              # 单调递增的移交序号（防乱序/防陈旧）
    final_output_ids: List[int]   # 终局全局输出
```

三个设计点值得展开：

**增量传输**。`construct_from_req`（`peer_request.py:123-128`）在构造消息时查询 `req.kvcache_loc[destination]`——如果目标模型此前接收过这个请求，只发 `current_token_ids[kvcache_loc[destination]:]` 这一段增量。token 不是每次全量重传的。

**pickle-safe 的采样参数子集**。`SimpleSamplingParams`（`peer_request.py:6-55`）只保留 temperature/top_k/top_p/max_new_tokens/ignore_eos 五个字段，跨进程序列化时不依赖完整的 sglang 对象图。首次移交（`first_send=True`）才带 `origin_input_text` 和采样参数，让接收方从零构造一个完整的 sglang `Req`（`base_scheduler.py:988-1015`）；后续移交只传 token。

**状态机与幂等**。四种 status 里 `retracted` 最有意思——发送方因为 KV 池压力释放了该请求的 KV（打破 KV-pool 死锁的机制），通知接收方"恢复本地解码，且把下一次移交当作 first_send"。`handoff_seq` 配合 `terminal_rids` tombstone 表（`base_scheduler.py:748-758`，带 1024 上限防止长跑服务泄漏每个已完成请求的 rid）保证 ZMQ 上乱序/重复消息不会造成状态回退。

### 3.3 注册表驱动的组装

`SCHEDULER_REGISTRY`（`schedulers/__init__.py:31-47`）把 YAML 里的 `scheduler_class` 字符串映射到类：

| 算法 | 调度器类 |
| --- | --- |
| R2R | `r2r_slm` + `r2r_llm` |
| CITER | `citer_slm` + `citer_llm`（后者直接复用 `R2RLLMScheduler`，`:28` 的别名） |
| Co-LLM | `collm_base` + `collm_assist` |
| R-Stitch | `rstitch_slm` + `rstitch_llm` |
| GlimpRouter | `glimprouter_slm` + `glimprouter_llm` |
| ME（三模型） | `random_routing` × 3 |
| query 级路由 | `query_level_routing` |
| random baseline | `random_routing` / `per_request_random_routing` |

注意"一个算法 = 每模型一个调度器"的模式：算法不是单点插件，而是**一组分布在各模型进程里的协作行为**。这是 token 级路由的本质决定的——路由决策发生在每个模型的每次前向之后。

## 四、运行时机制深挖

这一节是 TokenRouter 论文贡献的系统侧核心，也是它区别于"在 vLLM 外面挂个 proxy"的地方。

### 4.1 事件循环：peer 优先

`event_loop_normal`（`base_scheduler.py:558-580`）每轮迭代严格按序执行三步：

```python
while True:
    peer_msgs = self.recv_requests_from_peer()   # 1. 先收 peer 消息
    if peer_msgs: self.receive(peer_msgs)
    recv_reqs = self.recv_requests()             # 2. 再收系统/tokenizer 消息
    self.process_input_requests(recv_reqs)
    batch = self.get_next_batch_to_run()         # 3. 调度 + 前向 + 路由
    if batch:
        result = self.run_batch(batch)
        self.process_batch_result(batch, result) # 子类在这里调 route()
```

peer 消息优先于本地调度，保证移交的 token 尽快进入批形成流程。overlap 模式（`event_loop_overlap:583-629`）复刻了 sglang 的异步流水线，但需要一份"更完整"的 batch 拷贝进 result_queue——sglang 原版的拷贝是精简的（上游只用它做输出处理），TokenRouter 要把 parked 请求 merge 回 decode 批，所以 `_copy_batch_for_overlap_result`（`:632-669`）逐属性补齐了 `sampling_info`、`input_ids`、`seq_lens` 等张量。

### 4.2 ZMQ 拓扑：寻址式 inbox

每个模型的调度器绑定**一个 PULL socket 作为收件箱**（IPC 或 TCP），同时为每个 peer 建立**专用的 PUSH socket** 连到对方的收件箱（`base_scheduler.py:226-256`）。代码注释直白地解释了为什么：*"messages are addressed instead of being load-balanced across multiple PULL consumers"*——如果多个模型的 PUSH 连到同一个 PULL，ZMQ 会做负载均衡，消息可能被错误的模型消费。寻址式拓扑让 `destination_model` 字段成为纯粹的校验而非分发依据。

传输层选 ZMQ + pickle 的 `send_pyobj` 而不是 gRPC/HTTP，也符合"同机房低延迟、消息小而频"的场景。多机时换 TCP endpoint（`PortArgs.peer_ipc_name` 在 DP attention 或 `--local_model` 模式下变成 `tcp://`，`server_args.py:76-98`）。

### 4.3 `batch_not_need`：停车场与 KV 保留

被路由给 peer 的请求去哪了？不是删除，而是**停车场**。类 docstring（`base_scheduler.py:106-116`）写得很清楚：请求被 `mark_as_not_need` 标记后移入 `batch_not_need` 这个侧批，**KV cache 分配原样保留**。peer 把 token 送回来时，子类调 `accept_peer_tokens` 决定怎么回到计算路径。

这是"handoff 不重算 prefill"的关键：小模型 0.6B 的 KV 留着，大模型 32B 解码完一段切回来时，小模型从停车场直接恢复——它之前算过的 KV 仍然有效。

### 4.4 `accept_peer_tokens`：0 / 1 / N 三种重入路径

`base_scheduler.py:2017-2048` 定义了 token 接受策略的挂载点，语义按接受数量分叉：

- **0（全拒）**：请求以自己的最后 token 恢复本地 decode——这是 spec-style 验证拒绝的路径；
- **1**：接受一个 token，走 decode 路径（一次 decode step 就能消化）；
- **N > 1**：接受多个 token，走 extend/prefill 路径（peer 批量生成的 token 要当一次"迷你 prefill"喂进来）。

`receive()`（`:827-1052`）据此分流：接受 ≤1 token 的请求通过 `merge_batch` 并回 `last_batch` 直接续 decode（`:1036-1046`）；多 token 的进 `waiting_queue` 等待下一个 prefill 批。默认实现是全盘接受（`:2048`），R-Stitch 这类需要验证/选择性接受的算法覆写它。

### 4.5 `rollback_kvcache`：端到端回滚

token 级路由里有一类算法（speculative acceptance 风格）：小模型先"赌"几个 token，路由决策反转后要把赌注撤回。`rollback_kvcache`（`base_scheduler.py:2054-2145`）的 docstring 是全仓库写得最认真的一段，因为它要处理的事比看上去多：

1. 释放最后 n 个位置的 KV pool slot；
2. 修剪 `output_ids` **和所有与 decode 逐 token 对齐的旁路数组**——`output_token_logprobs_val/idx`、`output_top_logprobs_val/idx`、`hidden_states`（`logprob` 数组不管 stream 有没有真的 flush 都会逐 token 增长，只修 `output_ids` 会造成索引错位）；
3. 钳制流式游标 `send_token_offset` 等，防止周期性强制 flush 已经推进过的游标切到"空气"里；
4. 重置 `prefix_indices` 让下一次 extend 正确重算长度。

它的文档同时明确了**边界**：已经发给 detokenizer / tokenizer manager 的内容是 append-only 的，回滚不撤销用户已看到的输出——所以需要一致性输出的算法必须同时抑制这些 token 的 `stream_output`。这是一个系统层与算法层的契约。

### 4.6 delayed batching：批形成 vs 死锁的两难

这是性能侧最微妙的机制。问题：peer（大模型）归还请求的时机是零散的，如果每个归还都立刻触发一次大模型前向，在低并发下你会得到一堆 batch_size=1 的 32B 前向——算力利用率灾难。解法是 `delayed_batching_threshold`：**攒够阈值才开批**。

配置支持标量或**按活跃请求数索引的列表**。R2R 官方配置（`config/r2r/Qwen3-0.6B_Qwen3-32B.yaml:399`）给的是 16 级阶梯 `[1,2,2,3,4,5,5,6,7,8,9,10,10,11,12,13]`——并发越高，攒批越激进。`_get_delayed_batching_threshold`（`base_scheduler.py:1440-1458`）取"控制面计数（`active_rids`，由幂等控制消息维护）与本地存活请求计数（`_live_scheduler_req_count` 扫 running_batch/waiting_queue/batch_not_need 等五处）的较大者"来索引，防止陈旧计数把阈值压塌。

但攒批引入了循环等待的风险：模型 A 等 batch 攒满，请求却在模型 B 手里，而 B 也在等自己的批满——死锁。`_effective_min_prefill_bs`（`:1494-1510`）的注释精确描述了逃逸策略：

> A peer-routed request can participate in a circular wait only in the overlap scheduler. In the normal scheduler it must continue to obey delayed batching; otherwise every returned request immediately launches an under-filled reference-model batch and destroys the throughput benefit.

即：**overlap 模式下**，批里若含 peer-routed 请求，允许降低 min batch size 打破循环等待；normal 模式下必须继续遵守阈值，否则 delayed batching 形同虚设。两种调度模式用不同的死锁观——normal 模式的批形成是同步的不会循环等待，overlap 模式会。

配套的 `evaluation/calculate_delayed_batching.py` 是个学术味十足的优化器：用 `Fraction` 精确有理数算术 + scipy 稀疏矩阵，把 delayed batching 建成离散时间马尔可夫链，**枚举所有可行的阈值向量 B，解线性方程组算精确吞吐，取最优**。README 给出的示例命令输入是两模型的测得延迟（6.0 / 27.9 秒）、token 归属概率转移矩阵 P 和切换代价矩阵 C。给一组 benchmark 数据就能离线推出你的硬件+负载的最优阶梯，而不是拍脑袋。

### 4.7 多模型共卡的显存求解

单机把 0.6B 和 32B 塞进同一组 GPU 时，每个模型的 `mem_fraction_static`（权重 + KV cache 的静态份额）怎么定？手拍会要么 OOM 要么浪费。`get_mem_fraction_statics`（`engine.py:557-`）的解法：

1. 从每个模型的 `tp_size`/`base_gpu_id` 推出 GPU → 模型映射；
2. 逐 GPU 计算在 (总预算 − 该卡上所有模型权重和) 之内的最大 KV token 数（KV cell 大小由 `num_kv_heads × head_dim × layers × 2 × dtype` 算出）；
3. 跨 GPU 取最小值作为引擎级 token 预算；
4. **反解**每个模型的 `mem_fraction_static`，使其静态内存 = 自身权重分片 + 该 token 数。

同一套逻辑天然覆盖"两模型共卡"和"各占一张卡"两种拓扑——每 GPU 独立约束、最紧者胜。`param_num_billion` 字段（`server_args.py:64`）就是为这个估算引入的，这也是为什么 YAML 里每个模型都要填它。

### 4.8 请求对象的最小侵入扩展

sglang 的 `Req` 没有 `kvcache_loc`/`model_tokens`/`handoff_seq` 这些概念，TokenRouter 不改 sglang 源码，而是在调度器内用鸭子类型动态挂上（`base_scheduler.py:1190-1191` 的 `if not hasattr(req, "kvcache_loc")` 惰性初始化），移交时通过 PeerReq 显式序列化这些字段、接收方重建（`:988-1015`）。`_propagate_ori_attrs`（`:803`）负责这些属性在请求对象被 sglang 内部重建后不丢。

## 五、算法剖面：以 R2R 为例

R2R（Read-to-Route）是 TokenRouter 的"亲儿子"算法，也是仓库里实现最完整的一条链路，适合作为解剖样本。

**切换策略族**（`algorithms/r2r/switching.py:25-1005`）：9 种策略实现同一个 `ModelSwitchingStrategy` 接口——`ImmediateSwitching`、`EntropySwitching`（按 logits 熵）、`MomentumSwitching`、`SingleRollingWindowSwitching`、`DuoRollingWindowSwitching`、`NeuralSwitching`、`NeuralRollingWindow`、`NeuralMultiInput`、`RandomSwitching`。`create_switching_strategy` 工厂（`:991`）按 YAML 的 `scheduler_kwargs.switching_strategy` 实例化。从简单统计量到神经 router 的完整阶梯都在，方便消融。

**SLM 侧调度器**（`r2r_slm_scheduler.py:43-68`）的 `route()` 展示了 hidden states 是怎么被取出来的——这段代码解释了 4.1 节那个 sglang 补丁为什么必须存在：

```python
def route(self, batch, result):
    is_prefill = result.logits_output.hidden_states.shape[0] != batch_size
    if is_prefill:
        # prefill 时 batch 是变长的，用 cumsum(extend_lens)-1
        # 取每个请求最后一个 extend token 的 hidden state
        hidden_indices = torch.cumsum(extend_lens, dim=0) - 1
    else:
        hidden_indices = torch.arange(batch_size)  # decode 顺序索引
    hidden_states = result.logits_output.hidden_states[hidden_indices, :][:, None, :]
    model_outputs = ModelOutputs(
        hidden_states=[hidden_states],
        logits=next_token_logits[:, None, :],
        token=next_token_ids[:, None],
    )
    return self.r2r_router.route(model_outputs).cpu()
```

router 本体（`algorithms/r2r/router.py`）是一组小型 transformer 变体（logits 输入 / hidden states 输入 / 混合输入各有投影头 + backbone），权重从 HuggingFace `nics-efc/R2R_router_collections` 拉取，甚至支持 `use_cuda_graph: true`——一个 0.6B 模型旁边的 router 网络也要吃 CUDA graph，这很能说明路由决策的调用频率（每个 decode step 一次）。

**`send()` 里的模型 token 记账**（`r2r_slm_scheduler.py:70-82`）：发送前 `req.model_tokens[self.server_args.server_name][1] -= 1`，并把 `origin_input_ids + output_ids[:-1]` 作为上下文传给 peer——最后一个 token 留给大模型生成，这是 R2R 的语义细节（切换点的 token 由 reference 模型产出）。`model_tokens` 这个 per-model token 视角字典随 PeerReq 全程携带，最终写回 `finished_req.model_tokens`（`base_scheduler.py:899-901`），算法层可以用它做归因分析。

R2R 官方 YAML 还透露了两个部署级调优：`forward_mode_for_single_token: "extend"`（reference 模型单 token 用 extend 而非 decode 模式前向，配合它的 `cuda_graph_bs_extend` 批大小集合 `16: !range [16,64]`），以及 `disable_overlap_schedule: true`——至少在 0.5.1 栈上，R2R 的推荐配置没有用 overlap 调度。

## 六、使用场景：什么负载、什么模型、怎么落地

### 6.1 适合的负载画像

Token 级路由的收益模型很清晰：**小模型能独立生成大部分 token，只有少数"难 token"需要大模型**。从这个模型直接推出负载画像：

- **长输出推理负载**：AIME 类数学推理（官方提供 `aime_8k.json`，8K output budget）、agentic 多轮轨迹（`swesmith_traj_multi_round.json`）。输出越长、小模型覆盖率越高，收益越大——64.15× 这个上限数字就出现在最有利的算法×负载组合上。
- **高并发解码吞吐敏感型服务**：delayed batching 与增量 handoff 都是为吞吐（而非单请求延迟）设计的。批量离线处理（用 `TokenRoutingEngine` 嵌入）是最稳的落地形态。
- **多轮共享前缀的 agent 负载**：radix cache 命中率高（SWE-smith 多轮轨迹是官方负载之一），且系统保留 radix cache 支持（`disable_radix_cache: false`）。
- **成本敏感但难以下调模型档位**：小模型打底 + 大模型兜底，等效质量接近 32B、解码成本接近 0.6B。

不适合的：短输出闲聊（切换开销占比高）、tokenizer 不同的跨家族模型对（PeerReq 直传 token id，`model_tokens` 假设两边词表一致——R2R/CITER/Co-LLM 的官方组合全是 Qwen3 家族内部配对）、需要严格 token 级流式一致性的产品（4.5 节的 rollback 边界意味着 speculative 类算法的中间 token 可能已经流出）。

### 6.2 模型组合的现实约束

仓库内置组合全部是**同家族大小配对**：Qwen3-0.6B + Qwen3-32B（R2R/CITER/Co-LLM/R-Stitch/query-level）、Qwen3-0.6B + 8B + 32B（ME 三模型）。R2R/CITER/CoLLM 的 router 权重在 HuggingFace `nics-efc` 下可直接拉取；R-Stitch 和 ME 不需要外部 router。换其他家族理论上可行，但你需要自己训练 router（R2R）或调阈值（Co-LLM 的 `threshold_schedule.py`），并接受 token id 直传的假设。

硬件形态两种：**单机共卡**（0.6B tp=1 与 32B tp=2 同卡组，显存预算交给 4.7 节的求解器，推荐开 CUDA MPS 让两个模型的 kernel 真正并发——README "Reproducing Our Results" 第一步就是起 MPS daemon）；**多机分置**（每节点一个模型）。多机当前有硬限制：`deployment.py:232-236` 明确 *"Distributed TokenRouter currently requires exactly two configured models"*，且 DP（`dp_size > 1`）与多模型路由组合会直接 `NotImplementedError`（`base_scheduler.py:193-197`）。

### 6.3 落地部署路径

**形态一：OpenAI 兼容 HTTP 服务**（对现有应用零改造）：

```bash
# 环境：python 3.10, CUDA 12.x
conda create -n tokenrouter python=3.10 && conda activate tokenrouter
pip install -e .   # 拉取 sglang==0.5.1 全家桶（torch 2.8.0 / sgl-kernel 0.3.8 / flashinfer）

# 单机共卡推荐先起 MPS
export CUDA_MPS_PIPE_DIRECTORY=$PWD/tmp/mps/pipe
export CUDA_MPS_LOG_DIRECTORY=$PWD/tmp/mps/log
nvidia-cuda-mps-control -d

python -m tokenrouter.launch_server --config_path config/r2r/Qwen3-0.6B_Qwen3-32B.yaml
# 之后用任何 OpenAI SDK 指向 http://host:30000/v1 即可（examples/openai_chat_completion.py）
```

**形态二：多机部署**（每个节点一份相同配置 + `--local_model` 选择本地模型）：

```yaml
system:
  entry_model: quick          # 客户端只打 entry 节点
  peer_endpoints:
    quick:    {bind: "tcp://0.0.0.0:30001", advertise: "tcp://<QUICK_IP>:30001"}
    reference: {bind: "tcp://0.0.0.0:30001", advertise: "tcp://<REF_IP>:30001"}
```

bind/advertise 分离（`deployment.py:200-262`）是标准的服务发现做法——NAT/容器环境下两边声明不一致也能工作。注意只有 entry model 节点需要对外暴露 HTTP，peer 之间走 30001 的 ZMQ TCP。

**形态三：Python 引擎嵌入**（离线批处理 / 测试 / 嵌入自家服务）：

```python
from tokenrouter.entrypoints.engine import TokenRoutingEngine

with TokenRoutingEngine("config/r2r/Qwen3-0.6B_Qwen3-32B.yaml") as engine:
    resp = engine.generate(
        prompt="<|im_start|>user\n...<|im_end|>\n<|im_start|>assistant\n",
        sampling_params={"temperature": 0, "max_new_tokens": 256},
    )
```

引擎模式与 HTTP 模式共享全部调度器机制，只是没有 FastAPI 层。

**扩展自定义路由方法**（README "Implement a new token-level routing method" + 源码核实的五步）：为每个协作模型写一个 `BaseTokenRoutingScheduler` 子类 → 实现 `route()`（返回模型名或张量）→ 按需覆写 `send()`（控制传输的 token 范围）与 `receive()`/`accept_peer_tokens()`（选择性接受/验证）→ 在 `SCHEDULER_REGISTRY` 注册 → 加一份 YAML 配置。方法专属的辅助逻辑（router 网络、阈值表）放 `algorithms/<method>/`。对照 `collm_base_scheduler.py`（Co-LLM 用阈值调度覆写接受逻辑）可以看出这个扩展点的表达力。

### 6.4 验证与调参

`evaluation/test_throughput.sh` 以指定并发打负载输出 per-request CSV，`report.py` 汇总；换硬件/负载后用 `calculate_delayed_batching.py` 重算 delayed batching 阈值（输入实测的两组延迟和路由概率矩阵）。这套"benchmark → 精确马尔可夫模型 → 最优阈值"的闭环在开源 serving 项目里相当罕见。

## 七、工程评价

**亮点**：

1. **抽象切得准**。route/send/receive 三个接口恰好是"决策、移交、接收"的正交分解，13 个内置调度器证明了这个抽象的覆盖面——从 random baseline 到三模型 ME 都能在其上表达。
2. **诚实的工程注释**。`rollback_kvcache` 和 `_effective_min_prefill_bs` 的 docstring 把不变量、边界条件和"为什么"写得像论文附录，这在研究代码里是稀缺品质。
3. **性能机制成体系**。增量 handoff + KV 保留停车场 + delayed batching + 精确阈值优化器，四个机制互相咬合，共同支撑论文的吞吐数字。
4. **monkey patch 而非 fork** 的维护策略，代价是版本锁定，收益是上游推理优化可持续流入。

**限制与风险**：

1. **`sglang==0.5.1` 强绑定**（`pyproject.toml:579`），patch 针对该版本内部实现，升级需重验。这对生产采用是最大的一个问号。
2. **多机仅两模型**、**DP+多模型未实现**——横向扩展的拓扑自由度有限。
3. **rollback 的流式语义边界**（4.5 节）：已流出 token 不撤销，speculative 类算法要么抑制流式要么接受用户看到被回滚的内容。
4. **研究代码成熟度**：v0.1.0、62 个文件、`tests/` 只有一个 R-Stitch 采样测试。74 star、2026-10 才公开，离生产化还有距离。

关于 **2.01–64.15×**：这是论文在自设的算法×负载×基线组合上的宣称，上限对应最有利场景（论文的对比基线是现有 serving 系统跑 token 级路由算法时的朴素实现）。工程上更稳的预期是：在 R2R 类算法 + 长输出负载 + 高并发下，token 级路由本身的质量/成本收益是算法侧给的，TokenRouter 的贡献是让这个收益**不再被 serving 层的 handoff 开销吃掉**。

## 结语

TokenRouter 是"算法研究逼出系统创新"的一个完整样本：token 级路由算法族（R2R/CITER/Co-LLM/...）在 2025-2026 年成熟起来之后，serving 系统必须回答"请求在模型间高频往返时谁管 KV、谁管批、谁管流"。TokenRouter 的答案——三接口编程模型、增量 handoff 协议、停车场式 KV 保留、防死锁的 delayed batching——每一块都不是单点黑科技，而是对不变量的细致维护。

对做推理服务的工程师，即使不直接采用它，这套代码也值得读：它展示了在一个成熟 serving 框架上做深度扩展时"继承 + 运行时补丁 + 最小侵入对象扩展"的完整打法，以及跨模型协同推理这种新型 workload 会把调度系统逼出哪些奇形怪状的边界条件。

> 源码版本：main @ 2026-10-20（62 files, ~13.5k LOC Python）。论文：arXiv:2610.12242；模型与 router 权重：HuggingFace `nics-efc` collections。
