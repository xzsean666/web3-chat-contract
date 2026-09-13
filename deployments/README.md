# Deployments Directory (多链部署元数据记录)

本目录用于保存 EVM Chat State Storage Protocol 在各个网络上的部署产物与元数据。

## 目录结构
- `{chainId}.json`: 每个网络对应链 ID 的部署记录文件，记录网络名称、部署时间、部署者地址、核心合约地址等。

## 部署规范
1. 必须校验 Chain ID 与 Deployer 余额。
2. 遵循免广播保护原则：默认仅在 Localhost / Hardhat 节点或仿真网络执行。
3. 真实网络广播必须获得显式授权。
