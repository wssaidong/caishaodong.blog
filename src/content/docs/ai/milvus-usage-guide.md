---
title: Milvus 向量数据库使用指南
description: 深入了解 Milvus 向量数据库的架构、安装部署和实战应用
pubDate: 2025-10-09
---

## Milvus 简介

Milvus 是一个开源的向量数据库，专为海量向量数据的存储、索引和查询而设计。它在 AI 应用中扮演着重要角色，特别是在以下场景：

- **相似度搜索**：图像、视频、音频的相似内容检索
- **推荐系统**：基于用户行为和内容特征的个性化推荐
- **自然语言处理**：语义搜索、问答系统、文本分类
- **异常检测**：网络安全、欺诈检测等场景

### 核心特性

- 🚀 **高性能**：支持十亿级向量的毫秒级查询
- 📊 **多种索引类型**：FLAT、IVF_FLAT、IVF_SQ8、IVF_PQ、HNSW、ANNOY 等
- 🔄 **混合查询**：支持向量检索与标量过滤的组合查询
- 🌐 **云原生架构**：存储计算分离，支持水平扩展
- 🛡️ **高可用性**：支持数据备份、故障恢复
- 🔌 **多语言 SDK**：Python、Java、Go、Node.js 等

## Milvus 核心概念

### 架构组件说明

#### 1. 接入层（Access Layer）
- **Proxy**：无状态的代理服务，负责请求路由、负载均衡、结果聚合

#### 2. 协调服务层（Coordinator Service）
- **Root Coordinator**：管理集群拓扑、DDL 操作（创建/删除 Collection）
- **Query Coordinator**：管理查询节点的拓扑和负载均衡
- **Data Coordinator**：管理数据节点、数据段的分配和持久化
- **Index Coordinator**：管理索引构建任务的调度

#### 3. 执行层（Worker Node）
- **Query Node**：执行向量检索和标量查询
- **Data Node**：负责数据的流式写入和持久化
- **Index Node**：负责索引的构建

#### 4. 存储层（Storage）
- **Meta Store**：存储元数据（etcd）
- **Message Queue**：流式数据传输（Pulsar/Kafka）
- **Object Storage**：持久化存储向量数据和索引（MinIO/S3）

## 安装部署

### 方式一：Docker Compose（推荐用于开发测试）

```bash
# 下载 docker-compose.yml
wget https://github.com/milvus-io/milvus/releases/download/v2.3.0/milvus-standalone-docker-compose.yml -O docker-compose.yml

# 启动 Milvus
docker-compose up -d

# 查看状态
docker-compose ps
```

### 方式二：Kubernetes（推荐用于生产环境）

```bash
# 添加 Milvus Helm 仓库
helm repo add milvus https://milvus-io.github.io/milvus-helm/
helm repo update

# 安装 Milvus
helm install milvus milvus/milvus --set cluster.enabled=true

# 查看 Pod 状态
kubectl get pods
```

## 快速开始

### 1. 安装 Python SDK

```bash
pip install pymilvus
```

### 2. 连接到 Milvus

```python
from pymilvus import connections, utility

# 连接到 Milvus
connections.connect(
    alias="default",
    host="localhost",
    port="19530"
)

# 检查连接
print(f"Milvus 版本: {utility.get_server_version()}")
```

### 3. 创建 Collection

```python
from pymilvus import CollectionSchema, FieldSchema, DataType, Collection

# 定义字段
fields = [
    FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
    FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=128),
    FieldSchema(name="title", dtype=DataType.VARCHAR, max_length=200),
    FieldSchema(name="category", dtype=DataType.VARCHAR, max_length=50)
]

# 创建 Schema
schema = CollectionSchema(
    fields=fields,
    description="文档向量库"
)

# 创建 Collection
collection = Collection(
    name="documents",
    schema=schema
)

print(f"Collection 创建成功: {collection.name}")
```

### 4. 插入数据

```python
import random

# 准备数据
num_entities = 1000
embeddings = [[random.random() for _ in range(128)] for _ in range(num_entities)]
titles = [f"文档_{i}" for i in range(num_entities)]
categories = [random.choice(["技术", "产品", "市场"]) for _ in range(num_entities)]

# 插入数据
entities = [
    embeddings,
    titles,
    categories
]

insert_result = collection.insert(entities)
print(f"插入数据数量: {len(insert_result.primary_keys)}")

# 刷新数据（确保数据持久化）
collection.flush()
```

### 5. 创建索引

```python
# 定义索引参数
index_params = {
    "metric_type": "L2",  # 距离度量：L2（欧氏距离）或 IP（内积）
    "index_type": "IVF_FLAT",  # 索引类型
    "params": {"nlist": 128}  # 索引参数
}

# 创建索引
collection.create_index(
    field_name="embedding",
    index_params=index_params
)

print("索引创建成功")
```

### 6. 执行向量搜索

```python
# 准备查询向量
search_vectors = [[random.random() for _ in range(128)] for _ in range(5)]

# 定义搜索参数
search_params = {
    "metric_type": "L2",
    "params": {"nprobe": 10}  # 搜索的聚类数量
}

# 执行搜索
results = collection.search(
    data=search_vectors,
    anns_field="embedding",
    param=search_params,
    limit=10,  # 返回 Top-K 结果
    output_fields=["title", "category"]  # 返回的字段
)

# 打印结果
for i, result in enumerate(results):
    print(f"\n查询 {i + 1} 的结果:")
    for hit in result:
        print(f"  ID: {hit.id}, 距离: {hit.distance:.4f}, "
              f"标题: {hit.entity.get('title')}, "
              f"分类: {hit.entity.get('category')}")
```

## 高级特性

### 1. 分区管理

```python
# 创建分区
collection.create_partition("partition_2024")
collection.create_partition("partition_2025")

# 向特定分区插入数据
partition = collection.partition("partition_2024")
partition.insert(entities)

# 在特定分区中搜索
results = collection.search(
    data=search_vectors,
    anns_field="embedding",
    param=search_params,
    limit=10,
    partition_names=["partition_2024"]
)
```

### 2. 索引类型选择

| 索引类型 | 适用场景 | 内存占用 | 查询速度 |
|---------|---------|---------|---------|
| FLAT | 小数据集，追求精确度 | 高 | 慢 |
| IVF_FLAT | 中等数据集，平衡精度和速度 | 中 | 中 |
| IVF_SQ8 | 大数据集，节省内存 | 低 | 中 |
| IVF_PQ | 超大数据集，极致压缩 | 极低 | 快 |
| HNSW | 高精度要求，内存充足 | 高 | 极快 |
| ANNOY | 静态数据，读多写少 | 中 | 快 |

### 3. 混合查询（向量搜索 + 标量过滤）

```python
# 使用表达式过滤
expr = "category == '技术'"

results = collection.search(
    data=search_vectors,
    anns_field="embedding",
    param=search_params,
    limit=10,
    expr=expr,  # 过滤表达式
    output_fields=["title", "category"]
)

print("\n过滤后的搜索结果:")
for i, result in enumerate(results):
    print(f"查询 {i + 1} 找到 {len(result)} 个结果")
```

## 实战案例：构建语义搜索系统

### 完整示例代码

```python
from pymilvus import connections, Collection, CollectionSchema, FieldSchema, DataType
from sentence_transformers import SentenceTransformer
import numpy as np

# 1. 连接 Milvus
connections.connect(host="localhost", port="19530")

# 2. 加载预训练模型
model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')

# 3. 创建 Collection
fields = [
    FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
    FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=384),
    FieldSchema(name="text", dtype=DataType.VARCHAR, max_length=1000)
]
schema = CollectionSchema(fields=fields, description="语义搜索")
collection = Collection(name="semantic_search", schema=schema)

# 4. 准备文档数据
documents = [
    "Milvus 是一个开源的向量数据库",
    "向量数据库用于存储和检索高维向量",
    "机器学习模型可以将文本转换为向量",
    "相似度搜索是向量数据库的核心功能",
    "Milvus 支持多种索引类型和距离度量"
]

# 5. 生成向量并插入
embeddings = model.encode(documents).tolist()
entities = [embeddings, documents]
collection.insert(entities)
collection.flush()

# 6. 创建索引
index_params = {
    "metric_type": "COSINE",
    "index_type": "HNSW",
    "params": {"M": 16, "efConstruction": 200}
}
collection.create_index(field_name="embedding", index_params=index_params)
collection.load()

# 7. 执行语义搜索
query = "什么是向量数据库？"
query_embedding = model.encode([query]).tolist()

search_params = {"metric_type": "COSINE", "params": {"ef": 100}}
results = collection.search(
    data=query_embedding,
    anns_field="embedding",
    param=search_params,
    limit=3,
    output_fields=["text"]
)

# 8. 输出结果
print(f"查询: {query}\n")
for hit in results[0]:
    print(f"相似度: {hit.distance:.4f}")
    print(f"文本: {hit.entity.get('text')}\n")
```

## 性能优化建议

### 1. 索引优化
- 根据数据规模选择合适的索引类型
- 调整 `nlist` 参数（IVF 系列）：通常设置为 `sqrt(num_entities)`
- 调整 `nprobe` 参数：增加可提高召回率但降低速度

### 2. 查询优化
- 使用分区减少搜索范围
- 合理设置 `limit` 参数
- 批量查询优于单次查询

### 3. 资源配置
- Query Node：增加内存和 CPU 核心数
- Data Node：增加磁盘 I/O 性能
- 使用 SSD 存储提升性能

## 监控与运维

### 查看 Collection 信息

```python
from pymilvus import utility

# 列出所有 Collection
print(utility.list_collections())

# 查看 Collection 统计信息
stats = collection.num_entities
print(f"实体数量: {stats}")

# 查看索引信息
print(collection.index().params)
```

### 数据管理

```python
# 删除实体
expr = "id in [1, 2, 3]"
collection.delete(expr)

# 释放 Collection
collection.release()

# 删除 Collection
collection.drop()
```

## 总结

Milvus 作为一个强大的向量数据库，为 AI 应用提供了高效的向量存储和检索能力。通过本文的介绍，你应该能够：

✅ 理解 Milvus 的架构和核心概念
✅ 完成 Milvus 的安装和部署
✅ 掌握基本的 CRUD 操作
✅ 构建实际的语义搜索应用
✅ 进行性能优化和运维管理

## 参考资源

- [Milvus 官方文档](https://milvus.io/docs)
- [Milvus GitHub](https://github.com/milvus-io/milvus)
- [PyMilvus SDK](https://github.com/milvus-io/pymilvus)
- [Milvus Bootcamp](https://github.com/milvus-io/bootcamp)
