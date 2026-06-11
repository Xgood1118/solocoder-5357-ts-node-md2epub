# 第二章：语法示例

本章展示 md2epub 支持的各种 Markdown 语法。

## 文本格式

这是**加粗文本**，这是*斜体文本*，这是~~删除线~~，这是 `行内代码`。

同时使用也没问题：**粗体里可以有 *斜体*，也可以有 `code`**。

## 列表

### 无序列表

- 苹果
- 香蕉
  - 小米蕉
  - 帝王蕉
    - 很小的那种
- 橙子

### 有序列表

1. 第一步
2. 第二步
   1. 子步骤 A
   2. 子步骤 B
3. 第三步

### 混合列表

1. 水果
   - 苹果
   - 香蕉
2. 蔬菜
   - 胡萝卜
   - 菠菜

## 引用

> 这是一段引用文字。
> 可以有多行。
>
> > 引用还可以嵌套。

## 代码块

### 普通代码块

```
function hello() {
  console.log("Hello, World!");
  return true;
}
```

### 带语言标签

```javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10)); // 55
```

```python
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)

print(quicksort([3, 6, 8, 10, 1, 2, 1]))
```

## 链接和图片

这是一个 [普通链接](https://example.com)。

> 注意：本地图片会被嵌入 EPUB，远程图片会被下载后嵌入。

## 表格

| 功能 | 支持情况 | 备注 |
|------|----------|------|
| 标题 | ✅ | H1-H6 |
| 列表 | ✅ | 最多嵌套 3 层 |
| 代码块 | ✅ | 保留语言标签 |
| 表格 | ✅ | GFM 格式 |
| 图片 | ✅ | 本地+远程 |
| 字体嵌入 | ✅ | woff2/ttf/otf |

### 简单表格

| 姓名 | 年龄 | 城市 |
|------|------|------|
| 张三 | 25 | 北京 |
| 李四 | 30 | 上海 |
| 王五 | 28 | 深圳 |

## 分割线

上方内容

---

下方内容
