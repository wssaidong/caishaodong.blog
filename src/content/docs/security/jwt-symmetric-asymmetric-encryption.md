---
title: JWT 的对称加密与非对称加密：深入解析
description: 详解 JWT 中 HS256/RS256/ES256 等签名算法的区别，以及何时该用对称密钥还是非对称密钥。
lastUpdated: 2026-05-26
---

# JWT 的对称加密与非对称加密：深入解析

JWT（JSON Web Token）是现代 API 认证的事实标准。但你知道吗？JWT 实际上**不加密**，只签名。签名算法分为两大类：**对称加密（HMAC）**和**非对称加密（RSA/ECDSA）**。选错了，轻则性能受损，重则安全隐患。

---

## 一、先搞清楚：JWT 的结构

一个典型的 JWT 长这样：

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

由三部分用 `.` 连接而成：

| 部分 | 名称 | 内容 |
|:----:|:----:|:-----|
| `eyJ...` | **Header** | 算法类型 + Token 类型 |
| `eyJ...` | **Payload** | 用户数据（Claims） |
| `eyJ...` | **Signature** | 签名，防篡改 |

> ⚠️ **Header 和 Payload 只是 Base64URL 编码，任何人都能直接解码读取内容。** 所以绝不能在 Payload 里放密码、敏感信息。

---

## 二、签名算法全览

| 算法 | 类型 | 用途 | 特点 |
|:----:|:----:|:----:|:-----|
| HS256/384/512 | **对称** | 签名+验证用同一密钥 | 简单、快、密钥需安全共享 |
| RS256/384/512 | **非对称 RSA** | 签信用私钥，验信用公钥 | 适合分布式系统 |
| ES256/384/512 | **非对称椭圆曲线** | 同上，更短签名 | 更现代，推荐使用 |
| PS256/384/512 | **非对称 RSA-PSS** | 签名+验证，公钥密码学 | 防某些攻击 |

---

## 三、对称加密：HMAC（HS256）

### 原理

HMAC（Hash-based Message Authentication Code）使用**同一把密钥**进行签名和验证。相当于两个人知道同一个密码，发送方用密码算出签名，接收方用同一个密码验证签名。

```
签名 = HMAC(secret, header + "." + payload)
```

### 代码示例

```javascript
import jwt from 'jsonwebtoken';

// 💀 永远不要这样做！密钥硬编码在代码里
const secret = 'my-super-secret-key';

const token = jwt.sign(
  { userId: 123, role: 'admin' },
  secret,
  { algorithm: 'HS256', expiresIn: '2h' }
);

console.log(token);

// 验证
try {
  const decoded = jwt.verify(token, secret);
  console.log('✅ 验证通过:', decoded);
} catch (err) {
  console.log('❌ 无效 Token');
}
```

### Node.js 完整示例（koa 中间件风格）

```javascript
const SECRET = process.env.JWT_SECRET; // 必须从环境变量读取

// 签发 Token
function signToken(payload) {
  return jwt.sign(payload, SECRET, { algorithm: 'HS256', expiresIn: '7d' });
}

// 验证 Token（用于中间件）
function verifyToken(token) {
  return jwt.verify(token, SECRET);
}
```

### 适用场景

- ✅ **单体应用 / 内部服务**：所有模块在同一进程或受保护网络内
- ✅ **微服务间共享密钥**（服务数量少，密钥分发可控）
- ✅ **简单场景**：密钥管理不复杂，不需要公钥基础设施（PKI）

### 致命缺点

- 密钥需要安全分发给所有验证方
- 服务越多，密钥泄露风险越高
- 无法实现"签发方和验证方完全分离"

---

## 四、非对称加密：RSA（RS256）

### 原理

使用**公钥/私钥对**：
- **私钥**（只有签发方持有）→ 生成签名
- **公钥**（所有验证方持有）→ 验证签名

```
签名 = RSA_Sign(private_key, header + "." + payload)
验证 = RSA_Verify(public_key, header + "." + payload, signature)
```

### 代码示例

**生成密钥对（只需运行一次）：**

```bash
# 生成私钥
openssl genrsa -out private.pem 2048

# 导出公钥
openssl rsa -in private.pem -pubout -out public.pem
```

**Node.js 使用：**

```javascript
import jwt from 'jsonwebtoken';
import fs from 'fs';

const PRIVATE_KEY = fs.readFileSync('./keys/private.pem', 'utf8');
const PUBLIC_KEY  = fs.readFileSync('./keys/public.pem', 'utf8');

// 用私钥签发 Token（服务端）
const token = jwt.sign(
  { userId: 123, role: 'admin' },
  PRIVATE_KEY,
  { algorithm: 'RS256', expiresIn: '2h' }
);

// 用公钥验证 Token（可以是另一个服务）
try {
  const decoded = jwt.verify(token, PUBLIC_KEY);
  console.log('✅ 验证通过:', decoded);
} catch (err) {
  console.log('❌ 无效 Token');
}
```

### 适用场景

- ✅ **开放 API / 第三方集成**：验证方只需知道公钥，无需知道私钥
- ✅ **多服务架构**：签发服务持有私钥，其他服务只用公钥验证
- ✅ **OAuth 2.0 / OIDC**：Access Token 的事实标准

---

## 五、非对称加密：ECDSA（ES256）

### 为什么推荐 ES256

ES256（ECDSA with P-256）相比 RS256 的优势：

| 对比项 | RS256 | ES256 |
|:------:|:-----:|:-----:|
| 密钥长度 | 2048+ 位 | 256 位（压缩 4x） |
| 签名长度 | 256 字节 | 64 字节 |
| 性能 | 较慢 | 快 4-6 倍 |
| 安全性 | 依赖 RSA 假设 | 依赖椭圆曲线离散对数 |
| **推荐程度** | 可用 | ✅ **强烈推荐** |

### 生成密钥对

```bash
# ES256 需要 P-256 曲线
openssl ecparam -genkey -name prime256v1 -noout -out ec_private.pem
openssl ec -in ec_private.pem -pubout -out ec_public.pem
```

### Node.js 使用

```javascript
const PRIVATE_KEY = fs.readFileSync('./keys/ec_private.pem', 'utf8');
const PUBLIC_KEY  = fs.readFileSync('./keys/ec_public.pem', 'utf8');

const token = jwt.sign(
  { userId: 123, role: 'admin' },
  PRIVATE_KEY,
  { algorithm: 'ES256', expiresIn: '2h' }
);

const decoded = jwt.verify(token, PUBLIC_KEY);
```

---

## 六、对称 vs 非对称：实战怎么选

### 决策树

```
你的系统是开放的吗？
    ├── 是 → 第三方需要验证 Token？→ YES → ES256/RS256（公钥分发）
    └── 否
            ├── 单体应用 / 内部系统？→ HS256（简单高效）
            ├── 微服务架构，服务间可安全传递密钥？→ HS256（简单场景）
            └── 微服务架构，服务数量多且密钥管理复杂？→ ES256（推荐）
```

### 实际推荐

| 场景 | 推荐算法 | 理由 |
|:----:|:--------:|:-----|
| 内部工具、后台管理系统 | **HS256** | 简单，密钥少，运维成本低 |
| 面向外部的 REST API | **ES256** | 公钥可公开，第三方验证无需共享密钥 |
| 微服务之间 | **ES256** | 私钥只在一处，公钥可分发所有服务 |
| OAuth 2.0 / OIDC | **RS256 或 ES256** | 标准要求 |
| 追求性能 | **ES256** | 签名验证更快，签名更短 |

---

## 七、常见安全问题

### ⚠️ HS256 密钥泄露

如果攻击者拿到 HS256 的 secret，他可以**伪造任意 Token**：

```javascript
// 攻击者用泄露的密钥伪造 admin Token
const forged = jwt.sign(
  { userId: 1, role: 'admin', iat: Math.floor(Date.now() / 1000) },
  'leaked-secret',
  { algorithm: 'HS256' }
);
```

**防御**：
- 密钥存储在 Vault / KMS / 环境变量（绝不在代码里硬编码）
- 生产环境使用非对称算法，即使公钥泄露也无妨

### ⚠️ Algorithm Confusion（算法混淆）

攻击者修改 Token 的 `alg` 字段从 `RS256` 改为 `HS256`，然后用公钥作为 HMAC 密钥签名。某些旧版库会错误处理。

**防御**：始终**白名单算法**，不要动态接受用户指定的算法：

```javascript
// ❌ 危险
jwt.verify(token, publicKey, { algorithms: null }); // 不要这样！

// ✅ 安全
jwt.verify(token, publicKey, { algorithms: ['ES256', 'RS256'] });
```

### ⚠️ Payload 中的敏感信息

JWT 的 Payload 只是 Base64 编码，**不加密**。任何人可解码：

```javascript
// 解码后直接看到用户信息
Buffer.from(token.split('.')[1], 'base64').toString()
// {"userId":123,"role":"admin","password":"secret123"} ← 明文！
```

**防御**：敏感信息存入数据库，Token 只存不敏感的用户 ID。

---

## 八、总结

| 维度 | HS256（对称） | ES256（非对称） |
|:----:|:------------:|:---------------:|
| 密钥 | 一把 secret，双方共享 | 私钥签名，公钥验证 |
| 性能 | 快 | 更快（签名） |
| 密钥分发 | 需安全分发 | 公钥可公开分发 |
| 适用规模 | 小型/内部系统 | 分布式/开放系统 |
| 第三方集成 | 困难（需共享密钥） | 容易（给公钥即可） |
| 安全性 | 密钥泄露 = 完全沦陷 | 公钥泄露不影响 |

> 💡 **经验法则**：除非你是单体应用且密钥绝对安全，否则**优先选 ES256**。它兼具高性能和安全性，是现代 JWT 的最佳实践。