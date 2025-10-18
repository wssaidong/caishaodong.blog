---
title: Rust 开发者指南
date: 2025-02-07 11:28:42
tags:
---

# Rust 开发者指南

## 1. 知识大纲

### 基础语法
Rust 使用 `let` 声明变量，默认不可变，可用 `mut` 使其可变。  
常见类型：整数、浮点数、布尔、字符、元组、数组、切片。  
函数用 `fn` 定义，控制流包括 `if/else`、`loop`、`while`、`for`。  

```rust
fn main() {
    let mut count = 0;
    while count < 5 {
        println!("count = {}", count);
        count += 1;
    }
}
```

### 所有权系统
- 每个值有唯一所有者。  
- 变量离开作用域时释放内存。  
- 默认赋值是移动（`move`），标量是复制（`copy`）。  
- `.clone()` 进行深拷贝。

### 借用与生命周期
- `&T`（不可变引用），`&mut T`（可变引用）。  
- 同一时间：多个不可变引用 **或** 一个可变引用。  
- 生命周期 `'a` 用于标注引用的有效性。  

```rust
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}
```

### 模块与包管理
- 模块：`mod`。  
- 包（crate）：基本编译单元。  
- Cargo 管理依赖和构建（`cargo build`、`cargo run`）。  

### Trait 与泛型
```rust
trait Greet { fn greet(&self); }
struct Person { name: String }
impl Greet for Person {
    fn greet(&self) { println!("Hello, {}!", self.name); }
}
```
- Trait 类似接口。  
- 泛型允许编写与类型无关的函数。  
- 关联类型简化泛型接口（如 `Iterator::Item`）。

### 错误处理
- 可恢复错误：`Result<T,E>`。  
- 不可恢复错误：`panic!`。  
- `?` 运算符简化错误传播。

### 模式匹配
```rust
enum Direction { North, East, South, West }
fn turn_left(d: Direction) -> Direction {
    match d {
        Direction::North => Direction::West,
        Direction::East  => Direction::North,
        Direction::South => Direction::East,
        Direction::West  => Direction::South,
    }
}
```

### 标准库常用组件
- 集合：`Vec<T>`、`HashMap<K,V>`  
- 智能指针：`Box<T>`、`Rc<T>`、`Arc<T>`、`RefCell<T>`  
- 并发：`thread`、`Mutex`、`RwLock`、`mpsc` 通道  
- 字符串：`String`、`&str`  
- 迭代器链式操作：`.map()`、`.filter()`  

---

## 2. 典型用例

### 系统开发（操作系统/内核）
- 无 GC 内存安全，适合内核开发。  
- 示例：`#![no_std]` 模式，裸机编程。  
- 参考：[Writing an OS in Rust](https://os.phil-opp.com/)

### 命令行工具
使用 `clap` 快速构建 CLI：

```rust
use clap::Parser;
#[derive(Parser)]
struct Opt { #[arg(short)] name: String }
fn main() {
    let opt = Opt::parse();
    println!("Hello, {}!", opt.name);
}
```

### WebAssembly（Wasm）
Rust → WebAssembly → JS 调用：

```rust
use wasm_bindgen::prelude::*;
#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}
```

### 嵌入式系统
- 使用 `#![no_std]`。  
- 硬件抽象层：[`embedded-hal`](https://github.com/rust-embedded/embedded-hal)。  
- 示例：STM32、Cortex-M 开发。

### Web 后端服务
Actix Web 示例：

```rust
#[actix_web::main]
async fn main() {
    use actix_web::{HttpServer, App, HttpResponse, web};
    HttpServer::new(|| {
        App::new()
            .route("/", web::get().to(|| async { HttpResponse::Ok().body("Hello, world!") }))
    })
    .bind(("127.0.0.1", 8080)).unwrap()
    .run().await.unwrap();
}
```

### 区块链开发
- Substrate 框架（Rust 编写）。  
- Polkadot 使用 Rust 实现。  

---

## 3. 高阶用法

### 异步编程
```rust
#[tokio::main]
async fn main() {
    let resp = reqwest::get("https://www.rust-lang.org").await.unwrap();
    println!("Status: {}", resp.status());
}
```

### 并发与多线程
```rust
use std::thread;
fn main() {
    let handle = thread::spawn(|| {
        println!("Hello from thread!");
    });
    handle.join().unwrap();
}
```

- 共享数据：`Arc<Mutex<T>>`。  
- 通信：`mpsc` 通道。  

### 宏系统
- 声明宏：
```rust
macro_rules! say_hello {
    () => { println!("Hello!"); };
}
```
- 过程宏：`#[derive(Serialize)]`、`#[tokio::main]`。

### FFI（与 C 交互）
```rust
extern "C" {
    fn puts(s: *const libc::c_char);
}
fn main() {
    let c_string = std::ffi::CString::new("Hello from C!\n").unwrap();
    unsafe { puts(c_string.as_ptr()); }
}
```

### 高级 Trait 用法
- 关联类型：`Iterator::Item`。  
- 默认泛型类型参数。  
- Trait 对象：`dyn Trait`。

### 零成本抽象
- 泛型和迭代器在编译后无运行时开销。  
- 高层抽象性能接近 C++。

### Pin/Unpin
- `Pin<T>` 确保值在内存中不被移动。  
- 用于自引用或异步任务安全。

### 安全与不安全代码
- `unsafe` 操作包括：
  - 解引用裸指针  
  - 调用不安全函数  
  - 修改可变静态变量  
- 常用于底层实现，但应保持外部接口安全。

---
