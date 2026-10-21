# PVZ：僵王崛起 · 0.4.0

经典素材反向塔防，包含序章与前两章七关。采用木石UI、五种可解救僵尸、六种植物、七种关卡配置、开局信件和Q版漫画。完整离线运行。

- [玩法、关卡与存档](game/README.md)
- [全量Review与五项修复](docs/0.4.0-全量Review与修复记录.md)
- [后续扩展候选（尚未实现）](docs/0.4.0-后续扩展候选.md)
- [PC与Android本地构建](构建说明.md)

源码目录：game/为完整游戏，desktop/为Electron容器，android/为WebView容器，tests/为自动检查。直接打开game/index.html可运行网页版本。运行npm ci后npm test执行67项行为检查及语法/资源一致性检查。

PC与APK由Build-Local.ps1使用本地Electron、Android SDK和单独保管的签名密钥构建。签名密钥、密码、运行库、安装包和node_modules不进入仓库。真实浏览器布局与Windows/Android设备体验未在当前环境验证。

当前为独立实现，非原版EXE补丁；巨人、机甲、最终梦醒等后续内容尚未制作。
