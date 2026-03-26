---
title: K8s 日常运维指令与问题排查实战
description: 掌握 Kubernetes 日常运维中最常用的指令，涵盖日志查看、资源管理、网络调试、性能分析以及常见问题的排查方法
pubDate: 2026-03-26
tags: [kubernetes, 运维, troubleshooting, devops, 云原生]
---

## 目录

1. [日常基础命令](#日常基础命令)
2. [Pod 相关操作](#pod-相关操作)
3. [资源管理](#资源管理)
4. [日志查看与调试](#日志查看与调试)
5. [网络问题排查](#网络问题排查)
6. [存储问题排查](#存储问题排查)
7. [常见问题排查案例](#常见问题排查案例)
8. [性能分析与监控](#性能分析与监控)

---

## 日常基础命令

### 集群信息查看

```bash
# 查看集群节点状态
kubectl get nodes

# 查看节点详细信息，包括 IP、容量、状态
kubectl get nodes -o wide

# 以 YAML 格式输出节点详情
kubectl get nodes -o yaml

# 查看集群组件健康状态（需要 kubeconfig 权限）
kubectl get componentstatuses   # 已被废弃
kubectl get --raw '/healthz?verbose'

# 查看 API Server 版本信息
kubectl version --short

# 查看集群信息总览
kubectl cluster-info
```

### 上下文与配置

```bash
# 查看当前上下文（集群 + 用户 + 命名空间）
kubectl config current-context

# 查看所有上下文
kubectl config get-contexts

# 切换上下文
kubectl config use-context <context-name>

# 临时在命令中指定命名空间（不用切换上下文）
kubectl get pods -n <namespace>

# 设置默认命名空间
kubectl config set-context --current --namespace=<namespace>
```

---

## Pod 相关操作

### Pod 查看与检索

```bash
# 查看所有命名空间的 Pod
kubectl get pods --all-namespaces

# 查看指定命名空间的 Pod
kubectl get pods -n <namespace>

# 查看 Pod 详细信息（状态、Restart 次数、所在节点）
kubectl describe pod <pod-name> -n <namespace>

# 查看 Pod 的实时状态变化（Watch 模式）
kubectl get pods -n <namespace> -w

# 按标签筛选 Pod
kubectl get pods -n <namespace> -l app=nginx

# 查看不受 Deployment 管理的 Pod（Static Pod 或直接创建的）
kubectl get pods --all-namespaces | grep -v ReplicationController

# 查找处于非 Running 状态的 Pod
kubectl get pods -A | grep -v Running

# 统计各命名空间 Pod 数量
kubectl get pods -A --no-headers | awk '{print $1}' | sort | uniq -c
```

### Pod 日志查看

```bash
# 查看 Pod 日志（实时跟踪加 -f）
kubectl logs <pod-name> -n <namespace>

# 实时跟踪日志
kubectl logs -f <pod-name> -n <namespace>

# 查看上一个版本（容器重启后）的日志
kubectl logs --previous <pod-name> -n <namespace>

# 多容器 Pod 查看指定容器日志
kubectl logs <pod-name> -c <container-name> -n <namespace>

# 实时跟踪多容器 Pod 指定容器日志
kubectl logs -f <pod-name> -c <container-name> -n <namespace>

# 查看最近 100 行日志
kubectl logs --tail=100 <pod-name> -n <namespace>

# 按时间范围过滤日志（需要容器内支持）
kubectl logs --since=1h <pod-name> -n <namespace>

# 导出 Pod 日志到文件
kubectl logs <pod-name> -n <namespace> > /tmp/pod.log
```

### Pod 调试与执行命令

```bash
# 进入 Pod 容器（如有多个容器用 -c 指定）
kubectl exec -it <pod-name> -n <namespace> -- /bin/bash

# 指定容器进入
kubectl exec -it <pod-name> -c <container-name> -n <namespace> -- /bin/sh

# 在 Pod 中执行单个命令
kubectl exec <pod-name> -n <namespace> -- ls /app

# 复制文件到 Pod
kubectl cp <file> <namespace>/<pod-name>:/path/in/pod

# 从 Pod 复制文件到本地
kubectl cp <namespace>/<pod-name>:/path/in/pod/<file> ./local/path
```

### Pod 扩缩容

```bash
# Scale 扩缩容（不推荐直接使用，推荐用 HPA）
kubectl scale deployment <deployment-name> --replicas=5 -n <namespace>

# 基于 CPU/内存自动扩缩容
kubectl autoscale deployment <deployment-name> --min=2 --max=10 --cpu-percent=80 -n <namespace>

# 查看 HPA 状态
kubectl get hpa -n <namespace>

# 删除 HPA
kubectl delete hpa <hpa-name> -n <namespace>
```

---

## 资源管理

### Deployment 操作

```bash
# 查看所有 Deployment
kubectl get deployments -n <namespace>

# 查看 Deployment 详细信息
kubectl describe deployment <deployment-name> -n <namespace>

# 滚动重启 Deployment（零宕机部署）
kubectl rollout restart deployment <deployment-name> -n <namespace>

# 查看滚动更新状态
kubectl rollout status deployment/<deployment-name> -n <namespace>

# 查看滚动更新历史
kubectl rollout history deployment/<deployment-name> -n <namespace>

# 回滚到上一个版本
kubectl rollout undo deployment/<deployment-name> -n <namespace>

# 回滚到指定版本
kubectl rollout undo deployment/<deployment-name> --to-revision=<revision> -n <namespace>

# 暂停/恢复滚动更新
kubectl rollout pause deployment/<deployment-name> -n <namespace>
kubectl rollout resume deployment/<deployment-name> -n <namespace>
```

### 资源创建与删除

```bash
# 从 YAML 创建资源
kubectl apply -f <file.yaml>

# 从目录递归创建
kubectl apply -f <directory/>

# 删除资源
kubectl delete -f <file.yaml>

# 删除指定类型的所有资源
kubectl delete deployment --all -n <namespace>

# 强制删除 Terminating 状态的 Pod（慎用！）
kubectl delete pod <pod-name> -n <namespace> --grace-period=0 --force

# 清理已完成的 Job 和 Completed 状态的 Pod
kubectl delete pod --field-selector=status.phase=Succeeded -n <namespace>
kubectl delete job <job-name> -n <namespace>
```

### 资源配额与限制

```bash
# 查看命名空间资源配额
kubectl get resourcequota -n <namespace>

# 查看命名空间资源限制（LimitRange）
kubectl get limitrange -n <namespace>

# 查看 Pod 的资源请求和限制
kubectl get pod <pod-name> -n <namespace> -o jsonpath='{.spec.containers[*].resources}'

# 集群级别资源使用统计
kubectl top nodes
kubectl top pods -n <namespace>
```

---

## 日志查看与调试

### 常见日志场景

```bash
# 场景1：Pod 一直处于 Pending 状态
# 通常是调度问题或资源不足
kubectl describe pod <pod-name> -n <namespace> | grep -A 10 "Events:"
kubectl get events -n <namespace> --sort-by='.lastTimestamp'

# 场景2：Pod 一直处于 ImagePullBackOff
# 镜像名称错误或 Registry 权限问题
kubectl describe pod <pod-name> -n <namespace> | grep -A 5 "Events:"
# 检查镜像是否可访问
crictl images | grep <image-name>

# 场景3：Pod 一直处于 CrashLoopBackOff
# 应用程序启动失败，查看退出码和日志
kubectl describe pod <pod-name> -n <namespace> | grep "Exit Code"
kubectl logs --previous <pod-name> -n <namespace>

# 场景4：Pod 处于 Terminating 无法删除
kubectl delete pod <pod-name> -n <namespace> --grace-period=0 --force
# 确认没有 Finalizers 阻止删除
kubectl get pod <pod-name> -n <namespace> -o jsonpath='{.spec.finalizers}'
```

### 全局日志查询

```bash
# 查看最近所有命名空间的重要事件
kubectl get events -A --sort-by='.lastTimestamp' | tail -50

# 按资源类型过滤事件
kubectl get events -A --field-selector involvedObject.kind=Pod

# 实时查看某命名空间所有 Pod 日志（多容器场景）
kubectl logs -f <pod-name> -n <namespace> --all-containers=true

# 将某 Deploy 所有 Pod 日志汇总
for pod in $(kubectl get pods -n <namespace> -l app=<app-name> -o jsonpath='{.items[*].metadata.name}'); do
  echo "=== $pod ==="
  kubectl logs "$pod" -n <namespace> --tail=50
done
```

---

## 网络问题排查

### 基础网络检查

```bash
# 查看 Service 列表
kubectl get svc -n <namespace>

# 查看 Endpoint（确认后端 Pod 是否关联）
kubectl get endpoints <service-name> -n <namespace>

# 查看 Ingress
kubectl get ingress -n <namespace>

# 描述 Service 查看详情
kubectl describe svc <service-name> -n <namespace>

# ClusterIP 是否能通信（在 Pod 内测试）
kubectl exec -it <pod-name> -n <namespace> -- curl -s http://<cluster-ip>:<port>
```

### DNS 调试

```bash
# 查看 CoreDNS 是否运行正常
kubectl get pods -n kube-system -l k8s-app=kube-dns

# 测试集群内 DNS 解析
kubectl exec -it <pod-name> -n <namespace> -- nslookup kubernetes.default
kubectl exec -it <pod-name> -n <namespace> -- nslookup <service-name>.<namespace>.svc.cluster.local

# 进入网络调试容器
kubectl run netshoot --image=nicolaka/netshoot -n <namespace> --rm -it -- /bin/bash

# 在 netshoot 容器中测试 DNS
nslookup kubernetes.default.svc.cluster.local
dig kubernetes.default.svc.cluster.local
```

### 网络连通性测试

```bash
# 测试 Service 连通性（ClusterIP → Pod）
kubectl exec -it <pod-name> -n <namespace> -- curl -s http://<service-name>.<namespace>.svc.cluster.local:<port>

# 测试节点端口（NodePort）
curl http://<node-ip>:<node-port>

# 测试 ExternalTrafficPolicy 是否有问题
kubectl get svc <service-name> -n <namespace> -o jsonpath='{.spec.externalTrafficPolicy}'

# 抓包分析（需要 netshoot 镜像）
kubectl exec -it <pod-name> -n <namespace> -- tcpdump -i any -c 100 -w /tmp/capture.pcap
kubectl exec <pod-name> -n <namespace> -- tcpdump -i eth0 port 80

# 查看 iptables 规则（节点上）
iptables -L -n -t nat | grep <service-name>
ipvsadm -L -n | grep <service-ip>
```

### Ingress 调试

```bash
# 查看 Ingress Controller 是否正常
kubectl get pods -n ingress-nginx

# 查看 Ingress 详细事件
kubectl describe ingress <ingress-name> -n <namespace>

# 测试 Ingress 域名解析
nslookup <ingress-domain>

# 测试 Ingress 访问（Host Header 必须正确）
curl -v -H "Host: <ingress-domain>" http://<ingress-controller-ip>/
```

---

## 存储问题排查

### PVC 与 PV

```bash
# 查看 PVC 状态
kubectl get pvc -n <namespace>

# 查看 PV 状态
kubectl get pv

# 查看 PVC 详细信息
kubectl describe pvc <pvc-name> -n <namespace>

# 查找 PVC 未绑定原因
kubectl get events -n <namespace> --field-selector involvedObject.name=<pvc-name>

# StorageClass 是否存在
kubectl get storageclass

# 查看 PV 的绑定情况
kubectl get pv -o wide
```

### 常见存储问题

```bash
# 场景1：PVC 一直处于 Pending
# 检查 StorageClass 是否存在
kubectl get storageclass
# 检查 PVC 的 storageClassName 是否正确
# 查看相关的事件日志
kubectl describe pvc <pvc-name> -n <namespace>

# 场景2：Pod 无法挂载 Volume
kubectl describe pod <pod-name> -n <namespace> | grep -A 10 "Volumes:"
kubectl describe pod <pod-name> -n <namespace> | grep -A 5 "Mounts:"

# 场景3：检查节点上存储插件是否正常
# NFS
showmount -e <nfs-server>
# Ceph
ceph status
# 其他 CSI
kubectl get csidriver
```

---

## 常见问题排查案例

### 案例一：Pod 启动后立即崩溃（CrashLoopBackOff）

```bash
# 第一步：查看 Pod 状态
kubectl get pod <pod-name> -n <namespace>

# 第二步：查看最近一次退出的原因
kubectl describe pod <pod-name> -n <namespace> | grep -E "Exit Code|Reason|State"

# 第三步：查看应用日志
kubectl logs --previous <pod-name> -n <namespace>

# 第四步：常见原因及解决
# 原因1：健康检查失败（StartupProbe / Readiness / Liveness）
# 解决：调整探针参数或修复应用
kubectl get pod <pod-name> -n <namespace> -o jsonpath='{.spec.containers[*].livenessProbe}'
kubectl get pod <pod-name> -n <namespace> -o jsonpath='{.spec.containers[*].readinessProbe}'

# 原因2：OOMKilled（内存超限）
# 解决：增加 memory limit 或优化应用内存使用
kubectl get pod <pod-name> -n <namespace> -o jsonpath='{.status.containerStatuses[*].lastState.terminated.exitCode}'

# 原因3：权限问题（SecurityContext / SELinux）
# 解决：调整 Pod SecurityContext 或容器运行用户
```

### 案例二：Service 无法访问

```bash
# 第一步：确认 Endpoint 是否存在
kubectl get endpoints <service-name> -n <namespace>

# Endpoint 为空的原因：
# 1. Selector 没有匹配到任何 Pod
kubectl describe svc <service-name> -n <namespace> | grep Selector
kubectl get pods -n <namespace> -l <selector-label>

# 2. 后端 Pod 未就绪（Readiness Gate 问题）
kubectl describe pod <pod-name> -n <namespace> | grep -A 10 "Conditions"

# 第二步：在 Pod 内测试
kubectl exec -it <pod-name> -n <namespace> -- curl -v telnet://localhost:<port>

# 第三步：确认端口是否一致
# Service port vs Container port
kubectl get svc <service-name> -n <namespace> -o jsonpath='{.spec.ports[*]}'
```

### 案例三：节点 NotReady

```bash
# 查看节点状态和原因
kubectl get nodes
kubectl describe node <node-name>

# 常见原因：
# 1. kubelet 不健康
ssh <node-ip> "systemctl status kubelet"

# 2. 节点资源耗尽（内存、磁盘、inode）
ssh <node-ip> "df -h"           # 磁盘
ssh <node-ip> "free -m"         # 内存
ssh <node-ip> "df -i"           # inode

# 3. 网络分区
ssh <node-ip> "ip route"
ssh <node-ip> "ping <api-server-ip>"

# 4. 节点负载过高
kubectl top node <node-name>

# 驱逐节点上的 Pod（标记为不可调度后，手动驱逐）
kubectl cordon <node-name>                           # 标记为不可调度
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data  # 驱逐 Pod
```

### 案例四：Deployment 滚动更新卡住

```bash
# 查看滚动更新状态
kubectl rollout status deployment/<deployment-name> -n <namespace>

# 查看 Deployment 事件
kubectl describe deployment <deployment-name> -n <namespace>

# 常见原因：
# 1. 镜像拉取失败（滚动更新无法启动新 Pod）
kubectl get events -n <namespace> --field-selector involvedObject.kind=Pod | grep <new-pod>

# 2. 资源不足（没有足够的 CPU/内存调度新 Pod）
kubectl describe deployment <deployment-name> -n <namespace> | grep -A 5 "Conditions"

# 3. 就绪探针一直失败（新 Pod 无法变为 Ready）
kubectl get pods -n <namespace> -l app=<app-name>

# 解决方法：回滚或修复后继续
kubectl rollout undo deployment/<deployment-name> -n <namespace>
```

---

## 性能分析与监控

### 资源使用分析

```bash
# 查看集群节点 CPU/内存使用
kubectl top nodes

# 查看 Pod 资源使用（需要 metrics-server）
kubectl top pods -n <namespace>

# 按资源使用排序查看 Pod
kubectl top pods -n <namespace> --sort-by=memory
kubectl top pods -n <namespace> --sort-by=cpu

# 查看指定命名空间所有容器的资源使用
kubectl top pods -n <namespace> --all-namespaces=false

# 对比 requests 和实际使用
kubectl get pod <pod-name> -n <namespace> -o json | \
  jq '.spec.containers[0].resources.requests, .spec.containers[0].resources.limits'
```

### 调度问题分析

```bash
# 查看 Pod 调度决策
kubectl describe pod <pod-name> -n <namespace> | grep -A 20 "Events:"

# 检查节点亲和性/反亲和性
kubectl get pod <pod-name> -n <namespace> -o jsonpath='{.spec.affinity}'

# 检查污点（Taints）影响
kubectl describe node <node-name> | grep Taints

# 检查 Pod 优先级
kubectl get pod <pod-name> -n <namespace> -o jsonpath='{.spec.priorityClassName}'

# 调度器日志（需要 kube-system 权限）
kubectl logs -n kube-system kube-scheduler-<node-name> --tail=100
```

### API 对象查询技巧

```bash
# 格式化输出（YAML / JSON）
kubectl get pod <pod-name> -n <namespace> -o yaml
kubectl get pod <pod-name> -n <namespace> -o json

# 按列筛选输出
kubectl get pods -n <namespace> -o custom-columns=NAME:.metadata.name,STATUS:.status.phase,NODE:.spec.nodeName

# 统计某类资源数量
kubectl api-resources --verbs=list -o name | xargs -I {} sh -c "echo -n '{}: '; kubectl get {} -A --no-headers 2>/dev/null | wc -l"

# 查看对象完整 JSON（方便调试字段）
kubectl get pod <pod-name> -n <namespace> -o json | jq '.spec.containers[0].env'
```

---

## 常用运维脚本

### 一键排查 Pod 问题

```bash
#!/bin/bash
# 命名空间和问题 Pod 名
NS=$1
POD=$2

echo "========== 基础状态 =========="
kubectl get pod "$POD" -n "$NS"

echo "========== Describe =========="
kubectl describe pod "$POD" -n "$NS"

echo "========== 最近日志 =========="
kubectl logs --tail=100 "$POD" -n "$NS"

echo "========== 上次退出日志 =========="
kubectl logs --previous "$POD" -n "$NS" 2>&1 || echo "无上次日志"

echo "========== 事件 =========="
kubectl get events -n "$NS" --field-selector involvedObject.name="$POD" --sort-by='.lastTimestamp'
```

### 批量查看所有 Deploy 的状态

```bash
kubectl get deployments -A -o wide | awk 'NR==1{print;next} {print}' | column -t

for dep in $(kubectl get deployments -A -o jsonpath='{.items[*].metadata.name}'); do
  NS=$(kubectl get deployments "$dep" -o jsonpath='{.metadata.namespace}')
  echo "Deployment: $NS/$dep"
  kubectl rollout status "deployment/$dep" -n "$NS" --timeout=10s 2>&1 || echo "状态异常"
done
```

### 查找资源使用异常的 Pod

```bash
# CPU 使用最高的 10 个 Pod
kubectl top pods -A --sort-by=cpu | tail -n +2 | tail -10

# 内存使用最高的 10 个 Pod
kubectl top pods -A --sort-by=memory | tail -n +2 | tail -10

# restart 次数最多的 Pod
kubectl get pods -A -o jsonpath='{range .items[*]}{.metadata.namespace}{"\t"}{.metadata.name}{"\t"}{.status.containerStatuses[*].restartCount}{"\n"}{end}' | \
  awk '{for(i=3;i<=NF;i++) sum+=$i} END{print}' | sort -rn | head
```

---

## 总结

本文覆盖了 Kubernetes 日常运维中最核心的指令和问题排查思路。关键要点：

1. **善用 `kubectl describe` 和 events** — 大多数问题从事件日志中能找到根因
2. **分层排查** — 从集群 → 节点 → 网络 → Pod → 容器逐层定位
3. **日志是金** — 应用日志、Kubelet 日志、Docker/Crictl 日志各有各的价值
4. **理解资源限制** — OOM、CPU Throttling 往往是性能问题的根源
5. **滚动更新和回滚是运维的生命线** — 任何变更都要留好回退方案

日常高频操作建议配合 `kubectl alias` 使用：

```bash
alias k='kubectl'
alias kgp='kubectl get pods'
alias kgd='kubectl get deployment'
alias kgs='kubectl get svc'
alias kds='kubectl describe svc'
alias kdp='kubectl describe pod'
alias klf='kubectl logs -f'
alias kex='kubectl exec -it'
```

希望这篇文章能帮助你在日常 K8s 运维中快速定位问题、减少排查时间 🚀
