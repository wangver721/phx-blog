---
id: 5
title: 全线告急！当专线沦为传说，我用 12 线 BGP 强行续命
published: 2026-05-10
description: '面对近期国内入口大规模拔线与 QOS 干扰，搬瓦工等直连方案纷纷折戟。本文深度评测基于 po0 陈总黑科技的“最强 MJJ 专线”：采用腾讯云 12 线 BGP 极致入口，联动 RFCHOST HK/JP T1 顶级出口，教你如何在网络寒冬中通过顶级冗余架构实现跨境链路的丝滑体验。'
---

# 前言

这俩月（4月开始）的惨烈程度大家也看见了：

- **机房连坐：** 各大机房纷纷实行连坐制，牵连甚广；
- **回程 QoS：** 曾经以为稳定的高端 BWG 直连等回程，也受到了不同程度的干扰；
- **漫游阻断：** 甚至部分地区的外卡数据漫游也开始出现阻断报告。

针对这种逆天封锁，虽然我个人也有一些私人手段，但终究不具备普适性。前阵子与同好交流时，偶然间聊到了一套基于 **po0 + RFC** 的方案。

实测下来，这确实属于 MJJ 能承受的价格内（每月 200¥ 内）的**最强方案**，且配置门槛相对较低。目前该方案已加入我的备用方案，下文分享具体的落地细节。


![image-20260510110041642](./image-20260510110041642.png)
![xhj026](./026.gif)

# 准备

### 入口：po0 腾讯云 BGP

选购 [广州](https://console.po0.com/store/bgp-intel) 或 [华东](https://console.po0.com/store/tencent-sha-bgp-intel) Intel 节点。个人建议选择 **200M** 规格足矣，实名自行解决。

- **优惠码：** `常驻九折优惠券`

------

### 出口：RFCHOST T1 系列

需购买 **HK.T1** 或 **JP.T1** 实例。截至本文发布时支持内网传输（专线/避开公网堵塞）的机型就这俩。

------

### RFC 优惠码汇总

| **优惠码**                 | **折扣**   | **适用说明**                          |
| -------------------------- | ---------- | ------------------------------------- |
| **我是高手我不需要发工单** | **6 折**   | 循环优惠（限港日，每月仅限 1 次工单） |
| **7ID6AW4VHY**             | **5 折**   | 限量特惠（不含 Mini 及年付套餐）      |
| **RFCSTAR**                | **9.2 折** | 全产品常规月付循环                    |
| **RFCSTAR-Annually**       | **8.8 折** | 全产品常规年付循环                    |

# 配置

## RFC出口配置（落地侧）

首先部署落地端。因为流量走的是内网专线，不经过 GFW，搭一个简单的 **Shadowsocks Rust (SS-2022)** 直连即可。

**一键安装脚本：**

```bash
# 使用 GitHub 社区常用的 SS-2022 脚本
bash <(curl -L -s ss.jinqians.com)
```

**关键步骤：** 安装完成后，终端会输出生成的节点链接。**先存着待会用**，这是后续入口端对接的唯一凭证。

> **链接格式参考：** `ss://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@123.123.123.123:66666#出口落地`

## po0入口配置（腾讯云BGP）

个人用的话入口侧直接使用内核级别的 **nftables** 进行转发即可，性能损耗极小且极其稳定。

### 环境准备

先安装 nftables 并开启内核转发（这是转发生效的前提）：

```bash
# 1. 安装 nftables
apt update && apt install nftables -y

# 2. 开启内核转发（立即生效 + 永久生效）
sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward = 1" > /etc/sysctl.d/99-nft-forward.conf
```

------

### 配置转发规则

编辑配置文件 `/etc/nftables.conf`。这里我提供了两个版本的模板：

> 在应用配置前，请确认 **SSH 端口**。如果你的 SSH 端口不是默认的 22，请修改变量第一行，否则重启服务后你将被锁在服务器外。

#### 单落地简单配置（只买了一个RFC）

如果你只有一个出口落地：

```bash
#!/usr/sbin/nft -f

# =======================================================
# 📝 变量定义区
# =======================================================
define SSH_PORT      = 22             # ⚠️ 确认你的 SSH 端口！
define DEST_IP       = 82.40.xx.xx     # RFC 落地机公网 IP
define DEST_PORT     = 33333           # 落地机服务端口 (SS 端口)
define RELAY_PORT    = 10086           # 中转机监听端口
define LOCAL_IP      = 10.100.xx.xx    # 中转机内网 IP (po0 后台查看)
# =======================================================

flush ruleset

table ip filter {
    chain input {
        type filter hook input priority 0; policy drop;
        iif "lo" accept
        ct state established,related accept
        
        tcp dport $SSH_PORT accept     # 放行 SSH
        tcp dport $RELAY_PORT accept   # 放行中转端口
        udp dport $RELAY_PORT accept
    }

    chain forward {
        type filter hook forward priority 0; policy accept;
        # 核心：调整 MSS 解决跨网大包断流问题
        ip daddr $DEST_IP tcp flags syn tcp option maxseg size set 1452
    }

    chain output {
        type filter hook output priority 0; policy accept;
    }
}

table ip nat {
    chain prerouting {
        type nat hook prerouting priority dstnat; policy accept;
        meta l4proto { tcp, udp } th dport $RELAY_PORT dnat to $DEST_IP:$DEST_PORT
    }

    chain postrouting {
        type nat hook postrouting priority srcnat; policy accept;
        ip daddr $DEST_IP meta l4proto { tcp, udp } th dport $DEST_PORT snat to $LOCAL_IP
    }
}
```

#### 多落地映射配置

如果你有多个落地，用 Map 映射表更优雅：

```bash
#!/usr/sbin/nft -f

# =======================================================
# 📝 基础变量定义
# =======================================================
define SSH_PORT      = 22              
define LOCAL_IP      = 10.100.xx.xx    

# 格式：中转端口 : 落地机IP . 落地端口
map dnat_map {
    type inet_service : ipv4_addr . inet_service
    elements = { 
        10086 : 172.81.xx.xx . 33333,  # 线路 1 (香港)
        20086 : 82.40.xx.xx  . 44444   # 线路 2 (日本)
    }
}

define ALL_DEST_IPS = { 172.81.xx.xx, 82.40.xx.xx }
define ALL_RELAY_PORTS = { 10086, 20086 }

flush ruleset

table ip filter {
    chain input {
        type filter hook input priority 0; policy drop;
        iif "lo" accept
        ct state established,related accept
        tcp dport $SSH_PORT accept
        tcp dport $ALL_RELAY_PORTS accept
        udp dport $ALL_RELAY_PORTS accept
    }
    chain forward {
        type filter hook forward priority 0; policy accept;
        ip daddr $ALL_DEST_IPS tcp flags syn tcp option maxseg size set 1452
    }
}

table ip nat {
    chain prerouting {
        type nat hook prerouting priority dstnat; policy accept;
        dnat ip addr . port to tcp dport map @dnat_map
        dnat ip addr . port to udp dport map @dnat_map
    }
    chain postrouting {
        type nat hook postrouting priority srcnat; policy accept;
        ip daddr $ALL_DEST_IPS snat to $LOCAL_IP
    }
}
```

------

### 启动服务与验证

执行以下命令让配置立即生效：

```bash
# 1. 应用配置文件
nft -f /etc/nftables.conf

# 2. 设置开机自启并重启
systemctl enable nftables
systemctl restart nftables

# 3. 检查状态
systemctl status nftables
```

验证直接修改你最初保存的 **Shadowsocks 链接**：

- **地址 (Address)：** 修改为 `PO0 的公网 IP`
- **端口 (Port)：** 修改为 `PO0 的中转端口` (如提供的模板配置文件的10086)
- **其余参数：** 保持与落地机配置完全一致。

然后就可以导入节点看看通不通了

# 结语

4 月以来的这波“拔线潮”其实释放了一个很明确的信号：以往那种靠单纯买个直连 VPS 就能一劳永逸的时代，可能真的要结束了。

今天讨论的这套 **po0 + RFCHOST T1** 方案，虽然这只是我的备用链路之一，但在 200¥/月的预算范围内，它所提供的确定性是极其难得的。

在这个网络环境不断收紧的当下，所谓的“自由”往往就建立在这些看似繁琐的架构细节和硬件堆料之上。希望这篇教学能帮你在“寒冬”里搭建起一座稳如老狗的数字桥梁。

如果方案后续有变动，或者你有更黑科技的玩法，欢迎在评论区交流。
