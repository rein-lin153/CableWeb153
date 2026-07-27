# 产品图占位目录 / Product Image Placeholders

`index.html` 产品分类区卡片顶部为**占位渐变图**,待后期替换为实拍产品照片。

## 命名约定(上传实拍后替换

将实拍图按下列文件名放入本目录,然后修改 `index.html` 对应卡片中 `<div class="h-40 bg-gradient-to-br ...">` 占位块为 `<img src="assets/images/products/<文件名>" class="h-40 w-full object-cover">`。

| 卡片 / 大类 | 推荐文件名 | 拍摄建议 |
|---|---|---|
| 01 家装布电线(BVR/BVVB/RVV/RVS) | `household-wiring.jpg` | 多色线卷平铺,展示软线/护套线/花线质感 |
| 02 工程电力主干(YJV/YJLV) | `power-feeder.jpg` | 大截面电缆盘/截面端面,显铜/铝导体 |
| 03 电焊机专用(YH) | `welding-cable.jpg` | 橡套电缆 + 焊把夹,展示柔软卷曲 |
| 04 设备软线与花线(RVV/RVS/VAF) | `flexible-cord.jpg` | 双绞花线 + 护套软线,展示柔软手感 |

## 后续可选:每型号实物图
若要为每个具体型号单独配图,建议命名 `<型号小写>.jpg`(如 `bvr.jpg`、`yjv.jpg`),并在"型号速查表"每行加缩略图列。

## 注意
- 实拍图建议宽度 ≥ 800px,比例约 16:9(占位区 `h-40` ≈ 160px 高)。
- 文件体积控制在 200KB 以内(JPG 质量 80),保证首页加载速度。
- 图片须为自有版权或已获授权,避免从网络直接抓取。
