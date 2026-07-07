# BabyBingo 部署到 GitHub Pages + Supabase

## 1. Supabase 建库

1. 打开 Supabase，新建一个 Project。
2. 进入 SQL Editor。
3. 把 `supabase-schema.sql` 全部复制进去并执行。
4. 进入 Project Settings -> API，复制：
   - Project URL
   - anon public key

## 2. 填配置

打开 `supabase-config.js`，替换这两项：

```js
window.BABYBINGO_SUPABASE = {
  url: "https://你的项目.supabase.co",
  anonKey: "你的 anon public key",
  bucket: "babybingo-photos",
  stateTable: "babybingo_state",
  appId: "babybingo"
};
```

`url` 填 Supabase 的 Project URL，`anonKey` 填 anon public key。

## 3. 发布到 GitHub Pages

1. 新建一个 GitHub 仓库，例如 `BabyBingo`。
2. 上传这些文件到仓库根目录：
   - `index.html`
   - `app.js`
   - `styles.css`
   - `sw.js`
   - `manifest.webmanifest`
   - `icon.svg`
   - `supabase-config.js`
3. 进入仓库 Settings -> Pages。
4. Source 选择 `Deploy from a branch`。
5. Branch 选择 `main`，目录选择 `/root`，保存。

稍等一会儿，访问地址通常是：

```text
https://你的GitHub用户名.github.io/仓库名/
```

## 4. 重要提醒

当前 `supabase-schema.sql` 为了方便你先跑通，允许匿名读写 BabyBingo 的数据和照片。只要别人知道网址和前端配置，就有可能写入数据。

先自用测试没问题。等功能稳定后，建议再加一个访问口令或 Supabase 登录，把权限收紧。
