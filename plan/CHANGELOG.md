# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v0.1.1] - 2026-03-07

### Changed
- Runtime: Bun → pnpm
- Clarified: LangChain/LangGraph (Node.js) with note on limited features

## [v0.1.0] - 2026-03-07

### Added
- Initial tech stack specification
- Architecture overview
- Agent system design with A2A + MCP
- Multi-tenancy and deployment strategy

### Defined Components
- Express + tRPC API layer
- LangChain/LangGraph agent framework
- Qdrant vector database for RAG memory
- EKS + EKS Anywhere hybrid deployment
- Per-token pricing model
- 99% SLA target
